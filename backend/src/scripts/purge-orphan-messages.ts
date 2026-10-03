/**
 * Hapus baris Message yatim — pesan yang contactId-nya NULL.
 *
 * Kenapa perlu: sebelum migrasi 20261003090000, relasi Message→Contact memakai SET NULL.
 * Menghapus kontak hanya mengosongkan contactId, sementara baris pesannya tetap tinggal
 * lengkap dengan kolom `payload` berisi muatan webhook mentah — di dalamnya ada nomor
 * telepon dan isi percakapan. Jadi "hapus kontak" tidak pernah benar-benar menghapus data
 * orangnya. Relasinya sudah diubah jadi CASCADE, tapi baris yang terlanjur yatim dari
 * penghapusan masa lalu masih ada dan tidak tersentuh migrasi.
 *
 * Kenapa TIDAK dilakukan di migrasi: menghapus baris lewat migrasi tidak bisa dibatalkan
 * dan berjalan otomatis saat deploy. Sebagian pesan bisa saja ber-contactId NULL karena
 * sebab lain. Jadi dijadikan tindakan sadar: lihat dulu jumlahnya, baru hapus.
 *
 * Pemakaian (dari folder backend/):
 *   npm run purge:orphan-messages            # hanya menampilkan jumlahnya, tidak menghapus
 *   npm run purge:orphan-messages -- --apply # benar-benar menghapus
 *
 * Aman diulang: menjalankannya dua kali tidak menghapus apa pun pada kali kedua.
 *
 * Berkas ini sengaja berada di dalam src/ supaya ikut ter-compile ke dist/ dan bisa
 * dijalankan dengan `node` biasa di image produksi — image itu dibangun dengan
 * `npm ci --omit=dev`, jadi tsx (devDependency) tidak tersedia di sana.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const total = await prisma.message.count({ where: { contactId: null } });
  if (total === 0) {
    console.log("Tidak ada pesan yatim. Tidak ada yang perlu dihapus.");
    return;
  }

  const terlama = await prisma.message.findFirst({
    where: { contactId: null },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const terbaru = await prisma.message.findFirst({
    where: { contactId: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  // Prisma membedakan NULL kolom (DbNull) dari nilai JSON `null`; filter null biasa ditolak.
  const berpayload = await prisma.message.count({ where: { contactId: null, payload: { not: Prisma.DbNull } } });

  console.log(`Pesan yatim (contactId NULL): ${total}`);
  console.log(`  di antaranya masih menyimpan payload webhook: ${berpayload}`);
  console.log(`  rentang waktu: ${terlama?.createdAt.toISOString()} … ${terbaru?.createdAt.toISOString()}`);

  if (!apply) {
    console.log("\nIni hanya pratinjau. Jalankan ulang dengan -- --apply untuk benar-benar menghapus.");
    return;
  }

  const r = await prisma.message.deleteMany({ where: { contactId: null } });
  console.log(`\n${r.count} baris dihapus.`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
