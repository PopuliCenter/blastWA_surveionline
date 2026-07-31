// Logika MURNI mesin survei (tanpa efek samping: tanpa DB, tanpa jaringan, tanpa env).
// Dipisah dari services/surveyEngine.ts agar mudah diuji unit. Lihat surveyLogic.test.ts.
import { normalizeMessage } from "./optOut.js";
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
  now?: Date;
}): boolean {
  if (args.alreadyCompleted) return false;
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

// Langkah berikutnya berdasarkan aturan percabangan (options.branches). Lompat hanya MAJU.
// branches: [{ value: "<jawaban>", goto: "end" | <indeks 0-based> }].
export function nextStepWithBranch(current: QLite, step: number, savedValue: string, total: number): number {
  const def = step + 1;
  const branches = (current.options as { branches?: { value: string; goto: string | number }[] } | null)?.branches;
  if (!Array.isArray(branches) || !savedValue || savedValue === "[dilewati]") return def;
  const sv = savedValue.trim().toLowerCase();
  const m = branches.find(
    (b) =>
      String(b.value ?? "")
        .trim()
        .toLowerCase() === sv,
  );
  if (!m) return def;
  if (m.goto === "end" || m.goto === -1) return total; // akhiri survei lebih awal
  const g = Number(m.goto);
  if (Number.isInteger(g) && g > step && g < total) return g; // lompat maju ke pertanyaan g
  return def;
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
      if (!opts.length) return text ? { ok: true, value: text } : { ok: false, error: "Mohon pilih jawaban." };
      const asNum = Number(text);
      if (Number.isInteger(asNum) && asNum >= 1 && asNum <= opts.length) return { ok: true, value: opts[asNum - 1]! };
      const lc = text.toLowerCase();
      const exact = opts.find((o) => o.toLowerCase() === lc);
      if (exact) return { ok: true, value: exact };
      // Toleransi: cocok sebagian bila TIDAK ambigu (hanya satu pilihan yang cocok)
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
