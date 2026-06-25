-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "triggerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
