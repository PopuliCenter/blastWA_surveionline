/**
 * Pulihkan respons yang dulu ditolak karena kuotanya penuh, setelah klien menaikkan target.
 *
 * Kenapa perlu: menaikkan target TIDAK memulihkan apa pun dengan sendirinya. Respons yang
 * sudah ditolak tetap tidak dihitung, tidak ikut ekspor, dan tidak ada di Google Sheets —
 * padahal pesannya sudah terkirim dan sudah ditagih Meta. Skrip ini mengembalikannya.
 *
 * Yang bisa dipulihkan hanya respons yang jawabannya LENGKAP: formulir Flow, dan respons
 * chat yang ditolak di akhir. Respons chat yang dihentikan begitu provinsinya ketahuan
 * penuh berhenti di pertanyaan wilayah — jawabannya tidak lengkap, jadi dibiarkan. Orangnya
 * tetap bisa mengisi ulang dari awal lewat kata pemicu.
 *
 * Dipulihkan urut waktu ditolak, dan tiap respons tetap tunduk pada kuota yang baru: bila
 * jatah provinsinya habis lagi di tengah jalan, sisanya dilewati, tidak dipaksakan masuk.
 * Pemeriksaannya memakai kunci yang sama dengan mesin survei, jadi aman dijalankan saat
 * survei masih menerima responden.
 *
 * Pemakaian (dari folder backend/):
 *   npm run pulihkan:kuota                              # ringkasan seluruh survei
 *   npm run pulihkan:kuota -- --survei=<id>             # pratinjau satu survei
 *   npm run pulihkan:kuota -- --survei=<id> --apply     # benar-benar memulihkan
 *
 * --apply sengaja mewajibkan --survei: memulihkan seluruh survei sekaligus terlalu mudah
 * dilakukan tanpa sengaja.
 *
 * Aman diulang: yang sudah dipulihkan tidak tersentuh lagi pada kali berikutnya.
 */
import { prisma } from "../db.js";
import { connection } from "../redis.js";
import { enqueueSheetSync, sheetQueue } from "../queue/sheetQueue.js";
import { pulihkanRespons } from "../services/kuotaSurvei.js";

function argumen(nama: string): string | null {
  const awalan = `--${nama}=`;
  const a = process.argv.find((x) => x.startsWith(awalan));
  return a ? a.slice(awalan.length).trim() || null : null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const surveiId = argumen("survei");
  if (apply && !surveiId) {
    console.log("--apply wajib disertai --survei=<id>. Jalankan tanpa --apply untuk melihat daftar survei.");
    process.exitCode = 1;
    return;
  }

  const surveys = await prisma.survey.findMany({
    where: {
      ...(surveiId ? { id: surveiId } : {}),
      responses: { some: { ditolakKuotaPada: { not: null } } },
    },
    select: { id: true, title: true, _count: { select: { questions: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!surveys.length) {
    console.log(
      surveiId ? "Survei ini tidak punya respons yang ditolak kuota." : "Tidak ada respons yang ditolak kuota.",
    );
    return;
  }

  for (const s of surveys) {
    const jml = s._count.questions;
    const semua = await prisma.surveyResponse.findMany({
      where: { surveyId: s.id, ditolakKuotaPada: { not: null } },
      orderBy: { ditolakKuotaPada: "asc" },
      select: { id: true, currentStep: true, alasanDitolakKuota: true },
    });
    const lengkap = semua.filter((r) => r.currentStep >= jml);
    const global = semua.filter((r) => r.alasanDitolakKuota === "global").length;

    console.log(`\n${s.title}`);
    console.log(`  id survei            : ${s.id}`);
    console.log(
      `  Ditolak kuota        : ${semua.length} (${global} batas global, ${semua.length - global} batas provinsi)`,
    );
    console.log(`  Jawaban lengkap      : ${lengkap.length} — bisa dipulihkan`);
    console.log(`  Dihentikan di tengah : ${semua.length - lengkap.length} — tidak bisa dipulihkan`);

    if (!apply) continue;

    let dipulihkan = 0;
    let masihPenuh = 0;
    let sudahDiterima = 0;
    for (const r of lengkap) {
      const hasil = await pulihkanRespons(r.id);
      if (hasil === "dipulihkan") {
        dipulihkan++;
        // Baris yang dipulihkan menyusul ke Google Sheets. Antrean sendiri yang memeriksa
        // apakah integrasinya aktif.
        await enqueueSheetSync(r.id);
      } else if (hasil === "masih-penuh") masihPenuh++;
      else if (hasil === "sudah-diterima") sudahDiterima++;
    }
    console.log(`\n  Dipulihkan           : ${dipulihkan}`);
    if (masihPenuh)
      console.log(`  Dilewati, kuota penuh: ${masihPenuh} — naikkan lagi targetnya bila ingin ikut dipulihkan`);
    if (sudahDiterima)
      console.log(`  Dilewati, sudah ada  : ${sudahDiterima} — orangnya sudah mengisi ulang dan diterima`);
  }

  if (!apply) {
    console.log(
      "\nBelum ada yang diubah. Naikkan dulu targetnya di layar Kuota, lalu jalankan lagi dengan" +
        "\n--survei=<id> --apply untuk memulihkan respons yang lengkap.",
    );
  }
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sheetQueue.close().catch(() => {});
    connection.disconnect();
    await prisma.$disconnect();
  });
