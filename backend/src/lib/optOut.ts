// ===== Deteksi permintaan berhenti (opt-out) & berlangganan lagi (opt-in) =====
//
// Ada dua tingkat ketelitian, dan bedanya penting:
//
// KETAT (isOptOutExact) — seluruh pesan harus persis satu perintah, mis. "STOP".
//   Dipakai saat kontak SEDANG mengisi survei. Di survei kebijakan publik, jawaban
//   pendek seperti "cabut saja" atau "berhenti" bisa saja merupakan JAWABAN, bukan
//   permintaan berhenti. Salah tangkap di sini berarti responden terlempar dari
//   daftar di tengah pengisian.
//
// LONGGAR (isOptOutMessage) — pesan pendek (maks 4 kata) yang memuat kata berhenti
//   sebagai kata utuh. Dipakai saat kontak TIDAK sedang mengisi survei, sehingga
//   "STOP.", "berhenti ya", dan "saya mau berhenti" ikut tertangkap.
//
// Keduanya menolak potongan kata: "pemberhentian" bukan permintaan berhenti.

export const OPT_OUT_WORDS = [
  "berhenti",
  "stop",
  "unsubscribe",
  "unsub",
  "cabut",
  "hapus saya",
  "berhenti langganan",
] as const;

export const OPT_IN_WORDS = ["mulai", "langganan", "berlangganan", "subscribe", "daftar", "gabung"] as const;

export const MAX_OPT_OUT_WORDS = 4;

// Turunkan ke huruf kecil, buang tanda baca/emoji, rapatkan spasi.
export function normalizeMessage(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cocok bila `term` muncul sebagai kata/frasa utuh di dalam pesan yang sudah dinormalisasi.
function hasTerm(norm: string, term: string): boolean {
  return ` ${norm} `.includes(` ${term} `);
}

function matchesAny(text: string, terms: readonly string[]): boolean {
  const norm = normalizeMessage(text);
  if (!norm) return false;
  if (norm.split(" ").length > MAX_OPT_OUT_WORDS) return false;
  return terms.some((t) => hasTerm(norm, t));
}

// Ketat: seluruh pesan (setelah dinormalisasi) persis sama dengan salah satu perintah.
export function isOptOutExact(text: string): boolean {
  const norm = normalizeMessage(text);
  return Boolean(norm) && (OPT_OUT_WORDS as readonly string[]).includes(norm);
}

export function isOptInExact(text: string): boolean {
  const norm = normalizeMessage(text);
  return Boolean(norm) && (OPT_IN_WORDS as readonly string[]).includes(norm);
}

// Longgar: pesan pendek yang memuat kata berhenti sebagai kata utuh.
export function isOptOutMessage(text: string): boolean {
  return matchesAny(text, OPT_OUT_WORDS);
}

export function isOptInMessage(text: string): boolean {
  return matchesAny(text, OPT_IN_WORDS);
}

export const OPT_OUT_REPLY = "Anda telah berhenti menerima pesan dari kami. Balas *MULAI* untuk berlangganan kembali.";
export const OPT_IN_REPLY = "Terima kasih, Anda kembali berlangganan pesan kami. 🙏";
