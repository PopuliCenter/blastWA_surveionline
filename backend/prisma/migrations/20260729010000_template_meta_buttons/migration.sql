-- Tipe tombol template MENURUT META (urut indeks). Dipakai memastikan parameter tombol Flow
-- hanya dikirim ke template yang tombol index 0-nya FLOW (cegah error #132018
-- "buttons: Button at index 0 must be of type QuickReply").
ALTER TABLE "MessageTemplate" ADD COLUMN "metaButtons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
