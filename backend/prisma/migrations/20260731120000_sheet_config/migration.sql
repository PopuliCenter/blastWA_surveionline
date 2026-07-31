-- Integrasi Google Sheets: respons survei didorong otomatis ke spreadsheet tim.
CREATE TABLE "SheetConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "spreadsheetId" TEXT,
    "serviceAccountJson" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetConfig_pkey" PRIMARY KEY ("id")
);

-- Penanda idempoten worker sheets sekaligus dasar backfill:
-- completedAt terisi + sheetSyncedAt kosong = belum terdorong ke sheet.
ALTER TABLE "SurveyResponse" ADD COLUMN "sheetSyncedAt" TIMESTAMP(3);
