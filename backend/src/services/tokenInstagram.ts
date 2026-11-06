import { prisma } from "../db.js";
import { decryptJson, encryptJson } from "../lib/crypto.js";
import { logError } from "../lib/errorLog.js";
import { loadProviders } from "../providers/registry.js";

// Perpanjangan otomatis token Instagram Login.
//
// Token jangka panjang Instagram berlaku 60 hari dan hanya bisa diperpanjang selama masih
// berlaku (dan minimal 24 jam sejak diterbitkan). Tanpa tugas ini penyambungnya berhenti
// DIAM-DIAM dua bulan setelah disambungkan: DM tetap masuk, tetapi tak satu balasan pun
// terkirim — risiko 6 di docs/RENCANA-INSTAGRAM.md.
//
// Diperpanjang tiap 7 hari, bukan menjelang kedaluwarsa: satu-dua kegagalan (jaringan,
// Meta sedang gangguan) masih menyisakan tujuh minggu untuk dicoba lagi. Waktunya dicatat
// di blob kredensial (`tokenDiperpanjangPada`), bukan di kolom baru, karena hanya tugas
// ini yang membacanya.
//
// Hanya kredensial yang tersimpan di basis data (halaman Akun Instagram). Token dari env
// tidak bisa ditulis balik, jadi pemakainya bertanggung jawab memperbaruinya sendiri.

export const JEDA_PERPANJANG_MS = 7 * 24 * 60 * 60 * 1000;
const SEHARI_MS = 24 * 60 * 60 * 1000;

type Kredensial = Record<string, string>;

export type HasilPerpanjang = "tidak-ada-kredensial" | "belum-waktunya" | "diperpanjang" | "gagal" | "berubah";

export async function perpanjangTokenInstagram(
  opsi: { sekarang?: Date; fetchFn?: typeof fetch } = {},
): Promise<HasilPerpanjang> {
  const sekarang = opsi.sekarang ?? new Date();
  const ambil = opsi.fetchFn ?? fetch;
  const baris = await prisma.vendorConfig.findUnique({ where: { vendor: "instagram" } });
  // Tetap diperpanjang walau vendornya sedang dinonaktifkan: perpanjangan tidak mengirim
  // pesan apa pun, dan token 60 hari yang dibiarkan selama jeda antarsurvei akan kedaluwarsa
  // tanpa bisa diperpanjang lagi.
  if (!baris?.credentials) return "tidak-ada-kredensial";
  const lama = decryptJson<Kredensial>(baris.credentials);
  if (!lama.accessToken) return "tidak-ada-kredensial";

  const terakhir = Date.parse(lama.tokenDiperpanjangPada ?? "");
  if (Number.isFinite(terakhir) && sekarang.getTime() - terakhir < JEDA_PERPANJANG_MS) return "belum-waktunya";

  // Token di query string memang bentuk yang diminta endpoint ini (tanpa versi Graph).
  const url =
    "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=" +
    encodeURIComponent(lama.accessToken);
  let json: { access_token?: unknown; expires_in?: unknown; error?: { message?: unknown; code?: unknown } } = {};
  let ok = false;
  try {
    const res = await ambil(url);
    json = (await res.json().catch(() => ({}))) as typeof json;
    ok = res.ok && typeof json.access_token === "string" && json.access_token.length > 0;
  } catch (e) {
    json = { error: { message: e instanceof Error ? e.message : String(e) } };
  }
  if (!ok) {
    // Pesan galat Meta saja yang dicatat — tidak pernah tokennya.
    logError("backend", new Error("Perpanjangan token Instagram gagal"), {
      galat: json.error?.message ?? null,
      kode: json.error?.code ?? null,
    });
    return "gagal";
  }

  // Dibaca ULANG sebelum menulis: operator bisa saja menyimpan token baru di halaman Akun
  // Instagram selama permintaan tadi berjalan. Token barunya tidak boleh tertimpa token
  // perpanjangan dari token lama.
  const kini = await prisma.vendorConfig.findUnique({ where: { vendor: "instagram" } });
  const terbaru = kini?.credentials ? decryptJson<Kredensial>(kini.credentials) : null;
  if (!terbaru || terbaru.accessToken !== lama.accessToken) return "berubah";

  const gabung: Kredensial = {
    ...terbaru,
    accessToken: json.access_token as string,
    tokenDiperpanjangPada: sekarang.toISOString(),
  };
  if (Number.isFinite(Number(json.expires_in)))
    gabung.tokenBerlakuSampai = new Date(sekarang.getTime() + Number(json.expires_in) * 1000).toISOString();
  // Ditulis hanya bila blobnya masih persis yang dibaca tadi (compare-and-swap): penyimpanan
  // oleh operator di antara pembacaan dan penulisan ini mengenkripsi ulang blobnya, sehingga
  // penulisan ini batal alih-alih menimpa token baru operator.
  const tulis = await prisma.vendorConfig.updateMany({
    where: { vendor: "instagram", credentials: kini!.credentials },
    data: { credentials: encryptJson(gabung) },
  });
  if (tulis.count === 0) return "berubah";
  await loadProviders();
  return "diperpanjang";
}

// Dijalankan di proses backend: pemilik registry vendor yang menjawab webhook. Sekali saat
// mulai (setelah jeda singkat, supaya tidak berebut dengan start-up), lalu tiap 24 jam.
// Galat apa pun dicatat dan tidak pernah menghentikan proses.
export function jadwalkanPerpanjangTokenInstagram(): () => void {
  const jalan = () =>
    void perpanjangTokenInstagram().catch((e) => logError("backend", e, { scope: "perpanjangTokenInstagram" }));
  const awal = setTimeout(jalan, 60_000);
  const berkala = setInterval(jalan, SEHARI_MS);
  awal.unref();
  berkala.unref();
  return () => {
    clearTimeout(awal);
    clearInterval(berkala);
  };
}
