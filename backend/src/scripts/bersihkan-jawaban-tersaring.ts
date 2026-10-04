/**
 * Hapus jawaban atas pertanyaan yang SEHARUSNYA DILEWATI responden menurut percabangan survei.
 *
 * Kenapa perlu: percabangan survei sampai sekarang hanya ditegakkan di sisi klien, lewat
 * komponen If pada Flow. Itu bisa dilewati — dan di Flow pasti terlewati pada satu kasus,
 * karena payload "complete" mendaftar SEMUA field layar tanpa syarat: responden yang sempat
 * mengisi lalu mengubah jawaban pemicunya membuat komponennya hilang dari layar, tetapi
 * nilainya masih tersimpan di state formulir dan tetap terkirim.
 *
 * Dua wujudnya, dua akibat yang berbeda — keduanya terjadi nyata di produksi:
 *
 *   • TERSARING KELUAR. Satu responden menjawab "Tidak" pada informed consent di urutan 0,
 *     namun 20 jawaban berikutnya tetap tersimpan — nama, provinsi, agama, penghasilan,
 *     hingga pilihan politiknya. Menyimpan jawaban orang yang menyatakan TIDAK BERSEDIA
 *     adalah pemrosesan tanpa dasar persetujuan, bukan sekadar data kotor.
 *
 *   • DILOMPATI. Responden menjawab "Tidak" pada "Apakah Anda tahu program X", namun
 *     pertanyaan lanjutan "Jika Anda tahu, beri nilai…" tetap membawa angka. Jawaban yang
 *     maknanya mustahil, dan bila ikut dianalisis ia menggeser rata-rata.
 *
 * Mesin sudah diperbaiki agar menolak jawaban semacam ini sejak diterima; skrip ini
 * membereskan yang terlanjur tersimpan. Jawaban yang BERADA di jalur responden tidak
 * disentuh.
 *
 * Pemakaian (dari folder backend/):
 *   npm run bersihkan:tersaring            # hanya menampilkan temuan, tidak menghapus
 *   npm run bersihkan:tersaring -- --apply # benar-benar menghapus
 *
 * Aman diulang: menjalankannya dua kali tidak menghapus apa pun pada kali kedua.
 *
 * PERIKSA PRATINJAUNYA. Aturan goto memakai INDEKS pertanyaan; bila pertanyaan pernah
 * diurutkan ulang setelah percabangan disetel, indeksnya bisa menunjuk ke tempat yang salah
 * dan jawaban yang sah ikut terdaftar. Pratinjau menyebut tiap pertanyaan beserta jumlahnya
 * supaya itu ketahuan sebelum ada yang dihapus.
 */
import { prisma } from "../db.js";
import { saringJawaban } from "../lib/surveyLogic.js";

const UKURAN_BATCH = 500;

type Temuan = { survei: string; pertanyaan: string; jumlah: number };

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Pertanyaan tiap survei dibaca SEKALI, bukan ikut tiap respons.
  const surveys = await prisma.survey.findMany({
    select: { id: true, title: true, questions: { select: { id: true, text: true, options: true }, orderBy: { order: "asc" } } },
  });
  const perSurvei = new Map(surveys.map((s) => [s.id, s]));

  const total = await prisma.surveyResponse.count();
  let diperiksa = 0;
  let totalRespons = 0;
  let responsTersaring = 0;
  const idHapus: string[] = [];
  const temuan = new Map<string, Temuan>();

  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.surveyResponse.findMany({
      select: { id: true, surveyId: true, answers: { select: { id: true, questionId: true, value: true } } },
      orderBy: { id: "asc" },
      take: UKURAN_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1]!.id;
    diperiksa += batch.length;

    for (const r of batch) {
      const s = perSurvei.get(r.surveyId);
      if (!s || !r.answers.length) continue;
      const { ditolak, batas } = saringJawaban(s.questions, r.answers);
      if (!ditolak.length) continue;
      totalRespons++;
      if (batas !== null) responsTersaring++;
      idHapus.push(...ditolak.map((a) => a.id));
      for (const a of ditolak) {
        const q = s.questions.find((x) => x.id === a.questionId);
        const kunci = `${s.id}|${a.questionId}`;
        const t = temuan.get(kunci) ?? {
          survei: s.title,
          pertanyaan: q?.text ?? a.questionId,
          jumlah: 0,
        };
        t.jumlah++;
        temuan.set(kunci, t);
      }
    }
    process.stdout.write(`\rdiperiksa ${diperiksa}/${total}…`);
  }
  process.stdout.write("\r".padEnd(40) + "\r");

  if (!totalRespons) {
    console.log("Tidak ada jawaban di luar jalur percabangan. Tidak ada yang perlu dihapus.");
    return;
  }

  // Dikelompokkan per survei lalu per pertanyaan: angka per pertanyaan itulah yang membuat
  // aturan goto yang meleset kelihatan — pertanyaan yang "tidak mungkin dilompati" muncul
  // dengan jumlah besar.
  const perJudul = new Map<string, Temuan[]>();
  for (const t of temuan.values()) {
    const arr = perJudul.get(t.survei) ?? [];
    arr.push(t);
    perJudul.set(t.survei, arr);
  }
  for (const [judul, list] of perJudul) {
    console.log(`\n${judul}`);
    for (const t of list.sort((a, b) => b.jumlah - a.jumlah))
      console.log(`  ${String(t.jumlah).padStart(5)} × ${t.pertanyaan.slice(0, 70)}`);
  }

  console.log(`\nRespons bermasalah : ${totalRespons}  (${responsTersaring} di antaranya tersaring keluar)`);
  console.log(`Jawaban dihapus    : ${idHapus.length}  (jawaban di jalur responden dipertahankan)`);

  if (!apply) {
    console.log("\nIni hanya pratinjau. Periksa daftar di atas, lalu jalankan ulang dengan -- --apply untuk menghapus.");
    return;
  }
  let dihapus = 0;
  for (let i = 0; i < idHapus.length; i += UKURAN_BATCH) {
    const r = await prisma.answer.deleteMany({ where: { id: { in: idHapus.slice(i, i + UKURAN_BATCH) } } });
    dihapus += r.count;
  }
  console.log(`\n${dihapus} jawaban dihapus.`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
