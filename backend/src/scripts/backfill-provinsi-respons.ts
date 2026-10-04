/**
 * Isi mundur kolom SurveyResponse.kodeProvinsi untuk responden yang SUDAH ada.
 *
 * Kenapa perlu: kolom itu baru ditambahkan bersama fitur kuota responden, sehingga seluruh
 * respons yang terkumpul sebelumnya bernilai null. Tanpa pengisian mundur, kuota per
 * provinsi mulai menghitung dari NOL — menetapkan Jawa Barat 200 tidak akan memperhitungkan
 * responden Jawa Barat yang sudah masuk, dan batasnya jadi jauh lebih longgar dari maksud.
 *
 * Tiga sumber, berurutan dari yang paling dipercaya:
 *   1. Jawaban pertanyaan bertipe "wilayah".
 *   2. Jawaban pertanyaan LAIN yang terbukti berisi nama provinsi — lihat deteksi di bawah.
 *   3. Atribut kontak hasil impor (kolom Provinsi).
 *
 * Deteksi sumber 2 sengaja TIDAK mencocokkan teks pertanyaan. Redaksi bisa berubah antar
 * survei ("Sebutkan Provinsi Anda tinggal:", "Domisili:", "Asal daerah"), dan pencocokan
 * kata kunci akan diam-diam meleset begitu redaksinya diganti. Sebagai gantinya, tiap
 * pertanyaan dinilai dari JAWABANNYA: bila sebagian besar jawaban dapat diterjemahkan jadi
 * kode provinsi, pertanyaan itu memang pertanyaan provinsi — apa pun bunyinya. Cara ini
 * memeriksa dirinya sendiri; pertanyaan "Apa pekerjaan Anda" tidak akan pernah lolos.
 *
 * Yang tidak dapat ditentukan DIBIARKAN kosong, bukan ditebak: satu respons yang terhitung
 * ke provinsi salah merusak kuota dua provinsi sekaligus.
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

// Ambang deteksi. Sengaja tinggi: lebih baik melewatkan satu pertanyaan provinsi dan
// membiarkan datanya kosong daripada salah mengira pertanyaan lain sebagai provinsi.
const AMBANG_COCOK = 0.8;
const MIN_JAWABAN = 10;

type Kandidat = { questionId: string; teks: string; tipe: string; cocok: number; total: number };

// Temukan, per survei, pertanyaan mana yang jawabannya berisi nama provinsi.
async function deteksiPertanyaanProvinsi(): Promise<{ perSurvei: Map<string, Kandidat>; semua: Kandidat[] }> {
  const surveys = await prisma.survey.findMany({
    select: { id: true, title: true, questions: { select: { id: true, text: true, type: true } } },
  });

  const perSurvei = new Map<string, Kandidat>();
  const semua: Kandidat[] = [];

  for (const s of surveys) {
    let terbaik: Kandidat | null = null;
    for (const q of s.questions) {
      const nilai = await prisma.answer.groupBy({
        by: ["value"],
        where: { questionId: q.id },
        _count: { _all: true },
      });
      let total = 0;
      let cocok = 0;
      for (const v of nilai) {
        total += v._count._all;
        if (kodeProvinsiDari(v.value)) cocok += v._count._all;
      }
      if (total < MIN_JAWABAN || cocok / total < AMBANG_COCOK) continue;
      const k: Kandidat = { questionId: q.id, teks: q.text, tipe: q.type, cocok, total };
      semua.push(k);
      // Tipe wilayah selalu menang; selain itu, yang rasio cocoknya tertinggi.
      const lebihBaik =
        !terbaik ||
        (q.type === "wilayah" && terbaik.tipe !== "wilayah") ||
        (q.type !== "wilayah" && terbaik.tipe !== "wilayah" && k.cocok / k.total > terbaik.cocok / terbaik.total);
      if (lebihBaik) terbaik = k;
    }
    if (terbaik) perSurvei.set(s.id, terbaik);
  }
  return { perSurvei, semua };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const total = await prisma.surveyResponse.count({ where: { completedAt: { not: null }, kodeProvinsi: null } });
  if (total === 0) {
    console.log("Tidak ada respons selesai yang provinsinya kosong. Tidak ada yang perlu diisi.");
    return;
  }
  console.log(`Respons selesai tanpa provinsi: ${total}\n`);

  console.log("Mencari pertanyaan yang jawabannya berisi nama provinsi…");
  const { perSurvei, semua } = await deteksiPertanyaanProvinsi();
  if (!semua.length) {
    console.log("  tidak ada. Provinsi hanya akan diambil dari atribut kontak (bila ada).\n");
  } else {
    for (const k of semua) {
      const persen = Math.round((k.cocok / k.total) * 100);
      console.log(`  [${k.tipe}] "${k.teks.slice(0, 50)}" — ${persen}% dari ${k.total} jawaban cocok`);
    }
    console.log("");
  }

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
        surveyId: true,
        contact: { select: { attributes: true } },
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
      let kode: string | null = null;
      let sumber: "jawaban" | "atribut" | null = null;

      const pertanyaan = perSurvei.get(r.surveyId);
      if (pertanyaan) {
        const a = r.answers.find((x) => x.questionId === pertanyaan.questionId);
        if (a) {
          kode = kodeProvinsiDari(a.value);
          if (kode) sumber = "jawaban";
        }
      }
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
    console.log(
      `  ${kode}  ${(NAMA.get(kode) ?? kode).padEnd(28)} ${String(n).padStart(5)}  (jawaban ${j}, atribut ${a})`,
    );
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
