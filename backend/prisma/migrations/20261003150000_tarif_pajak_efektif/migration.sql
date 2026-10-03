-- Dua penyesuaian pada kartu tarif, keduanya berasal dari invoice Meta yang sebenarnya.

-- 1) Pajak: angka yang DITULIS berbeda dari angka yang DIKALIKAN.
--
-- Pada invoice Meta untuk pasar Indonesia tertulis "Tax (12%)", tetapi nilainya 11% dari
-- subtotal: 301.726 → 33.190, tepat 11,0%. Itu mekanisme PPN sejak 2025 — tarif 12%
-- dikenakan atas dasar pengenaan pajak 11/12 nilai, sehingga efektifnya 11%. Meta
-- menandainya dengan tanda bintang di samping angka pajaknya.
--
-- Tanpa pemisahan ini, invoice ke klien akan memakai 12% penuh dan selisih sekitar 9%
-- dari nilai pajaknya — cukup untuk membuat dokumen itu tidak lagi cocok dengan invoice
-- Meta yang direkonsiliasi.
ALTER TABLE "TarifWa" ADD COLUMN "pajakEfektifPersen" DOUBLE PRECISION;
ALTER TABLE "TarifWa" ALTER COLUMN "pajakPersen" SET DEFAULT 0;

-- 2) Jatah pesan service gratis: bawaan menjadi 0.
--
-- Jatah 1.000 pesan itu milik BULAN, bukan milik satu survei. Bila dalam sebulan berjalan
-- dua atau tiga survei, membebankan seluruh jatah ke salah satunya bersifat sewenang-wenang
-- dan membuat survei lain menanggung biaya yang sebenarnya tidak ada. Default 0 berarti
-- seluruh pesan service dihitung; angkanya tetap bisa diisi bila memang ingin dipotong.
ALTER TABLE "TarifWa" ALTER COLUMN "gratisServicePerBulan" SET DEFAULT 0;

-- Set tarif awal disesuaikan dengan invoice Meta yang nyata: PPN ditulis 12%, dikalikan 11%,
-- dan tanpa pemotongan jatah gratis.
UPDATE "TarifWa"
SET "pajakPersen" = 12,
    "pajakEfektifPersen" = 11,
    "gratisServicePerBulan" = 0,
    "catatan" = 'Kartu tarif resmi Meta untuk pasar Indonesia, berlaku 1 Oktober 2026. PPN ditulis 12% namun dikenakan 11% (dasar pengenaan pajak 11/12), sesuai invoice Meta.'
WHERE "id" = 'tarif-id-2026-10-01';
