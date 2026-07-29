-- Format header template MENURUT META (text|image|document|video). Dipakai untuk memastikan
-- parameter header saat blast cocok dengan template aslinya (cegah error #132012).
ALTER TABLE "MessageTemplate" ADD COLUMN "metaHeaderFormat" TEXT;
