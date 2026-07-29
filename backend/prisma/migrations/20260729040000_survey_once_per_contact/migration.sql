-- Batas pengisian per responden: true = sekali saja (dikunci setelah selesai).
-- Default false agar survei yang sudah ada tetap berperilaku seperti sebelumnya (boleh berulang).
ALTER TABLE "Survey" ADD COLUMN "oncePerContact" BOOLEAN NOT NULL DEFAULT false;
