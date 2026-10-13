// ===== Menggandakan survei — aturan MURNI, tanpa database =====
//
// Pengambilan dan penulisannya ada di services/salinSurvei.ts.

import { sheetTabName, MAX_TAB_CHARS } from "./sheetRows.js";

// Kunci tab Google Sheets sebuah judul. Dibandingkan tanpa membedakan huruf besar-kecil:
// Google menolak dua tab yang namanya hanya beda kapitalisasi.
const kunciTab = (judul: string): string => sheetTabName(judul).toLowerCase();

// Judul salinan yang tidak bertabrakan dengan survei lain DI GOOGLE SHEETS.
//
// Satu survei = satu tab, dan nama tabnya diambil dari judul. Salinan yang judulnya sama
// akan menulis ke tab survei aslinya — baris dua survei bercampur di bawah satu header,
// padahal pertanyaannya bisa sudah berbeda.
//
// Akhirannya dijaga tidak terpotong: nama tab dibatasi 100 karakter, dan judul asli yang
// panjang + " (salinan)" yang terpotong di karakter ke-100 kembali sama dengan aslinya.
export function judulSalinan(asli: string, judulLain: readonly string[]): string {
  const terpakai = new Set(judulLain.map(kunciTab));
  // "X (salinan)" yang digandakan lagi jadi "X (salinan 2)", bukan "X (salinan) (salinan)".
  const dasar = (asli || "").trim().replace(/\s*\(salinan(?: \d+)?\)$/i, "") || "Survei";
  for (let n = 1; ; n++) {
    const akhiran = n === 1 ? " (salinan)" : ` (salinan ${n})`;
    const kandidat = dasar.slice(0, MAX_TAB_CHARS - akhiran.length).trimEnd() + akhiran;
    if (!terpakai.has(kunciTab(kandidat))) return kandidat;
  }
}

// Apakah judul ini akan berbagi tab Google Sheets dengan survei lain?
export function tabBertabrakan(judul: string, judulLain: readonly string[]): boolean {
  const k = kunciTab(judul);
  return judulLain.some((j) => kunciTab(j) === k);
}

// Teks pertanyaan yang muncul lebih dari sekali dalam satu survei.
//
// Ekspor Excel dan Laporan mencocokkan jawaban ke kolom lewat TEKS pertanyaan, jadi dua
// pertanyaan bertulisan sama membuat jawabannya bertumpuk di satu kolom — yang satu
// menimpa yang lain tanpa jejak. Menggandakan pertanyaan membuat ini jauh lebih mudah
// terjadi, karena itu dijaga di sini.
export function teksPertanyaanGanda(questions: readonly { text?: string | null }[]): string[] {
  const hitung = new Map<string, number>();
  for (const q of questions) {
    const t = (q.text ?? "").trim();
    if (t) hitung.set(t, (hitung.get(t) ?? 0) + 1);
  }
  return [...hitung].filter(([, n]) => n > 1).map(([t]) => t);
}
