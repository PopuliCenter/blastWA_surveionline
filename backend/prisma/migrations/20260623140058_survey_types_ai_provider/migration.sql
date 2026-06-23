-- AlterTable
ALTER TABLE "AiConfig" ADD COLUMN     "baseUrl" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'anthropic';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true;
