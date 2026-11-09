-- Pembuka dan penutup khusus responden Instagram (survei di sana selalu chatbot).
-- Kosong = memakai deskripsi dan kata penutup yang sama dengan WhatsApp.
ALTER TABLE "Survey" ADD COLUMN "pembukaInstagram" TEXT;
ALTER TABLE "Survey" ADD COLUMN "penutupInstagram" TEXT;
