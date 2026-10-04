-- Kuota responden: batas global per survei dan batas per provinsi.
--
-- Permintaan dari klien: survei dibatasi sebarannya, mis. Jawa Barat 200 responden dan
-- Jawa Tengah 150. Tanpa pembatas, satu provinsi yang ramai bisa menghabiskan anggaran
-- pesan sebelum provinsi lain terwakili — datanya timpang DAN biayanya membengkak,
-- karena sejak 1 Oktober 2026 tiap balasan bot ditagih Meta.

-- Batas untuk seluruh survei. null = tanpa batas (perilaku lama).
ALTER TABLE "Survey" ADD COLUMN "targetResponden" INTEGER;

-- Batas per provinsi.
CREATE TABLE "KuotaProvinsi" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "kodeProvinsi" TEXT NOT NULL,
    "target" INTEGER NOT NULL,

    CONSTRAINT "KuotaProvinsi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KuotaProvinsi_surveyId_kodeProvinsi_key" ON "KuotaProvinsi"("surveyId", "kodeProvinsi");
CREATE INDEX "KuotaProvinsi_surveyId_idx" ON "KuotaProvinsi"("surveyId");

ALTER TABLE "KuotaProvinsi" ADD CONSTRAINT "KuotaProvinsi_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Provinsi responden distempel pada responsnya.
--
-- Disimpan, bukan dihitung ulang dari jawaban: penghitungan kuota harus murah (satu
-- groupBy) dan tidak boleh bergantung pada format teks nilai jawaban, yang bisa berubah.
ALTER TABLE "SurveyResponse" ADD COLUMN "kodeProvinsi" TEXT;
CREATE INDEX "SurveyResponse_surveyId_kodeProvinsi_idx" ON "SurveyResponse"("surveyId", "kodeProvinsi");
