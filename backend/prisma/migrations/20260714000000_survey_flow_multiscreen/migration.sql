-- Mode Flow multi-layar: jumlah pertanyaan per layar + tautan kebijakan privasi.
ALTER TABLE "Survey" ADD COLUMN "flowPerScreen" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Survey" ADD COLUMN "privacyUrl" TEXT;
