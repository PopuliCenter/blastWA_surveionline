import { prisma } from "../db.js";

// Daftar penekan opt-out — nomor yang pernah menyatakan BERHENTI.
//
// Terpisah dari Contact dan tidak ikut terhapus bersamanya. Dulu penolakan hanya hidup
// sebagai Contact.subscribed = false, sehingga menghapus kontaknya menghapus pula jejak
// penolakannya: nomor yang sama bisa diimpor ulang dari berkas lama lalu dihubungi lagi
// seolah tak pernah menolak. Daftar inilah yang membuat penolakan bertahan.
//
// Berkas ini sengaja dipisah dari lib/optOut.ts: yang itu murni pencocokan teks tanpa
// database, yang ini murni urusan penyimpanan.

export type OptOutReason = "pesan berhenti" | "manual" | "impor";

// Catat penolakan. Idempoten: tanggal pertama kali menolak dipertahankan, karena itulah
// yang bermakna saat ditanya sejak kapan nomor ini tidak boleh dihubungi.
export async function suppressNumber(phone: string, reason: OptOutReason): Promise<void> {
  if (!phone) return;
  await prisma.optOutNumber.upsert({
    where: { phone },
    create: { phone, reason },
    update: {},
  });
}

// Cabut penolakan. HANYA dipanggil saat orangnya sendiri menyatakan berlangganan lagi,
// atau operator mengembalikannya secara sadar lewat halaman Kontak. Tidak pernah
// otomatis, dan tidak pernah sebagai efek samping impor.
export async function unsuppressNumber(phone: string): Promise<void> {
  if (!phone) return;
  await prisma.optOutNumber.deleteMany({ where: { phone } });
}

// Kapan nomor ini menolak — null bila tidak ada di daftar. Mengembalikan tanggalnya,
// bukan sekadar true/false, supaya kontak yang dibuat ulang memakai tanggal penolakan
// ASLI dan bukan hari ini; "menolak sejak kapan" adalah pertanyaan yang akan ditanyakan.
export async function suppressedSince(phone: string): Promise<Date | null> {
  if (!phone) return null;
  const row = await prisma.optOutNumber.findUnique({ where: { phone }, select: { createdAt: true } });
  return row?.createdAt ?? null;
}

// Untuk impor massal: satu kueri untuk seluruh berkas, bukan satu kueri per baris.
// Impor 5.000 nomor dengan pemeriksaan per baris berarti 5.000 perjalanan ke database.
// Memetakan nomor → tanggal menolak, bukan sekadar keanggotaan, agar kontak yang dibuat
// dari impor memakai tanggal penolakan aslinya.
export async function suppressedAmong(phones: string[]): Promise<Map<string, Date>> {
  const unik = [...new Set(phones.filter(Boolean))];
  if (!unik.length) return new Map();
  const rows = await prisma.optOutNumber.findMany({
    where: { phone: { in: unik } },
    select: { phone: true, createdAt: true },
  });
  return new Map(rows.map((r) => [r.phone, r.createdAt]));
}
