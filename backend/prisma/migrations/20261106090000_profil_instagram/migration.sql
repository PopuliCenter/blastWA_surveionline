-- Username Instagram disimpan tersendiri (dulu hanya ikut mengisi nama bila kosong) dan
-- kapan profilnya terakhir dicek, agar diperbarui berkala tanpa memanggil API tiap pesan.
-- Kontak lama tetap kosong: dilengkapi saat mereka DM lagi atau lewat `npm run lengkapi:ig`.
ALTER TABLE "Contact" ADD COLUMN "igUsername" TEXT;
ALTER TABLE "Contact" ADD COLUMN "igProfilPada" TIMESTAMP(3);
