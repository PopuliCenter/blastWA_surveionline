// Pemeriksaan mutu data respons survei — MURNI, tanpa I/O.
//
// Semuanya hanya MELAPORKAN, tidak pernah membuang. Memutuskan responden mana yang keluar
// dari analisis adalah keputusan metodologis milik peneliti, bukan milik program: tiap
// pemeriksaan di bawah punya kemungkinan salah tuduh, dan responden jujur yang terbuang
// diam-diam merusak sampel dengan cara yang tidak bisa diperbaiki belakangan.
//
// Yang dipakai hanya data yang memang sudah ada — tidak ada yang perlu ditanyakan ulang
// kepada responden.

export type QLite = { id: string; text: string; type: string; options?: unknown };
export type JawabLite = { questionId: string; value: string };

export type Temuan = {
  kode: "tersaring" | "seragam" | "cepat" | "tidakLengkap" | "namaJanggal" | "banyakMenolak" | "kembar";
  pesan: string;
};

// Nilai yang berarti responden menolak/melewati, bukan menjawab. Dicocokkan apa adanya
// dengan pilihan yang dipakai instrumen.
const MENOLAK = new Set(["menolak menjawab", "tidak tahu", "tidak jawab", "[dilewati]", "rahasia"]);

export function menolakMenjawab(v: string): boolean {
  return MENOLAK.has((v || "").trim().toLowerCase());
}

// ===== Straightlining =====
//
// Memilih nilai yang sama untuk semua pertanyaan berskala — "5" terus, atau "Setuju" terus.
// Ini petunjuk pengisian asal yang paling kuat setelah durasi, karena pada instrumen dengan
// pertanyaan berarah terbalik jawaban seragam secara logis mustahil konsisten.
//
// Ambang 5 pertanyaan: di bawah itu keseragaman bisa saja kebetulan, dan menuduh orang
// berdasarkan tiga jawaban yang kebetulan sama akan menghasilkan lebih banyak salah tuduh
// daripada temuan.
export const MIN_SKALA_SERAGAM = 5;

export function jawabanSeragam(questions: readonly QLite[], answers: readonly JawabLite[]): boolean {
  const tipe = new Map(questions.map((q) => [q.id, q.type]));
  const skala = answers.filter((a) => {
    const t = tipe.get(a.questionId);
    return (t === "rating" || t === "choice") && !menolakMenjawab(a.value);
  });
  if (skala.length < MIN_SKALA_SERAGAM) return false;
  const pertama = skala[0]!.value.trim().toLowerCase();
  return skala.every((a) => a.value.trim().toLowerCase() === pertama);
}

// ===== Kelengkapan =====
//
// Pembaginya adalah pertanyaan yang BERLAKU bagi responden itu, bukan seluruh pertanyaan
// survei. Tanpa itu, siapa pun yang tersaring lewat percabangan akan selalu terlihat tidak
// lengkap — padahal justru merekalah yang mengikuti aturan instrumen dengan benar.
export function rasioKelengkapan(berlaku: number, terjawab: number): number {
  if (berlaku <= 0) return 1;
  return Math.min(1, terjawab / berlaku);
}

// ===== Nama =====
//
// Nama profil WhatsApp sering berupa nama panggilan, emoji, atau satu-dua huruf. Itu bukan
// kecurangan — tapi pada survei yang menanyakan nama secara terpisah, selisih antara nama
// profil dan nama yang diketik layak dilihat. Yang ditandai hanya yang hampir pasti bukan
// nama: terlalu pendek, atau tanpa huruf sama sekali.
export function namaJanggal(nama: string | null | undefined): boolean {
  const s = (nama || "").trim();
  if (!s) return false; // kosong bukan janggal — banyak kontak impor memang tanpa nama
  const huruf = s.replace(/[^\p{L}]/gu, "");
  return huruf.length < 3;
}

// ===== Rangkaian jawaban kembar =====
//
// Dua respons dengan urutan jawaban yang sama PERSIS pada instrumen berpuluh pertanyaan
// praktis mustahil terjadi secara kebetulan; biasanya satu orang mengisi berkali-kali dari
// nomor berbeda. Sidik jarinya diurut menurut pertanyaan agar urutan penyimpanan tidak
// berpengaruh.
export function sidikJawaban(answers: readonly JawabLite[]): string {
  return answers
    .map((a) => `${a.questionId}=${a.value.trim().toLowerCase()}`)
    .sort()
    .join("|");
}

// Sidik dianggap berarti hanya bila jawabannya cukup banyak — dua responden yang sama-sama
// hanya menjawab satu pertanyaan consent tentu saja identik, dan itu tidak menunjukkan apa pun.
export const MIN_JAWABAN_KEMBAR = 8;

export type RingkasRespons = {
  id: string;
  nama: string | null;
  menit: number | null;
  berlaku: number;
  terjawab: number;
  ditolakPenyaringan: number;
  seragam: boolean;
  menolak: number;
  sidik: string | null;
};

export const AMBANG = {
  menitCepat: 2,
  kelengkapanMin: 0.6,
  rasioMenolakMaks: 0.5,
} as const;

// Temuan per responden. Satu responden bisa kena lebih dari satu.
export function periksaRespons(r: RingkasRespons, jumlahSidik: Map<string, number>): Temuan[] {
  const out: Temuan[] = [];
  if (r.ditolakPenyaringan > 0)
    out.push({
      kode: "tersaring",
      pesan: `${r.ditolakPenyaringan} jawaban pada pertanyaan yang seharusnya dilewati percabangan`,
    });
  if (r.menit !== null && r.menit < AMBANG.menitCepat)
    out.push({ kode: "cepat", pesan: `selesai dalam ${r.menit.toFixed(1)} menit` });
  if (r.seragam) out.push({ kode: "seragam", pesan: "semua jawaban berskala bernilai sama" });

  const lengkap = rasioKelengkapan(r.berlaku, r.terjawab);
  if (lengkap < AMBANG.kelengkapanMin)
    out.push({
      kode: "tidakLengkap",
      pesan: `${r.terjawab} dari ${r.berlaku} pertanyaan yang berlaku terjawab (${Math.round(lengkap * 100)}%)`,
    });

  if (r.terjawab > 0 && r.menolak / r.terjawab > AMBANG.rasioMenolakMaks)
    out.push({
      kode: "banyakMenolak",
      pesan: `${r.menolak} dari ${r.terjawab} jawaban berupa penolakan menjawab`,
    });

  if (namaJanggal(r.nama)) out.push({ kode: "namaJanggal", pesan: `nama "${r.nama}" tidak terbaca sebagai nama` });

  if (r.sidik && (jumlahSidik.get(r.sidik) ?? 0) > 1)
    out.push({
      kode: "kembar",
      pesan: `rangkaian jawabannya sama persis dengan ${(jumlahSidik.get(r.sidik) ?? 1) - 1} respons lain`,
    });
  return out;
}
