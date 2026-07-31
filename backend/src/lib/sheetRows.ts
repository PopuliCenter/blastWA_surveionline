// ===== Bentuk baris Google Sheets (MURNI — tanpa I/O, mudah diuji) =====
//
// Satu tab per survei, satu baris per respons SELESAI. Kolomnya dibuat TETAP —
// berbeda dari ekspor Excel yang menyusun kolom pembobot dari atribut yang kebetulan
// muncul: sheet diisi mencicil baris demi baris, jadi headernya tidak boleh berubah
// bentuk di tengah jalan. Analisis lengkap (termasuk atribut pembobot) tetap lewat
// ekspor Excel; sheet ini untuk PEMANTAUAN tim.

export type SheetQuestion = { id: string; text: string };
export type SheetAnswer = { questionId: string; value: string };

// Batas Google: nama tab maksimal 100 karakter; karakter [ ] * ? / \ : dilarang;
// tanda kutip tunggal mengacaukan notasi A1 ('Tab'!A1) jadi ikut dibuang.
export const MAX_TAB_CHARS = 100;

export function sheetTabName(title: string): string {
  const clean = (title || "")
    .replace(/[[\]*?/\\:']+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TAB_CHARS)
    .trim();
  return clean || "Survei";
}

// Label sumber kontak — DISENGAJA sama persis dengan ekspor Excel
// (src/lib/exportSurvey.js) supaya tim membaca istilah yang satu di kedua tempat.
// Nilai tak dikenal diteruskan apa adanya; hanya yang kosong jadi "(tidak diketahui)".
const SOURCE_LABELS: Record<string, string> = {
  import: "Impor",
  manual: "Manual",
  inbound: "Pesan masuk",
  form: "Formulir",
};

export function sourceLabel(source: string | null | undefined): string {
  const s = (source ?? "").trim();
  if (!s) return "(tidak diketahui)";
  return SOURCE_LABELS[s] ?? s;
}

// Waktu ditulis dalam zona tim (Asia/Jakarta), bukan UTC server — sheet ini dibaca
// manusia saat memantau blast. Format sv-SE menghasilkan "YYYY-MM-DD HH:mm" yang
// terbaca sekaligus terurut benar bila kolomnya di-sort sebagai teks.
export function fmtJakarta(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const FIXED_HEADER = ["Nomor", "Nama", "Sumber Kontak", "Mulai", "Selesai"] as const;

export function sheetHeader(questions: SheetQuestion[]): string[] {
  return [...FIXED_HEADER, ...questions.map((q) => q.text)];
}

export function sheetRow(input: {
  phone: string;
  name: string | null;
  consentSource: string | null;
  startedAt: Date;
  completedAt: Date | null;
  questions: SheetQuestion[];
  answers: SheetAnswer[];
}): string[] {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a.value]));
  return [
    input.phone,
    input.name ?? "",
    sourceLabel(input.consentSource),
    fmtJakarta(input.startedAt),
    fmtJakarta(input.completedAt),
    ...input.questions.map((q) => byQuestion.get(q.id) ?? ""),
  ];
}

// Terima ID spreadsheet ATAU URL lengkapnya — orang hampir selalu menyalin URL dari
// address bar ("https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0").
export function extractSpreadsheetId(input: string): string {
  const t = (input || "").trim();
  const m = t.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? t;
}
