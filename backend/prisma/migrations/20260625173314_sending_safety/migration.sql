-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentSource" TEXT,
ADD COLUMN     "optOutAt" TIMESTAMP(3),
ADD COLUMN     "subscribed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SendingPolicy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimit" INTEGER NOT NULL DEFAULT 500,
    "jitterMinMs" INTEGER NOT NULL DEFAULT 800,
    "jitterMaxMs" INTEGER NOT NULL DEFAULT 2500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendingPolicy_pkey" PRIMARY KEY ("id")
);
