-- Opsi pesan lokasi per survei, semuanya opsional — kosong/false = perilaku semula:
--   Survey.lokasiPesanTerpisah  kirim permintaan lokasi sebagai pesan SENDIRI sesudah kata
--                               penutup (bawaan: digabung dalam satu pesan, satu tagihan)
--   Survey.balasanLokasi        balasan setelah lokasi diterima; null = teks bawaan
ALTER TABLE "Survey" ADD COLUMN "lokasiPesanTerpisah" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN "balasanLokasi" TEXT;
