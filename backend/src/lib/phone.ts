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
