-- Asal balasan otomatis (survey | autoreply | ai | optout). NULL = kiriman agen manusia.
-- Dipakai untuk menghitung kuota balasan AI per kontak.
ALTER TABLE "Message" ADD COLUMN "source" TEXT;

CREATE INDEX "Message_contactId_source_createdAt_idx" ON "Message"("contactId", "source", "createdAt");

-- Pembatas biaya & waktu untuk Agen AI.
ALTER TABLE "AiConfig" ADD COLUMN "maxTokens" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "AiConfig" ADD COLUMN "historyLimit" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "AiConfig" ADD COLUMN "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 5;
