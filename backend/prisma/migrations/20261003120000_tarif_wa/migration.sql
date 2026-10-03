-- Kartu tarif WhatsApp, diisi manual dan BERVERSI.
--
-- Berversi karena invoice harus bisa dipertanggungjawabkan: kalau tarif hanya satu baris
-- lalu diubah saat Meta menaikkan harga, seluruh invoice lama ikut berubah nilainya dan
-- angka yang sudah diajukan ke klien tidak lagi cocok dengan dokumennya. Tiap set punya
-- tanggal berlaku, dan perhitungan memakai set yang berlaku pada tanggal pesan dikirim.
CREATE TABLE "TarifWa" (
    "id" TEXT NOT NULL,
    "berlakuSejak" TIMESTAMP(3) NOT NULL,
    "mataUang" TEXT NOT NULL DEFAULT 'IDR',
    "marketing" DOUBLE PRECISION NOT NULL,
    "utility" DOUBLE PRECISION NOT NULL,
    "authentication" DOUBLE PRECISION NOT NULL,
    "service" DOUBLE PRECISION NOT NULL,
    "gratisServicePerBulan" INTEGER NOT NULL DEFAULT 1000,
    "pajakPersen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarifWa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TarifWa_berlakuSejak_idx" ON "TarifWa"("berlakuSejak");

-- Tarif pasar Indonesia yang berlaku 1 Oktober 2026, menurut kartu tarif resmi Meta.
-- Diisi sebagai titik awal supaya halaman Biaya tidak kosong; angkanya tetap bisa diubah
-- dan set baru bisa ditambahkan kapan pun Meta mengubah harga.
-- pajakPersen sengaja 0 — nilai PPN diambil dari invoice Meta yang sebenarnya, bukan ditebak.
INSERT INTO "TarifWa" ("id", "berlakuSejak", "mataUang", "marketing", "utility", "authentication", "service", "gratisServicePerBulan", "pajakPersen", "catatan")
VALUES (
  'tarif-id-2026-10-01',
  '2026-10-01 00:00:00',
  'IDR',
  586.33,
  356.65,
  356.65,
  356.65,
  1000,
  0,
  'Kartu tarif resmi Meta untuk pasar Indonesia, berlaku 1 Oktober 2026. Periksa ulang di developers.facebook.com/docs/whatsapp/pricing bila Meta mengumumkan perubahan.'
);
