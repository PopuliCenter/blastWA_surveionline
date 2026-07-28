-- Cermin status ASLI template di Meta (status/quality/kategori/alasan tolak + waktu sinkron).
-- Dibedakan dari kolom `status` yang hanya label lokal.
ALTER TABLE "MessageTemplate" ADD COLUMN "metaStatus" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "metaQuality" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "metaCategory" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "metaId" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "metaReason" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "metaSyncedAt" TIMESTAMP(3);
