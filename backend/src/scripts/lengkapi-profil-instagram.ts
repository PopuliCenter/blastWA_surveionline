/**
 * Lengkapi username Instagram kontak lama.
 *
 * Kenapa perlu: username Instagram dulu tidak disimpan tersendiri — ia hanya dipakai mengisi
 * nama kontak yang kosong. Kontak "ig:" dari masa itu (dan yang profilnya dulu gagal terbaca,
 * mis. sebelum izin profil disetujui) tampil sebagai "Instagram · …123456" dan kolom
 * "Username IG"-nya kosong. Mereka terlengkapi sendiri saat DM lagi; skrip ini untuk sisanya.
 *
 * Memakai User Profile API resmi lewat logika yang sama dengan mesin survei
 * (services/profilInstagram.ts): nama yang disunting operator tidak ditimpa, dan waktu cek
 * dicatat juga saat gagal. Meta hanya memberi profil orang yang pernah DM ke akun bisnis —
 * selalu terpenuhi untuk kontak "ig:", karena mereka hanya lahir dari DM masuk.
 *
 * Pemakaian (dari folder backend/):
 *   npm run lengkapi:ig            # hanya menampilkan rencana, tidak memanggil API
 *   npm run lengkapi:ig -- --apply # benar-benar mengambil profil dan menyimpan
 *
 * Aman diulang: hanya menyentuh kontak yang username-nya masih kosong. Ada jeda 300 ms
 * antarpanggilan supaya tidak menabrak batas laju API Meta.
 *
 * Berkas ini sengaja berada di dalam src/ supaya ikut ter-compile ke dist/ dan bisa
 * dijalankan di container produksi.
 */
import { prisma } from "../db.js";
import { getProvider, loadProviders } from "../providers/registry.js";
import { lengkapiProfilKontakLama } from "../services/profilInstagram.js";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  // Kredensial dari Pengaturan (VendorConfig), bukan hanya ENV — sama dengan worker.
  await loadProviders();

  const rencana = await lengkapiProfilKontakLama({ apply: false });
  console.log(`Kontak Instagram tanpa username: ${rencana.tanpaUsername}`);
  console.log(`  di antaranya belum pernah dicek profilnya: ${rencana.belumDicek}`);
  if (!apply) {
    console.log("Belum ada yang diambil — jalankan dengan --apply untuk mengambil profil dan menyimpan.");
    return;
  }
  // Tanpa kredensial, setiap panggilan "gagal" dan waktu ceknya tetap tercatat — hasilnya
  // menyesatkan, jadi berhenti di sini.
  if (!getProvider("instagram").isConfigured()) {
    console.log("Instagram belum tersambung (Pengaturan → Instagram). Tidak ada yang diambil.");
    process.exitCode = 1;
    return;
  }

  const hasil = await lengkapiProfilKontakLama({ apply: true });
  console.log(`Diproses: ${hasil.diproses}`);
  console.log(`  username terisi: ${hasil.berhasil}`);
  console.log(`  profil terbaca tanpa username: ${hasil.tanpaUsernameDariApi}`);
  console.log(`  gagal (izin belum disetujui, akun ditutup, atau batas waktu): ${hasil.gagal}`);
  if (hasil.berhentiDini)
    console.log(
      "Berhenti lebih awal: terlalu banyak gagal beruntun (kemungkinan batas laju Meta). Kontak yang gagal tidak ditandai; jalankan ulang nanti.",
    );
  console.log("Disimpan.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
