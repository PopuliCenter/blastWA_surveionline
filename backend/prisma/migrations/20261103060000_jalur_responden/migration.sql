-- Asal responden, supaya mutu dan biaya tiap jalur bisa dibandingkan (lib/jalurRespons.ts).
--   SurveyResponse.saluran      whatsapp | instagram | facebook (semua respons lama: whatsapp)
--   SurveyResponse.jalurMasuk   broadcast | kata-pemicu | iklan; null = sebelum fitur ini ada
--   SurveyResponse.metode       form | chatbot; null = sebelum fitur ini ada
--   SurveyResponse.iklanId/iklanJudul  iklan asal respons ini
--   Contact.iklanId/iklanJudul/iklanPada  iklan terakhir yang diketuk (berlaku 72 jam)
-- Hanya menambah kolom; tidak ada baris lama yang ditulis ulang.
ALTER TABLE "Contact" ADD COLUMN "iklanId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "iklanJudul" TEXT;
ALTER TABLE "Contact" ADD COLUMN "iklanPada" TIMESTAMP(3);
ALTER TABLE "SurveyResponse" ADD COLUMN "saluran" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "SurveyResponse" ADD COLUMN "jalurMasuk" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "metode" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "iklanId" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "iklanJudul" TEXT;
