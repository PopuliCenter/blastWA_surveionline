-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "flowCta" TEXT,
ADD COLUMN     "flowId" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'chat';
