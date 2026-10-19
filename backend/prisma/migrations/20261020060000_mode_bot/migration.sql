-- Mode bot (pengaturan tunggal "default"): diamTanpaSurveiAktif = saat tidak ada survei
-- berjalan, bot tidak mengirim balasan otomatis apa pun (kecuali konfirmasi berhenti/
-- berlangganan). Tabel baru — tidak menyentuh data yang ada; tanpa baris = perilaku semula.
CREATE TABLE "BotConfig" (
    "id" TEXT NOT NULL,
    "diamTanpaSurveiAktif" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);
