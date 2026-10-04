-- Penolak consent dikecualikan dari kuota responden.
--
-- Responden yang menolak pada pertanyaan bertipe consent tetap tercatat "selesai" —
-- surveinya memang berakhir di situ lewat percabangan goto:end. Tapi responsnya tidak
-- mengandung data apa pun, sementara kuota global menghitungnya. Akibatnya target 1.200
-- bisa tercapai dengan data terpakai jauh di bawah itu, dan klien mengira sudah menerima
-- 1.200. Klien membayar untuk data, bukan untuk penolakan.
--
-- Disimpan sebagai penanda, bukan dihitung ulang dari tabel Answer setiap kali: pemeriksaan
-- kuota berjalan pada SETIAP pesan masuk dan SETIAP pengiriman blast. Menelusuri jawaban
-- tiap kali berarti subkueri ke ratusan ribu baris pada jalur yang paling sering dilewati.
ALTER TABLE "SurveyResponse" ADD COLUMN "consentDitolak" BOOLEAN NOT NULL DEFAULT false;

-- Isi mundur dari data yang sudah ada. Jawaban consent disimpan persis sebagai "Ya"/"Tidak"
-- (lihat validateAnswer dan toAnswer), jadi pencocokannya pasti, bukan tebakan.
UPDATE "SurveyResponse" r
SET "consentDitolak" = true
WHERE EXISTS (
  SELECT 1 FROM "Answer" a
  JOIN "Question" q ON q."id" = a."questionId"
  WHERE a."responseId" = r."id" AND q."type" = 'consent' AND lower(trim(a."value")) = 'tidak'
);

CREATE INDEX "SurveyResponse_surveyId_consentDitolak_idx" ON "SurveyResponse"("surveyId", "consentDitolak");
