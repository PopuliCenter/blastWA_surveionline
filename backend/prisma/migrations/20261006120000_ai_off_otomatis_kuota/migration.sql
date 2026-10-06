-- Agen AI mati otomatis saat kuota seluruh survei terpenuhi.
--
-- Dua kolom, keduanya nullable/berbawaan sehingga baris yang ada tidak perlu disentuh:
--   offOtomatisPada  kapan sistem mematikannya, untuk dijelaskan di layar
--   izinOffOtomatis  boleh tidak sistem mematikannya lagi; false setelah sekali dimatikan,
--                    supaya penyalaan manual oleh operator tidak dibatalkan sistem
ALTER TABLE "AiConfig" ADD COLUMN "offOtomatisPada" TIMESTAMP(3);
ALTER TABLE "AiConfig" ADD COLUMN "izinOffOtomatis" BOOLEAN NOT NULL DEFAULT true;
