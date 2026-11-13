// Normalisasi nomor ke format E.164 tanpa "+", default negara Indonesia (62).
// Contoh: "0812-3456-789" -> "62812345 6789" -> "62812345789"
export function normalizePhone(input: string, defaultCountry = "62"): string {
  let s = (input || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = defaultCountry + s.slice(1);
  // Nomor lokal tanpa 0/62 (mis. "8123..." dari dataset) → beri kode negara
  else if (s.startsWith("8")) s = defaultCountry + s;
  // Sudah diawali kode negara
  return s;
}

export function isValidPhone(input: string): boolean {
  const s = normalizePhone(input);
  return /^\d{8,15}$/.test(s);
}

// Nomor HP yang DIKETIK responden survei (pertanyaan tipe "phone", mis. nomor e-wallet
// GoPay/DANA/OVO untuk imbalan) → bentuk baku "62…", atau null bila tidak sah.
//
// Lebih ketat daripada isValidPhone, yang dipakai untuk nomor hasil impor: normalizePhone
// membuang SEMUA selain angka, jadi "nomor saya 0812…" atau "abc123" akan lolos menjadi
// deret angka. Jawaban survei hanya boleh berisi angka beserta pemisah yang lazim ditulis
// orang (spasi, titik, strip, kurung, "+" di depan). Hanya nomor Indonesia (62) — imbalan
// e-wallet hanya bisa dikirim ke nomor terdaftar di Indonesia — dengan 10–15 digit, dan
// digit sesudah 62 bukan 0 ("0062…" atau "0 62…" yang salah ketik tidak ikut lolos).
export function nomorHpSurvei(input: string): string | null {
  const t = (input ?? "").trim();
  if (!t || !/^\+?[\d\s.\-()]+$/.test(t)) return null;
  const n = normalizePhone(t);
  return /^62[1-9]\d{7,12}$/.test(n) ? n : null;
}
