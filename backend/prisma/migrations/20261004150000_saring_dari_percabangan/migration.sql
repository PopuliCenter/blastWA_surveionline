-- Penanda "tersaring keluar" diisi dari KONFIGURASI PERCABANGAN, bukan dari tipe pertanyaan.
--
-- Migrasi sebelumnya (20261004090000) mencari pertanyaan bertipe 'consent' yang dijawab
-- "Tidak". Di produksi hasilnya NOL: pertanyaan persetujuan pada instrumen yang berjalan
-- ternyata bertipe 'boolean' — "Apakah Anda bersedia mengikuti survei online…" — dan tipe
-- 'consent' tidak dipakai sama sekali. Aturan yang bersandar pada tipe gagal secara senyap,
-- sehingga 15 penolak tetap memakan jatah kuota tanpa ada yang menyadarinya.
--
-- Sumber kebenaran yang benar adalah percabangan survei itu sendiri:
--   {"branches": [{"goto": "end", "value": "Tidak"}]}
-- Pertanyaan yang MENGHENTIKAN survei ketika dijawab begitu memang gerbang penyaring,
-- menurut konfigurasi pembuat surveinya — tidak perlu ditebak dari tipe maupun redaksi.
UPDATE "SurveyResponse" r
SET "consentDitolak" = true
WHERE EXISTS (
  SELECT 1
  FROM "Answer" a
  JOIN "Question" q
    ON q."id" = a."questionId"
   AND jsonb_typeof(q."options" -> 'branches') = 'array'
  CROSS JOIN LATERAL jsonb_array_elements(q."options" -> 'branches') b
  WHERE a."responseId" = r."id"
    AND (b ->> 'goto') IN ('end', '-1')
    AND lower(trim(b ->> 'value')) = lower(trim(a."value"))
);
