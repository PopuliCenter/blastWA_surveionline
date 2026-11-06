import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { getProvider } from "../providers/registry.js";
import type { InstagramAdapter } from "../providers/instagram.js";

// Callback privasi yang DIWAJIBKAN Meta untuk aplikasi Instagram Login (Platform Terms §4):
// URL permintaan penghapusan data dan URL deauthorize, keduanya diisi di dasbor aplikasi.
// Dipanggil server Meta, jadi tanpa login; keasliannya dijamin signed_request yang
// ditandatangani App Secret Instagram (lib di providers/instagram.ts).
//
// Yang dikirim Meta adalah ID pengguna yang MENGOTORISASI aplikasi — yaitu pemilik akun
// Instagram bisnis yang disambungkan, bukan responden yang mengirim DM. Karena itu
// permintaannya dicatat untuk ditindaklanjuti operator (mis. menghapus kredensial di halaman
// Akun Instagram), bukan menghapus otomatis: penghapusan kredensial diam-diam memutus survei
// yang sedang berjalan, dan permintaannya bisa saja datang dari akun penguji.
//
// Catatannya disimpan di WebhookLog (event "hapus-data"/"deauthorize"), sehingga ikut aturan
// retensi tabel itu (WEBHOOK_LOG_RETENTION_DAYS); halaman status hanya mengenal kode dalam
// rentang itu.

// Plafon yang sama dengan webhook (routes/webhooks.ts): endpoint publik, dipanggil Meta.
const BATAS = { config: { rateLimit: { max: 6000, timeWindow: "1 minute" } } };

function ambilSignedRequest(req: FastifyRequest): unknown {
  const b = req.body as Record<string, unknown> | string | undefined;
  if (typeof b === "string") return new URLSearchParams(b).get("signed_request");
  return b?.signed_request;
}

function adaptor(): InstagramAdapter | null {
  try {
    return getProvider("instagram") as InstagramAdapter;
  } catch {
    return null;
  }
}

async function catat(event: string, status: string, payload: unknown, note?: string) {
  await prisma.webhookLog.create({ data: { vendor: "instagram", event, status, payload: payload as object, note } });
}

// Halaman status menerima kode yang dibuat di sini saja: 16 karakter heksadesimal.
const POLA_KODE = /^[0-9a-f]{16}$/;

export async function instagramPrivasiRoutes(app: FastifyInstance): Promise<void> {
  // Meta mengirim callback ini sebagai formulir (application/x-www-form-urlencoded), bukan
  // JSON. Parser ini hanya berlaku di dalam plugin ini.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  app.post("/webhook/instagram/hapus-data", BATAS, async (req, reply) => {
    const isi = adaptor()?.bacaSignedRequest(ambilSignedRequest(req)) ?? null;
    if (!isi) {
      await catat("hapus-data", "failed", null, "signed_request tidak sah").catch(() => {});
      return reply.code(400).send({ error: "signed_request tidak sah" });
    }
    const kode = randomBytes(8).toString("hex");
    await catat(
      "hapus-data",
      "success",
      { user_id: isi.user_id ?? null, issued_at: isi.issued_at ?? null },
      `kode:${kode}`,
    );
    req.log.warn({ kode }, "Permintaan penghapusan data Instagram diterima — perlu ditindaklanjuti operator");
    // Alamat publik dari FRONTEND_ORIGIN (di produksi satu domain dengan backend), bukan dari
    // header permintaan: di belakang Cloudflare Flexible dan dua lapis nginx, protokol yang
    // sampai ke sini selalu http, padahal tautan ini ditampilkan Meta kepada pengguna.
    const asal = env.FRONTEND_ORIGIN.startsWith("https://") ? env.FRONTEND_ORIGIN : `${req.protocol}://${req.host}`;
    const url = `${asal.replace(/\/+$/, "")}/webhook/instagram/hapus-data/${kode}`;
    return { url, confirmation_code: kode };
  });

  app.get("/webhook/instagram/hapus-data/:kode", BATAS, async (req, reply) => {
    const kode = String((req.params as { kode: string }).kode ?? "").toLowerCase();
    const baris = POLA_KODE.test(kode)
      ? await prisma.webhookLog.findFirst({
          where: { vendor: "instagram", event: "hapus-data", status: "success", note: `kode:${kode}` },
          select: { createdAt: true },
        })
      : null;
    reply.type("text/plain; charset=utf-8");
    if (!baris)
      return reply.code(404).send(`Kode ${kode || "-"} tidak dikenal, atau catatannya sudah melewati masa simpan.`);
    return (
      `Permintaan penghapusan data dengan kode ${kode} diterima pada ${baris.createdAt.toISOString()} ` +
      `dan sedang diproses oleh pengelola Populi Center.`
    );
  });

  app.post("/webhook/instagram/deauthorize", BATAS, async (req, reply) => {
    const isi = adaptor()?.bacaSignedRequest(ambilSignedRequest(req)) ?? null;
    if (!isi) {
      await catat("deauthorize", "failed", null, "signed_request tidak sah").catch(() => {});
      return reply.code(400).send({ error: "signed_request tidak sah" });
    }
    await catat("deauthorize", "success", { user_id: isi.user_id ?? null, issued_at: isi.issued_at ?? null });
    // Setelah deauthorize, token akun itu tidak berlaku lagi: DM berhenti masuk dan balasan
    // gagal. Diperingatkan di log supaya operator menyambungkan ulang di halaman Akun Instagram.
    req.log.warn("Aplikasi Instagram dicabut aksesnya (deauthorize) — sambungkan ulang di halaman Akun Instagram");
    return { ok: true };
  });
}
