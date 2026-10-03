-- Status antar per pesan.
--
-- Sebelumnya callback status dari Meta HANYA dipakai untuk menggerakkan BlastRecipient;
-- handleStatus berhenti begitu pesannya bukan bagian dari blast. Akibatnya status antar
-- formulir survei dan balasan bot dibuang tanpa jejak.
--
-- Insiden 3 Oktober 2026: pengiriman diblokir Meta karena tagihan belum dibayar. Meta
-- tetap MENERIMA panggilan API dan mengembalikan ID pesan — sehingga aplikasi mencatat
-- "terkirim" — lalu melaporkan kegagalan antar lewat webhook status yang tak pernah
-- disimpan. Selama berjam-jam tidak ada satu pun layar yang bisa menunjukkan bahwa
-- pesan tidak sampai ke responden.
ALTER TABLE "Message" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "Message" ADD COLUMN "failedReason" TEXT;

-- Untuk panel "gagal diantar" di Dashboard: menghitung kegagalan dalam rentang waktu.
CREATE INDEX "Message_deliveryStatus_createdAt_idx" ON "Message"("deliveryStatus", "createdAt");
