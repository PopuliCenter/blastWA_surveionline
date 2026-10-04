/**
 * Hapus jawaban yang tersimpan SETELAH responden tersaring keluar.
 *
 * Kenapa perlu: penyaringan survei (mis. informed consent dengan percabangan goto "end")
 * sampai sekarang hanya ditegakkan di sisi klien, lewat komponen If pada Flow. Itu bisa
 * dilewati — responden menekan tombol kembali lalu mengubah jawabannya, atau Flow yang
 * terbit di Meta dibuat sebelum aturan percabangan ditambahkan sehingga kondisinya memang
 * tidak ada di sana. Server menerima apa adanya dan menyimpan semuanya.
 *
 * Terjadi nyata di produksi: satu responden menjawab "Tidak" pada informed consent di
 * urutan 0, namun 20 jawaban berikutnya tetap tersimpan — nama, provinsi, agama,
 * penghasilan, hingga pilihan politiknya.
 *
 * Menyimpan jawaban orang yang menyatakan TIDAK BERSEDIA adalah pemrosesan tanpa dasar
 * persetujuan, bukan sekadar data kotor. Karena itu jalan keluarnya penghapusan, bukan
 * penandaan. Jawaban SEBELUM titik penyaringan dipertahankan — responden memang
 * menjawabnya sebelum tersaring.
 *
 * Mesin sudah diperbaiki agar menolak jawaban semacam ini sejak diterima; skrip ini
 * membereskan yang terlanjur tersimpan.
 *
 * Pemakaian (dari folder backend/):
 *   npm run bersihkan:tersaring            # hanya menampilkan temuan, tidak menghapus
 *   npm run bersihkan:tersaring -- --apply # benar-benar menghapus
 *
 * Aman diulang: menjalankannya dua kali tidak menghapus apa pun pada kali kedua.
 */
import { prisma } from "../db.js";
import { saringJawaban } from "../lib/surveyLogic.js";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Hanya respons yang sudah ditandai tersaring yang mungkin bermasalah.
  const kandidat = await prisma.surveyResponse.findMany({
    where: { consentDitolak: true },
    select: {
      id: true,
      survey: { select: { title: true, questions: { select: { id: true, options: true }, orderBy: { order: "asc" } } } },
      answers: { select: { id: true, questionId: true, value: true } },
    },
  });

  let totalRespons = 0;
  let totalJawaban = 0;
  const idHapus: string[] = [];

  for (const r of kandidat) {
    const { ditolak, batas } = saringJawaban(r.survey.questions, r.answers);
    if (!ditolak.length) continue;
    totalRespons++;
    totalJawaban += ditolak.length;
    idHapus.push(...ditolak.map((a) => a.id));
    console.log(
      `  ${r.survey.title.slice(0, 45)} — ${ditolak.length} jawaban setelah urutan ${batas} akan dihapus`,
    );
  }

  if (!totalRespons) {
    console.log("Tidak ada jawaban yang tersimpan setelah titik penyaringan. Tidak ada yang perlu dihapus.");
    return;
  }

  console.log(`\nRespons bermasalah : ${totalRespons}`);
  console.log(`Jawaban dihapus    : ${totalJawaban}  (jawaban SEBELUM titik penyaringan dipertahankan)`);

  if (!apply) {
    console.log("\nIni hanya pratinjau. Jalankan ulang dengan -- --apply untuk menghapus.");
    return;
  }
  const r = await prisma.answer.deleteMany({ where: { id: { in: idHapus } } });
  console.log(`\n${r.count} jawaban dihapus.`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
