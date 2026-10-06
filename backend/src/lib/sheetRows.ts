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

// Kolom asesmen diletakkan di AKHIR, setelah kolom pertanyaan — bukan di samping Mulai
// dan Selesai, tempat yang sebenarnya lebih logis.
//
// Sebabnya: header spreadsheet hanya ditulis saat tabnya dibuat, dan tab yang sudah berisi
// data tidak pernah ditimpa. Menyisipkan dua kolom di tengah akan menggeser SETIAP baris
// baru dua kolom ke kanan — jawaban pertanyaan pertama mendarat di kolom berjudul
// pertanyaan ketiga, dan seterusnya. Tidak ada galat, spreadsheet tetap terisi, dan
// barisnya baru ketahuan salah setelah angkanya dianalisis.
//
// Di akhir, baris lama sekadar kosong di dua kolom terakhir dan tidak ada yang bergeser.
const TRAILING_HEADER = ["Durasi (menit)", "Asesmen Durasi"] as const;

export function sheetHeader(questions: SheetQuestion[]): string[] {
  return [...FIXED_HEADER, ...questions.map((q) => q.text), ...TRAILING_HEADER];
}

// ===== Asesmen durasi pengisian =====
//
// Ambangnya DISALIN dari src/lib/exportSurvey.js; dua berkas karena frontend dan backend
// tidak berbagi modul. Uji di kedua sisi memakai titik batas yang sama, jadi perubahan di
// satu tempat tanpa yang lain akan membuat salah satunya gagal.
export const AMBANG_DURASI = { cepat: 2, normal: 10, lambat: 30 } as const;

// null bila tak dapat dihitung: respons belum selesai, atau stempel waktunya terbalik.
// Tidak jatuh ke salah satu kategori — "tidak diketahui" bukan "terlalu cepat".
export function durasiMenit(startedAt: Date | null, completedAt: Date | null): number | null {
  const a = startedAt ? startedAt.getTime() : NaN;
  const b = completedAt ? completedAt.getTime() : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60000;
}

export function asesmenDurasi(menit: number | null): string {
  if (menit === null || !Number.isFinite(menit)) return "";
  if (menit < AMBANG_DURASI.cepat) return "Terlalu cepat";
  if (menit <= AMBANG_DURASI.normal) return "Normal";
  if (menit <= AMBANG_DURASI.lambat) return "Lambat";
  return "Terlalu lama";
}

export function sheetRow(input: {
  phone: string;
  name: string | null;
  consentSource: string | null;
  startedAt: Date;
  completedAt: Date | null;
  questions: SheetQuestion[];
  answers: SheetAnswer[];
}): (string | number)[] {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a.value]));
  const menit = durasiMenit(input.startedAt, input.completedAt);
  return [
    input.phone,
    input.name ?? "",
    sourceLabel(input.consentSource),
    fmtJakarta(input.startedAt),
    fmtJakarta(input.completedAt),
    ...input.questions.map((q) => byQuestion.get(q.id) ?? ""),
    // Angka, bukan teks: Sheets perlu bisa menyortir dan merata-ratakannya.
    menit === null ? "" : Math.round(menit * 10) / 10,
    asesmenDurasi(menit),
  ];
}

// Terima ID spreadsheet ATAU URL lengkapnya — orang hampir selalu menyalin URL dari
// address bar ("https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0").
export function extractSpreadsheetId(input: string): string {
  const t = (input || "").trim();
  const m = t.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? t;
}
