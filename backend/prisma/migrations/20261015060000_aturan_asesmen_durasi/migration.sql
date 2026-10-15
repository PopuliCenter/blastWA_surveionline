-- Aturan asesmen durasi bisa diatur sendiri per survei.
--
-- Satu kolom, nullable sehingga survei yang ada tidak perlu disentuh:
--   Survey.aturanDurasi  batas menit dan label kolom "Asesmen Durasi"; null = aturan bawaan
--
-- Ambang yang tetap (2 / 10 / 30 menit) tidak cocok untuk semua instrumen: lama pengisian
-- yang wajar bergantung pada jumlah pertanyaannya.
ALTER TABLE "Survey" ADD COLUMN "aturanDurasi" JSONB;
