/**
 * Audit mutu data respons survei. HANYA MELAPORKAN — tidak menghapus, tidak mengubah apa pun.
 *
 * Memutuskan responden mana yang keluar dari analisis adalah keputusan metodologis milik
 * peneliti. Tiap pemeriksaan di bawah punya kemungkinan salah tuduh, dan responden jujur
 * yang terbuang diam-diam merusak sampel dengan cara yang tidak bisa diperbaiki belakangan.
 * Jadi yang dihasilkan daftar untuk diperiksa manusia, bukan tindakan.
 *
 * Tujuh pemeriksaan, semuanya dari data yang sudah ada:
 *   tersaring     jawaban pada pertanyaan yang seharusnya dilewati percabangan
 *   cepat         selesai di bawah 2 menit
 *   seragam       semua jawaban berskala bernilai sama (straightlining)
 *   tidakLengkap  kurang dari 60% pertanyaan yang BERLAKU terjawab
 *   banyakMenolak lebih dari separuh jawabannya berupa penolakan menjawab
 *   namaJanggal   nama tanpa huruf yang cukup untuk dibaca sebagai nama
 *   kembar        rangkaian jawaban sama persis dengan respons lain
 *
 * Pemakaian (dari folder backend/):
 *   npm run audit:mutu                  # seluruh survei
 *   npm run audit:mutu -- --survei=<id> # satu survei
 *   npm run audit:mutu -- --detail      # tampilkan tiap responden bermasalah
 */
import { prisma } from "../db.js";
import { saringJawaban, jalurPertanyaan } from "../lib/surveyLogic.js";
import {
  periksaRespons,
  jawabanSeragam,
  menolakMenjawab,
  sidikJawaban,
  MIN_JAWABAN_KEMBAR,
  type RingkasRespons,
  type Temuan,
} from "../lib/mutuData.js";

const LABEL: Record<Temuan["kode"], string> = {
  tersaring: "Jawaban di luar jalur percabangan",
  cepat: "Selesai terlalu cepat (<2 menit)",
  seragam: "Semua jawaban berskala sama",
  tidakLengkap: "Kurang dari 60% pertanyaan terjawab",
  banyakMenolak: "Lebih dari separuh menolak menjawab",
  namaJanggal: "Nama tidak terbaca sebagai nama",
  kembar: "Rangkaian jawaban kembar",
};

function arg(nama: string): string | null {
  const p = process.argv.find((a) => a.startsWith(`--${nama}=`));
  return p ? p.slice(nama.length + 3) : null;
}

async function main(): Promise<void> {
  const detail = process.argv.includes("--detail");
  const surveiId = arg("survei");

  const surveys = await prisma.survey.findMany({
    where: surveiId ? { id: surveiId } : {},
    select: { id: true, title: true, questions: { select: { id: true, text: true, type: true, options: true }, orderBy: { order: "asc" } } },
  });
  if (!surveys.length) {
    console.log("Tidak ada survei yang cocok.");
    return;
  }

  for (const s of surveys) {
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: s.id, completedAt: { not: null } },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        contact: { select: { name: true, phone: true } },
        answers: { select: { questionId: true, value: true } },
      },
    });
    if (!responses.length) continue;

    // Sidik dikumpulkan lebih dulu: "kembar" baru bisa dinilai setelah seluruh respons
    // terbaca, karena yang dicari adalah kesamaan ANTAR baris.
    const ringkas: (RingkasRespons & { phone: string })[] = [];
    const jumlahSidik = new Map<string, number>();

    for (const r of responses) {
      const { diterima, ditolak } = saringJawaban(s.questions, r.answers);
      const jalur = jalurPertanyaan(s.questions, r.answers);
      const menit =
        r.completedAt && r.startedAt && r.completedAt >= r.startedAt
          ? (r.completedAt.getTime() - r.startedAt.getTime()) / 60000
          : null;
      const sidik = diterima.length >= MIN_JAWABAN_KEMBAR ? sidikJawaban(diterima) : null;
      if (sidik) jumlahSidik.set(sidik, (jumlahSidik.get(sidik) ?? 0) + 1);

      ringkas.push({
        id: r.id,
        phone: r.contact?.phone ?? "",
        nama: r.contact?.name ?? null,
        menit,
        // Pembaginya pertanyaan yang BERLAKU bagi responden ini, bukan seluruh survei:
        // yang tersaring lewat percabangan jika tidak akan selalu terlihat tidak lengkap.
        berlaku: jalur.size,
        terjawab: diterima.length,
        ditolakPenyaringan: ditolak.length,
        seragam: jawabanSeragam(s.questions, diterima),
        menolak: diterima.filter((a) => menolakMenjawab(a.value)).length,
        sidik,
      });
    }

    const hitung = new Map<Temuan["kode"], number>();
    const bermasalah: { r: (typeof ringkas)[number]; t: Temuan[] }[] = [];
    for (const r of ringkas) {
      const t = periksaRespons(r, jumlahSidik);
      if (!t.length) continue;
      bermasalah.push({ r, t });
      for (const x of t) hitung.set(x.kode, (hitung.get(x.kode) ?? 0) + 1);
    }

    console.log(`\n${s.title}`);
    console.log(`  Respons selesai     : ${responses.length}`);
    console.log(`  Kena minimal satu   : ${bermasalah.length} (${Math.round((bermasalah.length / responses.length) * 100)}%)`);
    for (const [kode, label] of Object.entries(LABEL) as [Temuan["kode"], string][]) {
      const n = hitung.get(kode) ?? 0;
      if (n) console.log(`    ${String(n).padStart(5)}  ${label}`);
    }

    if (detail) {
      console.log("");
      for (const { r, t } of bermasalah.slice(0, 200)) {
        console.log(`    ${r.phone} ${r.nama ?? ""} — ${t.map((x) => x.pesan).join("; ")}`);
      }
      if (bermasalah.length > 200) console.log(`    … dan ${bermasalah.length - 200} lagi`);
    }
  }

  console.log(
    "\nTidak ada data yang diubah. Tiap pemeriksaan bisa salah tuduh, jadi putuskan sendiri" +
      "\nresponden mana yang dikeluarkan — jalankan dengan --detail untuk melihat daftarnya.",
  );
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
