-- Gambar banner pesan pembuka survei: header pesan Flow (mode flow) atau
-- pesan bergambar ber-caption (mode chat). Dikirim dalam sesi 24 jam (bebas, tanpa template).
ALTER TABLE "Survey" ADD COLUMN "bannerUrl" TEXT;
