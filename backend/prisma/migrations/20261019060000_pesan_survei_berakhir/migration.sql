-- Pesan untuk orang yang mencoba ikut survei yang sudah ditutup (status "closed"): mengetik
-- kata pemicunya, membalas blastnya, atau mengirim formulir yang terlanjur dibuka.
-- null = teks bawaan. Respons yang masuk setelah ditutup ditandai lewat kolom yang sudah
-- ada — ditolakKuotaPada + alasanDitolakKuota = "ditutup" — jadi tidak perlu kolom baru.
ALTER TABLE "Survey" ADD COLUMN "pesanSurveiBerakhir" TEXT;
