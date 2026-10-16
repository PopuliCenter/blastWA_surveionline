-- Lokasi responden: diminta setelah survei selesai, untuk verifikasi wilayah dan peta sebaran.
--
-- Semua kolom nullable atau berbawaan sehingga baris yang ada tidak perlu disentuh:
--   Survey.mintaLokasi                   minta lokasi setelah selesai (bawaan: tidak)
--   Survey.pesanMintaLokasi              teks permintaan khusus survei; null = teks bawaan
--   SurveyResponse.lokasiDimintaPada     kapan permintaan dikirim
--   SurveyResponse.lokasiPesanId         ID pesan permintaan di vendor (dicocokkan dengan context.id)
--   SurveyResponse.lokasiDiterimaPada    kapan lokasi dibagikan
--   SurveyResponse.lokasiLat/lokasiLng   titik yang SUDAH dibulatkan ke dua desimal (±1,1 km)
--   SurveyResponse.kodeProvinsiLokasi    provinsi menurut titik aslinya
--
-- Titik GPS mentah tidak pernah disimpan: provinsinya dihitung dulu, lalu titiknya dibulatkan.
ALTER TABLE "Survey" ADD COLUMN "mintaLokasi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Survey" ADD COLUMN "pesanMintaLokasi" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "lokasiDimintaPada" TIMESTAMP(3);
ALTER TABLE "SurveyResponse" ADD COLUMN "lokasiPesanId" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "lokasiDiterimaPada" TIMESTAMP(3);
ALTER TABLE "SurveyResponse" ADD COLUMN "lokasiLat" DOUBLE PRECISION;
ALTER TABLE "SurveyResponse" ADD COLUMN "lokasiLng" DOUBLE PRECISION;
ALTER TABLE "SurveyResponse" ADD COLUMN "kodeProvinsiLokasi" TEXT;
