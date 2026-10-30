// ===== Bentuk baris Google Sheets (MURNI — tanpa I/O, mudah diuji) =====
//
// Satu tab per survei, satu baris per respons SELESAI. Kolomnya dibuat TETAP —
// berbeda dari ekspor Excel yang menyusun kolom pembobot dari atribut yang kebetulan
// muncul: sheet diisi mencicil baris demi baris, jadi headernya tidak boleh berubah
// bentuk di tengah jalan. Analisis lengkap (termasuk atribut pembobot) tetap lewat
// ekspor Excel; sheet ini untuk PEMANTAUAN tim.

import { asesmenDurasi, bersihkanKodeWilayah, bulatkanMenit, formatLamaPengisian } from "./asesmenDurasi.js";

// Diekspor ulang supaya pemakai lama (skrip lengkapi-sheets-durasi) tidak perlu berubah.
export { asesmenDurasi } from "./asesmenDurasi.js";

// `type` opsional: hanya dipakai untuk mengenali pertanyaan Wilayah, yang kode resminya
// dibuang di spreadsheet (lihat bersihkanKodeWilayah).
export type SheetQuestion = { id: string; text: string; type?: string };
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
// Di akhir, baris lama sekadar kosong di kolom-kolom terakhir dan tidak ada yang bergeser.
// "Lama Pengisian" menyusul paling akhir karena alasan yang sama: tab yang sudah punya dua
// kolom durasi mendapat judulnya di kanan (ensureTab → judulYangKurang), tanpa menggeser.
export const TRAILING_HEADER = ["Durasi (menit)", "Asesmen Durasi", "Lama Pengisian"] as const;

// Pemeriksaan lokasi, paling belakang — setelah asesmen waktu, dengan alasan yang sama:
// tab yang sudah berisi data mendapat kedua judulnya di kanan, tanpa menggeser apa pun.
// Hanya untuk survei yang meminta lokasi; isinya sama persis dengan ekspor Excel
// (lib/lokasi.ts kolomLokasiSheet).
export const JUDUL_LOKASI = ["Provinsi Lokasi", "Status Lokasi"] as const;

export function sheetHeader(questions: SheetQuestion[], opsi: { lokasi?: boolean } = {}): string[] {
  return [...FIXED_HEADER, ...questions.map((q) => q.text), ...TRAILING_HEADER, ...(opsi.lokasi ? JUDUL_LOKASI : [])];
}

// ===== Asesmen durasi pengisian =====
//
// Aturannya (bawaan maupun milik survei) ada di lib/asesmenDurasi.ts.

// null bila tak dapat dihitung: respons belum selesai, atau stempel waktunya terbalik.
// Tidak jatuh ke salah satu kategori — "tidak diketahui" bukan "terlalu cepat".
export function durasiMenit(startedAt: Date | null, completedAt: Date | null): number | null {
  const a = startedAt ? startedAt.getTime() : NaN;
  const b = completedAt ? completedAt.getTime() : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60000;
}

export function sheetRow(input: {
  phone: string;
  name: string | null;
  consentSource: string | null;
  startedAt: Date;
  completedAt: Date | null;
  questions: SheetQuestion[];
  answers: SheetAnswer[];
  // Survey.aturanDurasi; kosong/rusak = aturan bawaan.
  aturanDurasi?: unknown;
  // [Provinsi Lokasi, Status Lokasi] — hanya bila header-nya memuat JUDUL_LOKASI.
  lokasi?: readonly [string, string];
}): (string | number)[] {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a.value]));
  const menit = durasiMenit(input.startedAt, input.completedAt);
  const jawaban = (q: SheetQuestion): string => {
    const v = byQuestion.get(q.id) ?? "";
    return q.type === "wilayah" ? bersihkanKodeWilayah(v) : v;
  };
  return [
    input.phone,
    input.name ?? "",
    sourceLabel(input.consentSource),
    fmtJakarta(input.startedAt),
    fmtJakarta(input.completedAt),
    ...input.questions.map(jawaban),
    // Angka, bukan teks: Sheets perlu bisa menyortir dan merata-ratakannya.
    menit === null ? "" : bulatkanMenit(menit),
    asesmenDurasi(menit, input.aturanDurasi),
    // "1 menit 54 detik" — arti angka desimal di kolom Durasi, yang sering terbaca keliru.
    // Dari angka yang SAMA dengan kolom Durasi (sudah dibulatkan): 1,9 harus terbaca
    // 1 menit 54 detik, bukan 1 menit 53 detik dari detik aslinya — kalau tidak, kolom
    // penjelas justru tampak membantah angka yang dijelaskannya.
    formatLamaPengisian(menit === null ? null : bulatkanMenit(menit)),
    ...(input.lokasi ?? []),
  ];
}

// Susun baris untuk tab yang judul kolomnya SEBENARNYA `aktual`.
//
// Kolom identitas dan pertanyaan tetap ditaruh menurut URUTAN — begitulah tab itu dibuat.
// Kolom buntut (durasi, asesmen, lama pengisian) ditaruh menurut JUDULNYA: di tab lama, tim
// bisa saja sudah menambah kolom sendiri tepat di kanan "Asesmen Durasi" — "Catatan QC"
// misalnya — dan menulis menurut urutan akan mengisi kolom itu dengan data otomatis tanpa
// galat apa pun. Kolom buntut yang judulnya tidak ada di tab dilewati: kolom kosong jauh
// lebih tidak berbahaya daripada data di bawah judul yang salah.
//
// Tab yang judul kolomnya belum ada sama sekali (baris pertama kosong) tetap menurut urutan,
// seperti sebelumnya.
export function susunBarisSheet(
  diharapkan: readonly string[],
  aktual: readonly string[],
  nilai: readonly (string | number)[],
): (string | number)[] {
  if (!aktual.length) return [...nilai];
  // Buntutnya mulai di kolom Durasi — dicari dari BELAKANG, supaya pertanyaan yang kebetulan
  // berjudul sama tidak terkecoh. Jumlah kolom buntut tidak tetap: kolom lokasi hanya ada
  // pada survei yang meminta lokasi.
  const iDurasi = diharapkan.lastIndexOf(TRAILING_HEADER[0]);
  const awalBuntut = iDurasi >= 0 ? iDurasi : diharapkan.length - TRAILING_HEADER.length;
  const baris: (string | number)[] = nilai.slice(0, awalBuntut);
  for (let k = awalBuntut; k < diharapkan.length; k++) {
    const idx = aktual.findIndex((h, i) => i >= awalBuntut && h.trim() === diharapkan[k]);
    if (idx < 0) continue;
    while (baris.length < idx) baris.push("");
    baris[idx] = nilai[k] ?? "";
  }
  return baris;
}

// Baris data (0 = baris kedua spreadsheet) milik respons ini: Nomor dan Mulai-nya sama.
// Dipakai untuk memperbarui kolom lokasi yang datang SETELAH barisnya terkirim. Dicocokkan
// menurut isi, bukan nomor baris: tim bisa menyortir atau menyisipkan baris sesukanya.
// Kosong bila kolom Nomor/Mulai tidak ada — tab itu bukan susunan worker.
export function cariBarisRespons(
  header: readonly string[],
  baris: readonly (readonly unknown[])[],
  phone: string,
  mulai: string,
): number[] {
  const iNomor = header.indexOf(FIXED_HEADER[0]);
  const iMulai = header.indexOf(FIXED_HEADER[3]);
  if (iNomor < 0 || iMulai < 0) return [];
  const hasil: number[] = [];
  baris.forEach((b, i) => {
    if (kunciBaris(b[iNomor], b[iMulai]) === kunciBaris(phone, mulai)) hasil.push(i);
  });
  return hasil;
}

// Kunci pengenal baris: Nomor + Mulai (WIB, sampai menit — format fmtJakarta).
export const kunciBaris = (nomor: unknown, mulai: unknown): string =>
  `${String(nomor ?? "").trim()}|${String(mulai ?? "").trim()}`;

// Terima ID spreadsheet ATAU URL lengkapnya — orang hampir selalu menyalin URL dari
// address bar ("https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0").
export function extractSpreadsheetId(input: string): string {
  const t = (input || "").trim();
  const m = t.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? t;
}

// ===== Melengkapi tab yang sudah berisi data =====
//
// Durasi baris lama dihitung dari kolom "Mulai" dan "Selesai" DI SPREADSHEET ITU SENDIRI,
// bukan dicocokkan kembali ke basis data. Mencocokkannya butuh kunci unik yang tidak ada:
// satu nomor bisa mengisi lebih dari sekali, dan urutan baris bisa sudah diubah tim yang
// menyortir tabelnya. Menghitung dari kolom di baris yang sama tidak mungkin salah-pasang —
// nilainya selalu milik baris itu.

// Format tulisan fmtJakarta: "YYYY-MM-DD HH:MM", keduanya waktu Jakarta. Karena kedua
// kolom sezona, selisihnya benar tanpa perlu konversi apa pun.
export function parseWaktuSheet(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec((v || "").trim());
  if (!m) return null;
  const [, y, bl, d, h, mi] = m;
  return Date.UTC(Number(y), Number(bl) - 1, Number(d), Number(h), Number(mi));
}

export function durasiDariSheet(mulai: string, selesai: string): number | null {
  const a = parseWaktuSheet(mulai);
  const b = parseWaktuSheet(selesai);
  if (a === null || b === null || b < a) return null;
  return (b - a) / 60000;
}
