-- Respons yang datang saat kuota sudah penuh ditolak, dan pesan penolakannya bisa diatur.
--
-- Dulu kuota hanya diperiksa saat survei DIMULAI. Responden yang provinsinya baru diketahui
-- dari jawabannya lolos pemeriksaan itu, lalu tetap terhitung — kejadian nyata: kuota
-- Jawa Barat 2, terisi 3, dan baris ketiganya masuk ke ekspor maupun Google Sheets.
--
-- Tiga kolom, semuanya nullable sehingga baris yang ada tidak perlu disentuh:
--   SurveyResponse.ditolakKuotaPada    kapan sistem menolaknya karena kuota sudah penuh
--   SurveyResponse.alasanDitolakKuota  "global" atau "provinsi"
--   Survey.pesanKuotaPenuh             balasan penolakan khusus survei; null = teks bawaan
--
-- Sengaja TIDAK menandai baris lama secara surut. Baris yang sudah terdorong ke Google
-- Sheets tidak bisa ditarik kembali, jadi menandainya hanya membuat Sheets dan Excel
-- berbeda selamanya. Lagi pula tidak ada aturan objektif mana yang "kelebihan".
--
-- Indeks kuota juga tidak disentuh: respons yang ditolak hanya sebagian kecil, jadi
-- menambahkannya ke indeks tidak mengubah selektivitas — sama seperti completedAt.
ALTER TABLE "SurveyResponse" ADD COLUMN "ditolakKuotaPada" TIMESTAMP(3);
ALTER TABLE "SurveyResponse" ADD COLUMN "alasanDitolakKuota" TEXT;
ALTER TABLE "Survey" ADD COLUMN "pesanKuotaPenuh" TEXT;
