import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { parseServiceAccount } from "../lib/googleAuth.js";
import { kolomLokasiSheet } from "../lib/lokasi.js";
import { JUDUL_LOKASI, cariBarisRespons, fmtJakarta, sheetTabName } from "../lib/sheetRows.js";
import { batasTerpasang, provinsiDariTitik } from "./petaProvinsi.js";
import { galatTabTidakAda, kolomA1, readRange, readRanges, writeCells } from "./sheetPush.js";

// Kolom lokasi di Google Sheets: "Provinsi Lokasi" dan "Status Lokasi", paling belakang.

// Field respons yang dibutuhkan untuk mengisinya.
export const PILIH_LOKASI = {
  lokasiDimintaPada: true,
  lokasiDiterimaPada: true,
  lokasiLat: true,
  lokasiLng: true,
  kodeProvinsiLokasi: true,
  kodeProvinsi: true,
} as const;

type DataLokasi = {
  lokasiDimintaPada: Date | null;
  lokasiDiterimaPada: Date | null;
  lokasiLat: number | null;
  lokasiLng: number | null;
  kodeProvinsiLokasi: string | null;
  kodeProvinsi: string | null;
};

// Kolomnya ada bila survei meminta lokasi — atau respons ini pernah dimintai/membagikannya,
// walau survei sudah berhenti memintanya. Sama dengan syarat kolom lokasi di ekspor Excel.
export const lokasiDiSheet = (mintaLokasi: boolean, r: DataLokasi): boolean =>
  mintaLokasi || Boolean(r.lokasiDimintaPada || r.lokasiDiterimaPada);

// [Provinsi Lokasi, Status Lokasi] — sama dengan ekspor Excel. Provinsi yang belum tersimpan
// (lokasi dibagikan sebelum garis batas terpasang) dihitung dari titiknya, seperti layar
// Respons; menyimpannya permanen tetap tugas skrip lengkapi:lokasi.
export async function nilaiLokasiSheet(r: DataLokasi): Promise<[string, string]> {
  const terpasang = await batasTerpasang();
  let kode = r.kodeProvinsiLokasi;
  if (!kode && terpasang && r.lokasiDiterimaPada && r.lokasiLat != null && r.lokasiLng != null)
    kode = await provinsiDariTitik({ lat: r.lokasiLat, lng: r.lokasiLng });
  return kolomLokasiSheet({ ...r, kodeProvinsiLokasi: kode }, terpasang);
}

// Perbarui dua sel lokasi pada baris respons yang SUDAH ada di Sheets (job "lokasi" — saat
// lokasinya diterima, setelah barisnya terkirim).
//
// Job ini MENIMPA sel di baris lama, jadi letak kolomnya selalu dibaca SEGAR dari baris
// judul — tidak pernah dari cache judul ensureTab (bisa basi 10 menit, dan berupa judul
// andaian bila Google sempat galat). Kolom yang disisipkan tim di tengah menggeser letak
// "Provinsi Lokasi"; memakai letak lama berarti menimpa kolom milik tim.
//
// Barisnya dicari menurut Nomor + Mulai, bukan nomor baris. Hanya kedua sel itu yang
// ditulis. Yang tidak pasti dilewati, bukan ditebak: baris belum terkirim (job sinkron nanti
// menulis keadaan terkini sendiri), tab sudah tidak ada (tidak dibuatkan yang baru), kolom
// lokasi belum ada (tab lama — diisi skrip lengkapi:sheets), atau lebih dari satu baris cocok.
export async function perbaruiLokasiDiSheet(responseId: string): Promise<string> {
  const cfg = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
  if (!cfg?.enabled || !cfg.spreadsheetId || !cfg.serviceAccountJson) return "skip-nonaktif";

  const r = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    select: {
      ...PILIH_LOKASI,
      startedAt: true,
      completedAt: true,
      ditolakKuotaPada: true,
      sheetSyncedAt: true,
      contact: { select: { phone: true } },
      survey: { select: { title: true } },
    },
  });
  if (!r || !r.completedAt || r.ditolakKuotaPada) return "skip-tidak-dikirim";
  if (!r.sheetSyncedAt) return "skip-belum-ada-baris";

  const sa = parseServiceAccount(decryptJson<string>(cfg.serviceAccountJson));
  const tab = sheetTabName(r.survey.title);

  // Judul segar + kolom identitas (Nomor…Selesai) dalam SATU permintaan baca.
  let judulBaris: string[][];
  let kunci: string[][];
  try {
    [judulBaris, kunci] = (await readRanges(sa, cfg.spreadsheetId, tab, ["1:1", "A2:E"])) as [string[][], string[][]];
  } catch (err) {
    if (galatTabTidakAda(err)) return "skip-tab-tidak-ada";
    throw err;
  }
  const judul = (judulBaris[0] ?? []).map((v) => String(v ?? "").trim());
  const iNomor = judul.indexOf("Nomor");
  const iMulai = judul.indexOf("Mulai");
  const iProvinsi = judul.lastIndexOf(JUDUL_LOKASI[0]);
  const iStatus = judul.lastIndexOf(JUDUL_LOKASI[1]);
  if (iNomor < 0 || iMulai < 0 || iProvinsi < 0 || iStatus < 0) return "skip-tanpa-kolom";
  // Tab yang susunannya diubah tim: Nomor/Mulai bisa di luar kolom A–E.
  if (Math.max(iNomor, iMulai) > 4)
    kunci = await readRange(sa, cfg.spreadsheetId, tab, `A2:${kolomA1(Math.max(iNomor, iMulai))}`);

  const cocok = cariBarisRespons(judul, kunci, r.contact.phone, fmtJakarta(r.startedAt));
  if (cocok.length !== 1) return cocok.length ? "skip-baris-ganda" : "skip-baris-tak-ditemukan";

  const [provinsi, status] = await nilaiLokasiSheet(r);
  const nomorBaris = cocok[0]! + 2; // baris data pertama = baris 2
  await writeCells(sa, cfg.spreadsheetId, tab, [
    { a1: `${kolomA1(iProvinsi)}${nomorBaris}`, nilai: provinsi },
    { a1: `${kolomA1(iStatus)}${nomorBaris}`, nilai: status },
  ]);
  return "ok";
}
