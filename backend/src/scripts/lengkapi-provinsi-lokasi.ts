/**
 * Lengkapi provinsi untuk lokasi yang masuk SEBELUM data batas provinsi dipasang.
 *
 * Kenapa perlu: provinsi dari lokasi dihitung saat lokasinya tiba. Selama
 * backend/data/batas-provinsi.json belum ada, lokasi tetap tersimpan tetapi provinsinya
 * kosong ("Provinsi belum dapat ditentukan"). Setelah data batas dipasang, daftar respons
 * menghitungnya setiap kali dibuka; skrip ini menyimpannya permanen, sehingga tidak perlu
 * dihitung ulang dan ikut terbaca oleh apa pun yang membaca kolomnya langsung.
 *
 * Dihitung dari titik yang tersimpan (sudah dibulatkan ±1 km), karena titik aslinya memang
 * tidak pernah disimpan. Untuk lokasi yang jauh dari perbatasan hasilnya sama; di dekat
 * garis batas bisa jatuh ke provinsi tetangga, jadi jumlahnya disebutkan dalam ringkasan.
 *
 * Pemakaian (dari folder backend/, SETELAH data batas dipasang):
 *   npm run lengkapi:lokasi            # hanya menampilkan rencana, tidak menulis
 *   npm run lengkapi:lokasi -- --apply # benar-benar menyimpan
 *
 * Aman diulang: hanya menyentuh lokasi yang provinsinya masih kosong.
 *
 * Berkas ini sengaja berada di dalam src/ supaya ikut ter-compile ke dist/ dan bisa
 * dijalankan di container produksi.
 */
import { prisma } from "../db.js";
import { batasTerpasang, provinsiDariTitik } from "../services/petaProvinsi.js";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (!(await batasTerpasang())) {
    console.log(
      "Data batas provinsi belum terpasang (backend/data/batas-provinsi.json). Tidak ada yang bisa dihitung.",
    );
    process.exitCode = 1;
    return;
  }

  const kosong = await prisma.surveyResponse.findMany({
    where: { lokasiDiterimaPada: { not: null }, kodeProvinsiLokasi: null, lokasiLat: { not: null } },
    select: { id: true, lokasiLat: true, lokasiLng: true },
  });
  let ketemu = 0;
  const perProvinsi = new Map<string, number>();
  for (const r of kosong) {
    if (r.lokasiLat == null || r.lokasiLng == null) continue;
    const kode = await provinsiDariTitik({ lat: r.lokasiLat, lng: r.lokasiLng });
    if (!kode) continue;
    ketemu++;
    perProvinsi.set(kode, (perProvinsi.get(kode) ?? 0) + 1);
    if (apply)
      await prisma.surveyResponse.updateMany({
        where: { id: r.id, kodeProvinsiLokasi: null },
        data: { kodeProvinsiLokasi: kode },
      });
  }

  console.log(`Lokasi tanpa provinsi: ${kosong.length}`);
  console.log(`Provinsinya bisa ditentukan: ${ketemu} (sisanya memang di laut / luar negeri)`);
  for (const [k, n] of [...perProvinsi.entries()].sort()) console.log(`  ${k}: ${n}`);
  console.log(apply ? "Disimpan." : "Belum disimpan — jalankan dengan --apply untuk menyimpan.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
