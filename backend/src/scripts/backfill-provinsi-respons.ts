/**
 * Isi mundur kolom SurveyResponse.kodeProvinsi untuk responden yang SUDAH ada.
 *
 * Kenapa perlu: kolom itu baru ditambahkan bersama fitur kuota responden, sehingga seluruh
 * respons yang terkumpul sebelumnya bernilai null. Tanpa pengisian mundur, kuota per
 * provinsi mulai menghitung dari NOL — menetapkan Jawa Barat 200 tidak akan memperhitungkan
 * responden Jawa Barat yang sudah masuk, dan kuotanya jadi jauh lebih longgar dari maksud.
 *
 * Dua sumber, berurutan:
 *   1. Jawaban pertanyaan bertipe "wilayah" pada respons itu — yang mengisi tahu domisilinya
 *      sendiri, jadi ini didahulukan.
 *   2. Atribut kontak hasil impor (kolom Provinsi) — dipakai bila survei tidak punya
 *      pertanyaan wilayah atau pertanyaannya tidak dijawab.
 *
 * Yang tidak bisa ditentukan dibiarkan null, bukan ditebak: satu respons yang terhitung ke
 * provinsi salah merusak kuota dua provinsi sekaligus.
 *
 * Pemakaian (dari folder backend/):
 *   npm run backfill:provinsi            # hanya menampilkan rencana, tidak menulis
 *   npm run backfill:provinsi -- --apply # benar-benar menyimpan
 *
 * Aman diulang: respons yang sudah punya kodeProvinsi tidak disentuh.
 *
 * Berkas ini sengaja berada di dalam src/ supaya ikut ter-compile ke dist/ dan bisa
 * dijalankan dengan `node` biasa di image produksi — image itu dibangun dengan
 * `npm ci --omit=dev`, jadi tsx (devDependency) tidak tersedia di sana.
 */
import { prisma } from "../db.js";
import { kodeProvinsiDari, PROVINSI } from "../lib/wilayah.js";
import { provinsiDariAtribut } from "../services/kuotaSurvei.js";

const NAMA = new Map(PROVINSI.map((p) => [p.kode, p.nama]));
const UKURAN_BATCH = 500;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const total = await prisma.surveyResponse.count({ where: { completedAt: { not: null }, kodeProvinsi: null } });
  if (total === 0) {
    console.log("Tidak ada respons selesai yang provinsinya kosong. Tidak ada yang perlu diisi.");
    return;
  }
  console.log(`Respons selesai tanpa provinsi: ${total}\n`);

  const dariJawaban = new Map<string, number>();
  const dariAtribut = new Map<string, number>();
  let takTentu = 0;
  let diproses = 0;

  // Dibaca bertahap agar survei besar tidak menarik seluruh tabel ke memori sekaligus.
  // Kursor memakai id supaya tetap benar walau baris berubah di tengah jalan.
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.surveyResponse.findMany({
      where: { completedAt: { not: null }, kodeProvinsi: null },
      select: {
        id: true,
        contact: { select: { attributes: true } },
        survey: { select: { questions: { where: { type: "wilayah" }, select: { id: true } } } },
        answers: { select: { questionId: true, value: true } },
      },
      orderBy: { id: "asc" },
      take: UKURAN_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1]!.id;

    for (const r of batch) {
      diproses++;
      // 1) Jawaban pertanyaan wilayah lebih dipercaya daripada atribut impor.
      const idWilayah = new Set(r.survey.questions.map((q) => q.id));
      let kode: string | null = null;
      let sumber: "jawaban" | "atribut" | null = null;
      for (const a of r.answers) {
        if (!idWilayah.has(a.questionId)) continue;
        kode = kodeProvinsiDari(a.value);
        if (kode) {
          sumber = "jawaban";
          break;
        }
      }
      // 2) Atribut kontak hasil impor.
      if (!kode) {
        kode = provinsiDariAtribut(r.contact?.attributes);
        if (kode) sumber = "atribut";
      }

      if (!kode) {
        takTentu++;
        continue;
      }
      const peta = sumber === "jawaban" ? dariJawaban : dariAtribut;
      peta.set(kode, (peta.get(kode) ?? 0) + 1);
      if (apply) await prisma.surveyResponse.update({ where: { id: r.id }, data: { kodeProvinsi: kode } });
    }
    process.stdout.write(`\rdiperiksa ${diproses}/${total}…`);
  }
  process.stdout.write("\r".padEnd(40) + "\r");

  const gabung = new Map<string, number>();
  for (const [k, n] of dariJawaban) gabung.set(k, (gabung.get(k) ?? 0) + n);
  for (const [k, n] of dariAtribut) gabung.set(k, (gabung.get(k) ?? 0) + n);

  const baris = [...gabung.entries()].sort((a, b) => b[1] - a[1]);
  console.log("Hasil per provinsi:");
  for (const [kode, n] of baris) {
    const j = dariJawaban.get(kode) ?? 0;
    const a = dariAtribut.get(kode) ?? 0;
    console.log(`  ${kode}  ${(NAMA.get(kode) ?? kode).padEnd(28)} ${String(n).padStart(5)}  (jawaban ${j}, atribut ${a})`);
  }

  const terisi = [...gabung.values()].reduce((x, y) => x + y, 0);
  console.log(`\nDapat ditentukan : ${terisi}`);
  console.log(`Tidak dapat      : ${takTentu}  (dibiarkan kosong — menebak akan merusak kuota dua provinsi sekaligus)`);

  if (!apply) {
    console.log("\nIni hanya pratinjau. Jalankan ulang dengan -- --apply untuk menyimpan.");
    return;
  }
  console.log(`\n${terisi} respons diperbarui.`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
