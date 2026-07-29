-- Jumlah variabel {{n}} pada BODY template MENURUT META. Jumlah parameter saat kirim wajib
-- sama persis, kalau tidak Meta menolak: #132000 "number of localizable_params (N) does not
-- match the expected number of params (M)".
ALTER TABLE "MessageTemplate" ADD COLUMN "metaBodyParams" INTEGER;
