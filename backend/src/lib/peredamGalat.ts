// Peredam galat yang berulang — supaya satu gangguan tidak jadi puluhan entri.
//
// Kejadian nyata: satu deploy membuat worker kehilangan Redis selama beberapa detik.
// ioredis mencoba ulang dengan jeda bertingkat, dua worker mencoba sekaligus, dan tiap
// percobaan dicatat sendiri-sendiri — 34 baris "connect ECONNREFUSED" berstempel waktu
// sama untuk SATU insiden.
//
// Itu bukan sekadar berantakan. Halaman Log Galat baru berguna selama isinya layak dibaca;
// begitu tiap deploy menumpuk puluhan baris identik, galat yang sebenarnya tenggelam dan
// pembacanya belajar mengabaikan seluruh halaman. Alat pemantau lebih sering mati begitu
// daripada karena rusak.
//
// Yang DIHINDARI di sini: membuang galat koneksi diam-diam. Gangguan yang berlanjut harus
// tetap terlihat. Jadi aturannya bukan "catat lebih sedikit", melainkan:
//
//   • galat PERTAMA dicatat seketika — sinyal pertama tidak boleh tertunda;
//   • pengulangan ditahan dan DIHITUNG, lalu dilaporkan berkala dengan jeda yang melebar;
//   • tiap laporan membawa sudah berapa lama gangguannya berlangsung, sehingga keparahan
//     terbaca dari ISI entri, bukan dari banyaknya baris;
//   • saat pulih, ditulis satu ringkasan penutup — tanpa itu Anda melihat gangguan tanpa
//     pernah tahu apakah sudah beres.
//
// Insiden 34 baris tadi menjadi 2: satu saat putus, satu saat pulih.

import { logError } from "./errorLog.js";

// Jeda antar laporan untuk gangguan yang sama, melebar bertahap. Gangguan sejam
// menghasilkan sekitar lima entri, bukan ratusan — tapi tidak pernah nol.
export const JEDA_LAPOR_MS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000] as const;

export type Keputusan =
  | { catat: false }
  | { catat: true; pertama: boolean; ulangan: number; tertahan: number; sejakMs: number };

export type Ringkasan = { ulangan: number; sejakMs: number };

type Catatan = { mulai: number; total: number; dilaporkanPada: number; dilaporkanSaatTotal: number; tingkat: number };

export class PeredamGalat {
  private aktif = new Map<string, Catatan>();

  // Apakah kemunculan galat ini layak ditulis sekarang?
  putuskan(kunci: string, sekarang: number): Keputusan {
    const c = this.aktif.get(kunci);
    if (!c) {
      this.aktif.set(kunci, {
        mulai: sekarang,
        total: 1,
        dilaporkanPada: sekarang,
        dilaporkanSaatTotal: 1,
        tingkat: 0,
      });
      return { catat: true, pertama: true, ulangan: 1, tertahan: 0, sejakMs: 0 };
    }
    c.total++;
    const jeda = JEDA_LAPOR_MS[Math.min(c.tingkat, JEDA_LAPOR_MS.length - 1)]!;
    if (sekarang - c.dilaporkanPada < jeda) return { catat: false };

    const tertahan = c.total - c.dilaporkanSaatTotal;
    c.tingkat++;
    c.dilaporkanPada = sekarang;
    c.dilaporkanSaatTotal = c.total;
    return { catat: true, pertama: false, ulangan: c.total, tertahan, sejakMs: sekarang - c.mulai };
  }

  // Gangguan berakhir. Mengembalikan ringkasan bila memang sedang ada gangguan,
  // null bila tidak — sinyal "pulih" juga datang pada sambungan pertama yang normal,
  // dan itu tidak boleh menghasilkan entri apa pun.
  pulih(kunci: string, sekarang: number): Ringkasan | null {
    const c = this.aktif.get(kunci);
    if (!c) return null;
    this.aktif.delete(kunci);
    return { ulangan: c.total, sejakMs: sekarang - c.mulai };
  }

  // Semua gangguan yang sedang aktif. Dipakai saat sinyal pulih bersifat global
  // (satu koneksi Redis dipakai beberapa worker, masing-masing dengan kuncinya sendiri).
  pulihSemua(sekarang: number): { kunci: string; ringkasan: Ringkasan }[] {
    return [...this.aktif.keys()].map((kunci) => ({ kunci, ringkasan: this.pulih(kunci, sekarang)! }));
  }

  get jumlahAktif(): number {
    return this.aktif.size;
  }
}

// Kunci pengelompokan. Memakai KODE galat bila ada (ECONNREFUSED, ETIMEDOUT) supaya
// alamat yang berubah-ubah — IP container berganti tiap deploy — tidak memecah satu
// gangguan jadi beberapa kelompok. Galat yang benar-benar berbeda tetap berbeda kunci
// dan tidak saling meredam.
export function kunciGalat(scope: string, err: unknown): string {
  const e = err as { code?: unknown; message?: unknown } | null | undefined;
  const kode = e?.code ? String(e.code) : String(e?.message ?? err ?? "galat").slice(0, 80);
  return `${scope}|${kode}`;
}

export function durasiTeks(ms: number): string {
  const detik = Math.round(ms / 1000);
  if (detik < 60) return `${detik} detik`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

// ===== Pemakaian =====

const peredam = new PeredamGalat();

// Pengganti logError untuk galat yang bisa membanjir (event "error" dari worker/antrean).
// Galat diskret — job gagal, exception aplikasi — JANGAN lewat sini: jumlahnya bermakna.
export function logGalatBerulang(source: string, scope: string, err: unknown, context?: Record<string, unknown>): void {
  const k = putusan(scope, err);
  if (!k) return;
  logError(source, err, { scope, ...context, ...k });
}

function putusan(scope: string, err: unknown): Record<string, unknown> | null {
  const d = peredam.putuskan(kunciGalat(scope, err), Date.now());
  if (!d.catat) return null;
  if (d.pertama) return { ulangan: 1 };
  return {
    ulangan: d.ulangan,
    tertahan: d.tertahan,
    berlangsung: durasiTeks(d.sejakMs),
    catatan: `Gangguan yang sama masih berlanjut. ${d.tertahan} kemunculan sejak laporan terakhir tidak ditulis terpisah.`,
  };
}

// Dipanggil saat koneksi pulih. Menutup setiap gangguan yang sedang aktif dengan satu
// entri ringkasan — tanpa ini, log memperlihatkan gangguan tanpa pernah menyatakan selesai.
export function logPulih(source: string, sebab: string): void {
  for (const { kunci, ringkasan } of peredam.pulihSemua(Date.now())) {
    logError(source, `${sebab} pulih setelah ${ringkasan.ulangan}× percobaan dalam ${durasiTeks(ringkasan.sejakMs)}`, {
      scope: kunci.split("|")[0],
      ulangan: ringkasan.ulangan,
      pulih: true,
    });
  }
}
