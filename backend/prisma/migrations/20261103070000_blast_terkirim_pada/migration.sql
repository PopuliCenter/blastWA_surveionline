-- Saat pesan blast benar-benar terkirim, untuk membandingkan broadcast dengan ketukan iklan
-- dan menghitung jendela balasan. Penerima lama tetap kosong dan memakai createdAt.
ALTER TABLE "BlastRecipient" ADD COLUMN "terkirimPada" TIMESTAMP(3);
