-- Penghapusan yang benar-benar menghapus, dan penolakan yang tidak ikut terhapus.

-- 1) Pesan ikut terhapus bersama kontaknya.
--
-- Sebelumnya SET NULL: menghapus kontak hanya mengosongkan contactId, sementara baris
-- pesannya tetap tinggal lengkap dengan kolom `payload` berisi muatan webhook mentah —
-- di dalamnya ada nomor telepon dan isi percakapan. Jadi "hapus kontak" tidak pernah
-- benar-benar menghapus data orangnya.
--
-- CATATAN: baris pesan yang SUDAH telanjur yatim (contactId NULL dari penghapusan masa
-- lalu) sengaja TIDAK disentuh di sini. Menghapus baris pada migrasi tidak bisa dibatalkan,
-- dan sebagian pesan bisa saja ber-contactId NULL karena sebab lain. Bersihkan secara sadar
-- dengan `npm run purge:orphan-messages` yang menampilkan jumlahnya lebih dulu.
ALTER TABLE "Message" DROP CONSTRAINT "Message_contactId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Daftar penekan opt-out, berdiri sendiri di luar Contact.
--
-- Dulu penolakan hanya tersimpan sebagai Contact.subscribed = false, sehingga menghapus
-- kontaknya menghapus pula jejak penolakannya: nomor yang sama bisa diimpor ulang dari
-- berkas lama lalu dihubungi lagi seolah tak pernah menolak.
CREATE TABLE "OptOutNumber" (
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptOutNumber_pkey" PRIMARY KEY ("phone")
);

-- 3) Isi daftar dari kontak yang penolakannya SUDAH tercatat hari ini, supaya daftar
-- penekan tidak mulai dari kosong dan penolakan lama tetap dihormati.
INSERT INTO "OptOutNumber" ("phone", "reason", "createdAt")
SELECT "phone", 'kontak yang sudah opt-out', COALESCE("optOutAt", CURRENT_TIMESTAMP)
FROM "Contact"
WHERE "subscribed" = false
ON CONFLICT ("phone") DO NOTHING;
