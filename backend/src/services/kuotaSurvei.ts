import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { periksaKuota, semuaSurveiPenuh, type HasilKuota } from "../lib/kuota.js";
import { kodeProvinsiDari } from "../lib/wilayah.js";

// Pengambilan angka kuota dari database. Aturannya sendiri ada di lib/kuota.ts.

// Provinsi dari atribut kontak hasil impor.
//
// Ini yang membuat kuota per provinsi benar-benar MENEKAN BIAYA: untuk kontak hasil impor,
// provinsinya sudah diketahui SEBELUM pesan dikirim, sehingga penerima dari provinsi yang
// kuotanya penuh bisa dilewati tanpa satu pesan pun terkirim. Untuk responden organik yang
// datang sendiri, provinsinya baru diketahui dari jawabannya — di situ kuota hanya bisa
// menjaga jumlah data, bukan mencegah biaya.
export function provinsiDariAtribut(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const obj = attributes as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "provinsi" || key === "province" || key === "prov") {
      const kode = kodeProvinsiDari(v);
      if (kode) return kode;
    }
  }
  return null;
}

// Syarat sebuah respons DIHITUNG ke kuota: selesai, bukan penolakan consent, dan bukan
// respons yang ditolak karena kuotanya sudah penuh.
// Dipakai di sini maupun di layar Kuota, supaya angka yang menutup survei dan angka yang
// dilihat pemakai tidak pernah berbeda.
export const DIHITUNG_KE_KUOTA = { completedAt: { not: null }, consentDitolak: false, ditolakKuotaPada: null } as const;

export type KuotaSurvei = {
  targetGlobal: number | null;
  terisiGlobal: number;
  targetProvinsi: number | null;
  terisiProvinsi: number;
};

type Db = typeof prisma | Prisma.TransactionClient;

// Angka kuota saat ini. kodeProvinsi null = provinsi responden belum diketahui, sehingga
// batas per provinsi tidak bisa (dan tidak boleh) diterapkan.
//
// `db` bisa berupa klien transaksi: tutupRespons() menghitung DI DALAM kuncinya, supaya
// angka yang dibaca sudah memuat respons yang baru saja diterima pemegang kunci sebelumnya.
export async function angkaKuota(surveyId: string, kodeProvinsi: string | null, db: Db = prisma): Promise<KuotaSurvei> {
  const [survey, terisiGlobal, kuotaProv, terisiProvinsi] = await Promise.all([
    db.survey.findUnique({ where: { id: surveyId }, select: { targetResponden: true } }),
    // Yang dihitung HANYA responden selesai yang tidak ditolak — lihat catatan di
    // lib/kuota.ts dan pada DIHITUNG_KE_KUOTA di atas.
    db.surveyResponse.count({ where: { surveyId, ...DIHITUNG_KE_KUOTA } }),
    kodeProvinsi
      ? db.kuotaProvinsi.findUnique({ where: { surveyId_kodeProvinsi: { surveyId, kodeProvinsi } } })
      : Promise.resolve(null),
    kodeProvinsi
      ? db.surveyResponse.count({ where: { surveyId, kodeProvinsi, ...DIHITUNG_KE_KUOTA } })
      : Promise.resolve(0),
  ]);
  return {
    targetGlobal: survey?.targetResponden ?? null,
    terisiGlobal,
    targetProvinsi: kuotaProv?.target ?? null,
    terisiProvinsi,
  };
}

export async function bolehMulaiSurvei(surveyId: string, kodeProvinsi: string | null): Promise<HasilKuota> {
  return periksaKuota(await angkaKuota(surveyId, kodeProvinsi));
}

// Pesan penolakan. Sengaja MENJAWAB, bukan mendiamkan: kebisuan terbaca seperti nomor mati
// dan merusak kepercayaan justru pada orang yang bersedia ikut. Satu pesan service jauh
// lebih murah daripada satu set jawaban yang tidak terpakai.
//
// SATU teks untuk penolakan global maupun per provinsi, tanpa nama wilayah atau angka apa
// pun. Pesan lama berbunyi "kuota untuk wilayah Jawa Barat sudah terpenuhi" — itu
// membocorkan rancangan sampel: responden jadi tahu wilayah mana yang masih dicari, dan
// cukup mengaku tinggal di sana untuk lolos. Rinciannya tetap ada untuk operator, di layar
// Kuota dan laporan blast.
//
// Teks yang sama dipakai di DUA momen: sebelum survei dimulai, dan sesudah responden
// selesai mengisi formulir Flow. Karena itu kalimatnya tidak boleh mengandaikan salah
// satunya — "kami tidak dapat menerima jawaban baru" terbaca kasar bagi orang yang baru
// saja menghabiskan sepuluh menit mengisi.
export const PESAN_KUOTA_PENUH_BAWAAN =
  "Terima kasih atas kesediaan Anda. Kuota responden survei ini sudah terpenuhi, sehingga kami tidak dapat mengikutsertakan jawaban baru. 🙏";

export function pesanKuotaPenuh(teksSurvei: string | null | undefined): string {
  return teksSurvei?.trim() || PESAN_KUOTA_PENUH_BAWAAN;
}

// Keadaan kuota seluruh survei yang BERJALAN. Dipakai Agen AI untuk berhenti membalas
// ketika tak ada lagi responden yang bisa diterima.
//
// Dibaca langsung tiap kali dibutuhkan, tanpa cache: dua query ringan, dan hanya berjalan
// pada pesan bebas yang tidak tertangani aturan Auto Reply. Cache akan menukar beban yang
// nyaris nol dengan kemungkinan Agen AI menolak membalas berdasarkan angka basi — tepat
// setelah operator menaikkan target karena ingin melanjutkan.
export async function statusKuotaSurveiAktif(): Promise<{
  semuaPenuh: boolean;
  survei: { id: string; judul: string; target: number | null; terisi: number }[];
}> {
  const aktif = await prisma.survey.findMany({
    where: { status: "active" },
    select: { id: true, title: true, targetResponden: true },
  });
  if (!aktif.length) return { semuaPenuh: false, survei: [] };

  const hitung = await prisma.surveyResponse.groupBy({
    by: ["surveyId"],
    where: { surveyId: { in: aktif.map((s) => s.id) }, ...DIHITUNG_KE_KUOTA },
    _count: { _all: true },
  });
  const terisiPer = new Map(hitung.map((h) => [h.surveyId, h._count._all]));

  const survei = aktif.map((s) => ({
    id: s.id,
    judul: s.title,
    target: s.targetResponden ?? null,
    terisi: terisiPer.get(s.id) ?? 0,
  }));
  return { semuaPenuh: semuaSurveiPenuh(survei), survei };
}

// Provinsi yang sudah diketahui SEBELUM survei dimulai.
//
// Atribut kontak hasil impor lebih dulu. Bila tak ada, provinsi yang pernah dijawab kontak
// ini di survei yang sama: orang yang ditolak karena kuota provinsinya penuh lalu mengetik
// kata pemicu lagi ditolak saat itu juga — bukan dikirimi ulang pertanyaan demi pertanyaan
// sampai ia menjawab provinsi yang sama dan ditolak lagi.
export async function provinsiAwal(surveyId: string, contactId: string, attributes: unknown): Promise<string | null> {
  const dariAtribut = provinsiDariAtribut(attributes);
  if (dariAtribut) return dariAtribut;
  const lalu = await prisma.surveyResponse.findFirst({
    where: { surveyId, contactId, kodeProvinsi: { not: null } },
    orderBy: { startedAt: "desc" },
    select: { kodeProvinsi: true },
  });
  return lalu?.kodeProvinsi ?? null;
}

// ===== Menutup respons =====
//
// Respons ditandai selesai — atau ditolak karena kuotanya penuh — dalam SATU langkah yang
// terkunci per survei. Tanpa kunci, dua responden yang selesai hampir bersamaan sama-sama
// membaca "terisi 1 dari 2", sama-sama lolos, dan kuotanya jebol jadi 3.
//
// Kuncinya advisory lock transaksi Postgres: dilepas otomatis saat transaksi berakhir,
// termasuk bila prosesnya mati di tengah jalan, dan hanya menahan penutupan respons survei
// yang sama — survei lain, dan responden yang masih mengisi, tidak ikut menunggu. Pemegang
// kunci berikutnya baru menghitung setelah pemegang sebelumnya commit, jadi angkanya sudah
// memuat respons yang baru saja diterima.
export type HasilTutup = { diterima: true } | { diterima: false };

// Menahan kunci kuota sebuah survei sampai transaksinya berakhir.
//
// $executeRaw, bukan $queryRaw: pg_advisory_xact_lock mengembalikan void, dan $queryRaw
// gagal membaca kolom bertipe void. Kuncinya teks yang di-hash ke bigint, jadi tidak perlu
// tabel atau baris apa pun sebagai mutex.
async function kunciKuota(tx: Prisma.TransactionClient, surveyId: string): Promise<void> {
  const kunci = `kuota:${surveyId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${kunci}::text, 0))`;
}

// timeout: menunggu kunci ikut dihitung ke batas waktu transaksi. Pemegangnya hanya
// menjalankan beberapa query ringan, jadi antrean yang panjang pun selesai jauh di bawahnya.
//
// maxWait: berapa lama boleh menunggu koneksi dari pool SEBELUM transaksinya dimulai.
// Bawaan Prisma hanya 2 detik, padahal update biasa yang dulu dipakai di sini boleh
// menunggu 10 detik (pool_timeout). Tanpa penyetaraan ini, ledakan callback status blast
// cukup untuk membuat penutupan gagal — dan galatnya ditelan webhook, sehingga respons
// tertinggal tanpa completedAt.
const OPSI_TRANSAKSI = { maxWait: 10_000, timeout: 15_000 } as const;

export async function tutupRespons(
  responseId: string,
  ubah: { currentStep?: number; consentDitolak?: boolean } = {},
): Promise<HasilTutup> {
  return prisma.$transaction(async (tx) => {
    const awal = await tx.surveyResponse.findUnique({ where: { id: responseId }, select: { surveyId: true } });
    if (!awal) return { diterima: true };
    await kunciKuota(tx, awal.surveyId);

    // Dibaca ulang SETELAH kunci didapat: respons yang sama bisa sudah ditutup proses lain
    // lebih dulu (webhook yang dikirim ulang Meta).
    const r = await tx.surveyResponse.findUnique({
      where: { id: responseId },
      select: { surveyId: true, kodeProvinsi: true, completedAt: true, consentDitolak: true, ditolakKuotaPada: true },
    });
    if (!r) return { diterima: true };
    // Sudah ditutup — laporkan keputusan yang dulu, jangan memutuskan ulang.
    if (r.completedAt) return { diterima: !r.ditolakKuotaPada };

    const step = typeof ubah.currentStep === "number" ? { currentStep: ubah.currentStep } : {};
    const consentDitolak = ubah.consentDitolak ?? r.consentDitolak;

    // Penolak consent tidak pernah dihitung ke kuota, jadi tidak perlu — dan tidak boleh —
    // ikut ditolak kuota: orang yang baru saja menolak ikut tidak perlu diberi tahu bahwa
    // kuotanya penuh, dan dua penanda itu dilaporkan terpisah di layar Kuota.
    //
    // Hitungan diambil SEBELUM completedAt dicap. Respons yang sedang diputuskan belum
    // selesai, jadi belum ikut terhitung — kalau urutannya dibalik, ia menghitung dirinya
    // sendiri dan setiap survei berhenti satu responden sebelum targetnya.
    if (!consentDitolak) {
      const hasil = periksaKuota(await angkaKuota(r.surveyId, r.kodeProvinsi, tx));
      if (!hasil.boleh) {
        await tx.surveyResponse.update({
          where: { id: responseId },
          data: { ...step, completedAt: new Date(), ditolakKuotaPada: new Date(), alasanDitolakKuota: hasil.alasan },
        });
        return { diterima: false };
      }
    }
    await tx.surveyResponse.update({
      where: { id: responseId },
      data: { ...step, completedAt: new Date(), consentDitolak },
    });
    return { diterima: true };
  }, OPSI_TRANSAKSI);
}

// Tolak respons yang masih berjalan karena kuotanya sudah penuh. Dipakai di tengah survei
// mode chat, begitu provinsi responden diketahui — sisa pertanyaannya tidak perlu dikirim.
//
// Tanpa kunci: menolak tidak pernah membuat kuota jebol. Kalaupun ada jatah yang terbuka
// sesaat kemudian, yang terlewat hanya satu responden, bukan data yang salah hitung.
//
// Tapi BERSYARAT completedAt kosong. Responden yang mengirim jawaban yang sama dua kali
// hampir bersamaan menghasilkan dua webhook; bila yang pertama sudah menutup respons dan
// DITERIMA, yang kedua menghitung respons itu sendiri sebagai pemakan jatah, lalu
// membaliknya jadi ditolak — padahal barisnya sudah terdorong ke Google Sheets.
// Mengembalikan false bila respons sudah diputuskan proses lain: jangan kirim pesan apa pun.
export async function tolakKarenaKuota(responseId: string, alasan: "global" | "provinsi"): Promise<boolean> {
  const { count } = await prisma.surveyResponse.updateMany({
    where: { id: responseId, completedAt: null },
    data: { completedAt: new Date(), ditolakKuotaPada: new Date(), alasanDitolakKuota: alasan },
  });
  return count > 0;
}

// Pulihkan respons yang dulu ditolak kuota, bila kini ada jatahnya. Dipakai skrip
// pulihkan:kuota setelah klien menaikkan target.
//
// Lewat kunci yang SAMA dengan tutupRespons(): pemulihan berebut jatah dengan responden
// yang sedang selesai, dan tanpa kunci keduanya bisa sama-sama mengambil jatah terakhir.
export type HasilPulih = "dipulihkan" | "masih-penuh" | "sudah-diterima" | "bukan-tolakan";

export async function pulihkanRespons(responseId: string): Promise<HasilPulih> {
  return prisma.$transaction(async (tx) => {
    const awal = await tx.surveyResponse.findUnique({ where: { id: responseId }, select: { surveyId: true } });
    if (!awal) return "bukan-tolakan";
    await kunciKuota(tx, awal.surveyId);

    const r = await tx.surveyResponse.findUnique({
      where: { id: responseId },
      select: { surveyId: true, contactId: true, kodeProvinsi: true, ditolakKuotaPada: true },
    });
    if (!r?.ditolakKuotaPada) return "bukan-tolakan";
    // Orangnya sudah punya respons lain yang DITERIMA di survei ini — biasanya karena ia
    // mengisi ulang setelah kuotanya dinaikkan, sebelum skrip pemulihan dijalankan.
    // Memulihkan yang lama membuatnya tercatat dua kali: dobel di kuota, di ekspor, dan di
    // Google Sheets yang barisnya tak bisa ditarik lagi. Survei yang boleh diulang pun
    // sengaja ikut dilewati: melewatkan satu pengisian masih bisa diperiksa operator di tab
    // "Ditolak kuota", sedangkan baris ganda di spreadsheet tidak bisa dibatalkan.
    const sudahAda = await tx.surveyResponse.findFirst({
      where: {
        surveyId: r.surveyId,
        contactId: r.contactId,
        id: { not: responseId },
        completedAt: { not: null },
        ditolakKuotaPada: null,
      },
      select: { id: true },
    });
    if (sudahAda) return "sudah-diterima";
    if (!periksaKuota(await angkaKuota(r.surveyId, r.kodeProvinsi, tx)).boleh) return "masih-penuh";
    await tx.surveyResponse.update({
      where: { id: responseId },
      data: { ditolakKuotaPada: null, alasanDitolakKuota: null },
    });
    return "dipulihkan";
  }, OPSI_TRANSAKSI);
}

// Stempel provinsi pada respons. Dipanggil saat provinsi diketahui — dari atribut kontak
// ketika survei dimulai, atau dari jawaban wilayah ketika formulir masuk.
//
// Jawaban responden MENIMPA tebakan dari atribut impor: yang mengisi tahu domisilinya
// sendiri, sedangkan atribut impor bisa usang atau salah kolom.
export async function stempelProvinsi(responseId: string, kodeProvinsi: string | null): Promise<void> {
  if (!kodeProvinsi) return;
  await prisma.surveyResponse.update({ where: { id: responseId }, data: { kodeProvinsi } }).catch(() => {});
}
