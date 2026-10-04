// Logika MURNI mesin survei (tanpa efek samping: tanpa DB, tanpa jaringan, tanpa env).
// Dipisah dari services/surveyEngine.ts agar mudah diuji unit. Lihat surveyLogic.test.ts.
import { normalizeMessage } from "./optOut.js";
import { cariWilayah } from "./wilayah.js";
import type { NormalizedInbound } from "../providers/types.js";

export type QLite = { id: string; text: string; type: string; required: boolean; options: any };

// Formulir Flow yang sudah dikirim tapi tak kunjung diisi TIDAK boleh mengunci kontak
// selamanya (dulu: setiap pesan berikutnya diabaikan, termasuk kata kunci pemicu).
// Setelah jendela sesi 24 jam WhatsApp lewat, anggap ditinggalkan → pesan diproses normal.
export const FLOW_ABANDON_MS = 24 * 60 * 60 * 1000;
export function isFlowAbandoned(startedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - startedAt.getTime() > FLOW_ABANDON_MS;
}

// Membalas apa saja setelah menerima blast dianggap "mau ikut survei" — itu memaafkan
// responden yang menjawab "ya"/"ok" alih-alih mengetik kata pemicu. Tapi jalur ini dulu
// dicek untuk SEMUA pesan berikutnya tanpa batas waktu, sehingga kontak yang pernah
// diblast tidak pernah bisa sampai ke Auto Reply / Agen AI: sapaan biasa pun dijawab
// "jawaban Anda sudah kami terima" terus-menerus.
//
// Dua syarat sekarang: survei belum diselesaikan kontak ini, DAN blast masih dalam
// jendela sesi 24 jam WhatsApp (di luar itu balasan bebas memang tak bisa dikirim).
export const BLAST_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function shouldStartSurveyFromBlast(args: {
  blastSentAt: Date;
  alreadyCompleted: boolean;
  text?: string;
  now?: Date;
}): boolean {
  if (args.alreadyCompleted) return false;
  // Pertanyaan bukan kesediaan. "Apakah ada survei" sesudah blast itu orang MENANYAKAN
  // dulu sebelum memutuskan ikut; melemparnya langsung ke formulir/pertanyaan 1 membuat
  // pertanyaannya tak pernah terjawab (laporan lapangan). Biarkan jatuh ke Auto Reply /
  // Agen AI — balasan berikutnya ("ya", "mau", "oke") tetap memulai lewat jendela ini.
  if (looksLikeQuestion(args.text ?? "")) return false;
  const now = args.now ?? new Date();
  return now.getTime() - args.blastSentAt.getTime() <= BLAST_REPLY_WINDOW_MS;
}

// Kata tanya pembuka yang lazim dipakai responden.
const QUESTION_STARTERS = [
  "apa",
  "apakah",
  "bagaimana",
  "gimana",
  "gmn",
  "cara",
  "berapa",
  "kenapa",
  "mengapa",
  "kapan",
  "dimana",
  "di mana",
  "siapa",
  "bisakah",
  "bolehkah",
  "adakah",
  "mohon info",
  "tanya",
];

/**
 * Apakah pesan ini terdengar seperti PERTANYAAN tentang survei, bukan perintah memulainya?
 *
 * Pemicu survei dicocokkan sebagai substring, sehingga "cara isi survei" ikut mengandung
 * kata kunci "isi survei" dan dulu langsung memulai survei — padahal responden sedang
 * bertanya. Penjaga ini membuat pertanyaan diteruskan ke Auto Reply / Agen AI.
 */
export function looksLikeQuestion(text: string): boolean {
  if (!text) return false;
  if (text.includes("?")) return true;
  const t = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  return QUESTION_STARTERS.some((q) => t === q || t.startsWith(`${q} `));
}

// ===== Pencocokan kata pemicu di dalam kalimat (tingkat 3 findTriggeredSurvey) =====
//
// Dulu tingkat ini memakai includes() mentah, dan itu menjaring dua hal yang bukan
// permintaan memulai survei (laporan nyata: survei tiba-tiba mulai padahal isi pesannya
// soal lain):
//   • potongan kata — "sudah saya isi surveinya" mengandung "isi survei";
//   • kalimat panjang yang cuma MENYEBUT survei di tengah cerita.
// looksLikeQuestion tidak menolong di sini karena keduanya pernyataan, bukan pertanyaan.
//
// Tiga syarat sekarang, meniru pola matcher opt-out yang sudah terbukti:
//   1. kalimatnya pendek (perintah itu singkat; cerita itu panjang);
//   2. tidak memuat kata pengingkar/pengabar ("tidak mau isi survei", "sudah isi survei");
//   3. kata kunci muncul sebagai FRASA UTUH, bukan potongan kata.
// Pesan yang gagal di sini tidak hilang: ia jatuh ke Auto Reply / Agen AI, yang tahu kata
// pemicunya dan bisa menyebutkannya. Pesan yang PERSIS sama dengan kata kunci tidak lewat
// sini — tingkat 1 sudah menerimanya, berapa pun panjangnya.

export const MAX_TRIGGER_SENTENCE_WORDS = 8;

// Kalimat yang memuat kata ini sedang bercerita/menolak, bukan meminta mulai.
export const TRIGGER_NEGATION_WORDS = [
  "tidak",
  "ngga",
  "nggak",
  "gak",
  "ga",
  "jangan",
  "belum",
  "sudah",
  "udah",
  "telah",
  "batal",
] as const;

export function matchesTriggerInSentence(text: string, keyword: string): boolean {
  const norm = normalizeMessage(text);
  const kw = normalizeMessage(keyword);
  if (!norm || !kw) return false;
  const words = norm.split(" ");
  if (words.length > MAX_TRIGGER_SENTENCE_WORDS) return false;
  if (TRIGGER_NEGATION_WORDS.some((n) => words.includes(n))) return false;
  return ` ${norm} `.includes(` ${kw} `);
}

// Kata penutup: pakai custom bila diisi, selain itu default.
export function closingText(custom?: string | null): string {
  const c = (custom ?? "").trim();
  return c || "Terima kasih, semua jawaban Anda sudah kami terima. 🙏";
}

// ===== Percabangan (options.branches) =====
// branches: [{ value: "<jawaban>", goto: "end" | <indeks 0-based> }].
// Aturan ini adalah SATU-SATUNYA sumber kebenaran soal pertanyaan mana yang berlaku bagi
// seorang responden — dipakai mesin chat untuk memilih pertanyaan berikutnya, dipakai
// flowJson untuk menyusun komponen If, dan dipakai server untuk menolak jawaban yang
// seharusnya tidak pernah ada.

type Percabangan = { value?: unknown; goto?: unknown };

// Percabangan yang cocok dengan jawaban ini, bila ada. Tak peka huruf besar/kecil & spasi.
function cabangCocok(options: unknown, savedValue: string): Percabangan | undefined {
  const b = (options as { branches?: unknown } | null | undefined)?.branches;
  if (!Array.isArray(b)) return undefined;
  const sv = savedValue.trim().toLowerCase();
  if (!sv || sv === "[dilewati]") return undefined;
  return (b as Percabangan[]).find(
    (x) =>
      String(x?.value ?? "")
        .trim()
        .toLowerCase() === sv,
  );
}

// Percabangan yang MENGHENTIKAN survei (bukan sekadar melompati beberapa pertanyaan).
function mengakhiri(b: Percabangan | undefined): boolean {
  return !!b && (b.goto === "end" || b.goto === -1);
}

// Langkah berikutnya setelah pertanyaan indeks `step` dijawab `savedValue`. Lompat hanya MAJU.
export function langkahBerikut(options: unknown, step: number, savedValue: string, total: number): number {
  const m = cabangCocok(options, savedValue);
  if (!m) return step + 1;
  if (mengakhiri(m)) return total; // akhiri survei lebih awal
  const g = Number(m.goto);
  if (Number.isInteger(g) && g > step && g < total) return g; // lompat maju ke pertanyaan g
  return step + 1;
}

export function nextStepWithBranch(current: QLite, step: number, savedValue: string, total: number): number {
  return langkahBerikut(current.options, step, savedValue, total);
}

export function ratingRange(q: QLite): { min: number; max: number } {
  const min = Number(q.options?.min ?? 1);
  const max = Number(q.options?.max ?? 5);
  return { min: Number.isFinite(min) ? min : 1, max: Number.isFinite(max) ? max : 5 };
}

export function choices(q: QLite): string[] {
  const c = q.options?.choices;
  return Array.isArray(c) ? c.map((x: any) => String(x)) : [];
}

// Label jangkar rating (mis. 1 = "Sangat tidak puas", 5 = "Sangat puas"). null bila tak ada.
export function ratingLabels(q: QLite): { min: string; max: string } | null {
  const mn = String(q.options?.minLabel ?? "").trim();
  const mx = String(q.options?.maxLabel ?? "").trim();
  return mn || mx ? { min: mn, max: mx } : null;
}

// Validasi & normalisasi jawaban per tipe pertanyaan.
export function validateAnswer(
  q: QLite,
  ev: NormalizedInbound,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = (ev.text ?? "").trim();
  switch (q.type) {
    case "image":
      if (ev.mediaType === "image" && ev.mediaId) return { ok: true, value: `[gambar] ${ev.mediaId}` };
      return { ok: false, error: "Mohon kirim berupa foto/gambar." };
    case "rating": {
      const { min, max } = ratingRange(q);
      // Pesan tanpa teks (stiker, suara, lokasi) WAJIB ditolak di sini. Number("") bernilai 0,
      // sehingga pada rentang yang memuat 0 pesan kosong akan lolos sebagai nilai 0.
      if (!text) return { ok: false, error: `Mohon balas dengan angka ${min} sampai ${max}.` };
      const n = Number(text);
      if (Number.isInteger(n) && n >= min && n <= max) return { ok: true, value: String(n) };
      return { ok: false, error: `Mohon balas dengan angka ${min} sampai ${max}.` };
    }
    case "number": {
      const n = Number(text);
      if (Number.isFinite(n) && text !== "") return { ok: true, value: String(n) };
      return { ok: false, error: "Mohon balas dengan angka." };
    }
    case "choice": {
      const opts = choices(q);
      if (!text) return { ok: false, error: "Mohon pilih jawaban." };
      if (!opts.length) return { ok: true, value: text };
      const asNum = Number(text);
      if (Number.isInteger(asNum) && asNum >= 1 && asNum <= opts.length) return { ok: true, value: opts[asNum - 1]! };
      const lc = text.toLowerCase();
      const exact = opts.find((o) => o.toLowerCase() === lc);
      if (exact) return { ok: true, value: exact };
      // Toleransi: cocok sebagian bila TIDAK ambigu (hanya satu pilihan yang cocok).
      // `lc` dijamin tidak kosong oleh penjaga di atas: String.includes("") selalu true,
      // sehingga teks kosong akan mencocoki SEMUA pilihan — dan pada pertanyaan berpilihan
      // tunggal hasilnya tepat satu, lalu tercatat diam-diam sebagai jawaban.
      const partial = opts.filter((o) => o.toLowerCase().includes(lc) || lc.includes(o.toLowerCase()));
      if (partial.length === 1) return { ok: true, value: partial[0]! };
      return { ok: false, error: "Maaf, pilihan belum dikenali. Balas dengan *nomor* pilihan, ya." };
    }
    case "multichoice": {
      const opts = choices(q);
      // Boleh lebih dari satu: pisah dengan koma/spasi/titik koma. Terima nomor atau teks pilihan.
      const tokens = text
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (!tokens.length)
        return { ok: false, error: "Mohon pilih minimal satu. Balas nomor pilihan, boleh >1 dipisah koma (mis. 1,3)." };
      if (!opts.length) return { ok: true, value: tokens.join(", ") };
      const picked: string[] = [];
      for (const tok of tokens) {
        const n = Number(tok);
        if (Number.isInteger(n) && n >= 1 && n <= opts.length) {
          if (!picked.includes(opts[n - 1]!)) picked.push(opts[n - 1]!);
          continue;
        }
        const exact = opts.find((o) => o.toLowerCase() === tok.toLowerCase());
        if (exact) {
          if (!picked.includes(exact)) picked.push(exact);
          continue;
        }
        return { ok: false, error: `Pilihan "${tok}" tak dikenali. Balas nomornya, pisah koma (mis. 1,3).` };
      }
      return { ok: true, value: picked.join(", ") };
    }
    case "wilayah": {
      // Mode chat: responden MENGETIK wilayahnya (di Flow ia berupa dropdown bertingkat).
      // Dicocokkan ke daftar resmi Kepmendagri agar hasilnya sepadan dengan tabel pembobot,
      // bukan sekadar teks bebas yang nanti harus dirapikan manual.
      if (!text) return { ok: false, error: "Mohon tulis nama kabupaten/kota Anda." };
      const r = cariWilayah(text);
      if (r.ok) return { ok: true, value: r.value };
      // Ambigu → tawarkan kandidatnya. Menebak di antara wilayah bernama mirip akan
      // merusak data tanpa meninggalkan jejak.
      if (r.kandidat.length)
        return {
          ok: false,
          error: `Ada beberapa wilayah dengan nama itu. Mohon tulis lebih lengkap:\n${r.kandidat
            .slice(0, 8)
            .map((k) => `• ${k}`)
            .join("\n")}`,
        };
      return {
        ok: false,
        error: "Wilayah belum dikenali. Mohon tulis nama kabupaten/kota, mis. Sleman atau Kota Bandung.",
      };
    }
    case "consent":
    case "boolean": {
      const t = text.toLowerCase();
      if (["ya", "iya", "y", "yes", "ok", "oke", "setuju", "betul", "benar"].includes(t))
        return { ok: true, value: "Ya" };
      if (["tidak", "no", "t", "n", "ngga", "nggak", "gak", "ga", "bukan"].includes(t))
        return { ok: true, value: "Tidak" };
      return {
        ok: false,
        error: q.type === "consent" ? "Mohon balas: Ya (setuju) atau Tidak." : "Mohon balas: Ya atau Tidak.",
      };
    }
    case "date": {
      // Terima dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd → simpan seragam YYYY-MM-DD.
      const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      const parts = iso
        ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
        : dmy
          ? [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
          : null;
      if (parts) {
        const [y, m, d] = parts as [number, number, number];
        const dt = new Date(Date.UTC(y, m - 1, d));
        // Cek tanggal benar-benar ada (mis. 31-02-2026 ditolak).
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d)
          return { ok: true, value: dt.toISOString().slice(0, 10) };
      }
      return { ok: false, error: "Mohon balas tanggal, format DD-MM-YYYY (mis. 17-08-2026)." };
    }
    case "text":
    default:
      if (text) return { ok: true, value: text };
      return { ok: false, error: "Mohon balas dengan teks." };
  }
}

// Format teks pertanyaan + petunjuk tipe.
export function formatQuestion(q: QLite): string {
  let hint = "";
  switch (q.type) {
    case "rating": {
      const { min, max } = ratingRange(q);
      const lab = ratingLabels(q);
      hint = `\n\nBalas angka ${min}-${max}.`;
      if (lab) hint += ` (${min} = ${lab.min || "…"}, ${max} = ${lab.max || "…"})`;
      break;
    }
    case "number":
      hint = "\n\nBalas dengan angka.";
      break;
    case "boolean":
      hint = "\n\nBalas: Ya / Tidak.";
      break;
    case "consent":
      hint = "\n\nBalas: Ya (setuju) / Tidak.";
      break;
    case "date":
      hint = "\n\nBalas tanggal, format DD-MM-YYYY (mis. 17-08-2026).";
      break;
    case "wilayah":
      hint = "\n\nTulis nama kabupaten/kota Anda (mis. Sleman atau Kota Bandung).";
      break;
    case "image":
      hint = "\n\nKirim foto/gambar.";
      break;
    case "choice": {
      const opts = choices(q);
      if (opts.length)
        hint = "\n\n" + opts.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n\nBalas dengan nomor pilihan.";
      break;
    }
    case "multichoice": {
      const opts = choices(q);
      if (opts.length)
        hint =
          "\n\n" +
          opts.map((o, i) => `${i + 1}. ${o}`).join("\n") +
          "\n\nBoleh pilih lebih dari satu — balas nomornya dipisah koma (mis. 1,3).";
      break;
    }
  }
  const skip = q.required ? "" : "\n\n(Ketik LEWATI untuk melewati)";
  return `${q.text}${hint}${skip}`;
}

// Apakah responden tersaring KELUAR — yaitu salah satu jawabannya memicu percabangan
// yang menghentikan survei (goto "end")?
//
// Dikenali dari KONFIGURASI PERCABANGAN survei itu sendiri, bukan dari tipe pertanyaan.
// Pelajaran dari produksi: pertanyaan persetujuan di instrumen yang berjalan bertipe
// "boolean", bukan "consent" — aturan yang bersandar pada tipe tidak mengenai apa pun dan
// gagal secara senyap. Sebaliknya, pertanyaan yang MENGHENTIKAN survei ketika dijawab
// begitu memang gerbang penyaring, menurut konfigurasi pembuat surveinya sendiri.
//
// Responsnya tetap tercatat "selesai" karena survei memang berakhir di situ, tetapi tidak
// membawa data — karena itu tidak dihitung ke kuota. Klien membayar untuk data.
export function disaringKeluar(
  questions: readonly { id: string; options?: unknown }[],
  answers: readonly { questionId: string; value: string }[],
): boolean {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answers.some((a) => mengakhiri(cabangCocok(byId.get(a.questionId)?.options, a.value)));
}

// Indeks pertanyaan yang MENGHENTIKAN survei — yaitu jawabannya memicu percabangan
// goto "end". null bila tidak ada.
//
// Dipakai untuk menolak jawaban yang datang SETELAH titik berhenti. Penyaringan di Flow
// bekerja di sisi klien lewat komponen If, dan itu bisa dilewati: responden menekan tombol
// kembali lalu mengubah jawabannya, atau Flow yang terbit di Meta dibuat sebelum aturan
// percabangan ditambahkan sehingga kondisinya memang tidak ada di sana.
//
// Kejadian nyata di produksi: satu responden menjawab "Tidak" pada informed consent di
// urutan 0, namun 20 jawaban berikutnya tetap terkirim dan tersimpan — nama, provinsi,
// agama, penghasilan, hingga pilihan politiknya. Server tidak boleh memercayai penyaringan
// yang dilakukan klien.
export function indeksPenyaringan(
  questions: readonly { id: string; options?: unknown }[],
  answers: readonly { questionId: string; value: string }[],
): number | null {
  let paling: number | null = null;
  answers.forEach((a) => {
    const i = questions.findIndex((q) => q.id === a.questionId);
    if (i < 0) return;
    if (!mengakhiri(cabangCocok(questions[i]!.options, a.value))) return;
    if (paling === null || i < paling) paling = i;
  });
  return paling;
}

// Pertanyaan mana saja yang BENAR-BENAR berlaku bagi responden ini — ditelusuri dari
// pertanyaan pertama mengikuti percabangan, persis seperti yang dilakukan mesin chat.
//
// Mesin chat tidak pernah salah soal ini: ia memang tidak mengirim pertanyaan yang
// dilompati. Flow lain ceritanya — seluruh formulir dikirim sekali jalan, dan penyaringan
// hanya ada di sisi klien.
//
// Lompatan selalu MAJU, jadi penelusuran ini pasti berhenti.
export function jalurPertanyaan(
  questions: readonly { id: string; options?: unknown }[],
  answers: readonly { questionId: string; value: string }[],
): Set<number> {
  const nilai = new Map(answers.map((a) => [a.questionId, a.value]));
  const total = questions.length;
  const jalur = new Set<number>();
  for (let step = 0; step < total; ) {
    jalur.add(step);
    const q = questions[step]!;
    step = langkahBerikut(q.options, step, nilai.get(q.id) ?? "", total);
  }
  return jalur;
}

// Buang jawaban atas pertanyaan yang TIDAK BERLAKU bagi responden ini menurut percabangan
// survei — baik karena ia tersaring keluar (goto "end") maupun karena pertanyaannya
// dilompati (goto maju). Jawaban di jalurnya tetap sah.
//
// Dua wujudnya di produksi, dua akibat yang berbeda:
//
//   • Tersaring keluar. Satu responden menjawab "Tidak" pada informed consent di urutan 0,
//     namun 20 jawaban berikutnya tetap tersimpan. Menyimpan jawaban orang yang menyatakan
//     tidak bersedia adalah pemrosesan tanpa dasar persetujuan — soal kepatuhan, bukan
//     kebersihan data.
//
//   • Dilompati. Responden menjawab "Tidak" pada "Apakah Anda tahu program X", namun
//     pertanyaan lanjutannya ("Jika Anda tahu, beri nilai…") tetap membawa angka. Itu
//     jawaban yang maknanya mustahil, dan kalau ikut dianalisis ia menggeser rata-rata.
//
// Keduanya lolos lewat pintu yang sama: di Flow, penyaringan hanya dikerjakan komponen If
// di sisi KLIEN, sedangkan payload `complete` mendaftar SEMUA field layar tanpa syarat.
// Begitu responden sempat mengisi lalu mengubah jawaban pemicunya, komponennya memang
// hilang dari layar tetapi nilainya masih tersimpan di state formulir dan ikut terkirim.
export function saringJawaban<T extends { questionId: string; value: string }>(
  questions: readonly { id: string; options?: unknown }[],
  answers: readonly T[],
): { diterima: T[]; ditolak: T[]; batas: number | null } {
  const jalur = jalurPertanyaan(questions, answers);
  const diterima: T[] = [];
  const ditolak: T[] = [];
  for (const a of answers) {
    const i = questions.findIndex((q) => q.id === a.questionId);
    // Pertanyaan yang tidak ditemukan DITERIMA: tanpa posisinya kita tak bisa menyimpulkan
    // ia dilompati, dan menghapus data atas dasar ketidaktahuan lebih buruk daripada
    // menyimpan satu baris yang tak bisa dinilai.
    (i < 0 || jalur.has(i) ? diterima : ditolak).push(a);
  }
  return { diterima, ditolak, batas: indeksPenyaringan(questions, answers) };
}
