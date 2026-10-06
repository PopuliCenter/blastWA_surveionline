/**
 * Lengkapi kolom "Durasi (menit)" dan "Asesmen Durasi" pada tab Google Sheets yang SUDAH
 * berisi data.
 *
 * Kenapa perlu: kedua kolom itu ditulis oleh alur sinkron, dan alur sinkron hanya berjalan
 * saat ada respons BARU yang selesai. Survei yang sudah ditutup tidak akan pernah memicunya,
 * sehingga tabnya tetap tanpa kolom asesmen selamanya. Backfill yang sudah ada juga tidak
 * menolong — ia hanya mendorong respons yang belum pernah masuk Sheets.
 *
 * Nilainya dihitung dari kolom "Mulai" dan "Selesai" DI SPREADSHEET ITU SENDIRI, bukan
 * dicocokkan kembali ke basis data. Mencocokkannya butuh kunci unik yang tidak ada: satu
 * nomor bisa mengisi lebih dari sekali, dan urutan baris bisa sudah diubah tim yang
 * menyortir tabelnya. Menghitung dari kolom di baris yang sama tidak mungkin salah-pasang.
 *
 * Yang DITULIS hanya dua kolom itu. Tidak ada baris yang ditambah, dihapus, atau digeser.
 *
 * Pemakaian (dari folder backend/):
 *   npm run lengkapi:sheets            # hanya menampilkan rencana, tidak menulis
 *   npm run lengkapi:sheets -- --apply # benar-benar menulis
 *
 * Aman diulang: menjalankannya dua kali menghasilkan nilai yang sama.
 */
import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { parseServiceAccount } from "../lib/googleAuth.js";
import { durasiDariSheet, asesmenDurasi } from "../lib/sheetRows.js";
import { readSpreadsheetMeta, readRange, writeRange, kolomA1 } from "../services/sheetPush.js";

const JUDUL_DURASI = "Durasi (menit)";
const JUDUL_ASESMEN = "Asesmen Durasi";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const cfg = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
  if (!cfg?.spreadsheetId || !cfg.serviceAccountJson) {
    console.log("Integrasi Google Sheets belum dikonfigurasi (ID spreadsheet / kunci service account kosong).");
    return;
  }
  const sa = parseServiceAccount(decryptJson<string>(cfg.serviceAccountJson));
  const id = cfg.spreadsheetId;

  const { title, tabs } = await readSpreadsheetMeta(sa, id);
  console.log(`Spreadsheet: ${title}\nTab: ${tabs.length}\n`);

  let totalBaris = 0;
  for (const tab of tabs) {
    const header = (await readRange(sa, id, tab, "1:1"))[0] ?? [];
    const iMulai = header.indexOf("Mulai");
    const iSelesai = header.indexOf("Selesai");
    if (iMulai < 0 || iSelesai < 0) {
      console.log(`  ${tab}: dilewati — tidak ada kolom Mulai/Selesai (bukan tab respons survei).`);
      continue;
    }

    // Kolom tujuan: yang sudah ada bila judulnya sudah terpasang, selain itu dua kolom
    // baru di kanan. Tidak pernah menimpa kolom berjudul lain.
    let iDurasi = header.indexOf(JUDUL_DURASI);
    let iAsesmen = header.indexOf(JUDUL_ASESMEN);
    const perluJudul = iDurasi < 0 || iAsesmen < 0;
    if (perluJudul) {
      iDurasi = header.length;
      iAsesmen = header.length + 1;
    } else if (iAsesmen !== iDurasi + 1) {
      console.log(`  ${tab}: dilewati — kolom "${JUDUL_DURASI}" dan "${JUDUL_ASESMEN}" tidak bersebelahan.`);
      continue;
    }

    // Dua kolom waktu saja yang ditarik; menarik seluruh tab hanya untuk dua kolom itu
    // membuang kuota API tanpa menambah apa pun.
    const kolMulai = kolomA1(iMulai);
    const kolSelesai = kolomA1(iSelesai);
    const lo = Math.min(iMulai, iSelesai);
    const hi = Math.max(iMulai, iSelesai);
    const blok = await readRange(sa, id, tab, `${kolomA1(lo)}2:${kolomA1(hi)}`);
    if (!blok.length) {
      console.log(`  ${tab}: tidak ada baris data.`);
      continue;
    }

    const nilai: (string | number)[][] = blok.map((b) => {
      const mulai = b[iMulai - lo] ?? "";
      const selesai = b[iSelesai - lo] ?? "";
      const menit = durasiDariSheet(mulai, selesai);
      return [menit === null ? "" : Math.round(menit * 10) / 10, asesmenDurasi(menit)];
    });
    const terisi = nilai.filter((n) => n[0] !== "").length;
    totalBaris += nilai.length;
    console.log(
      `  ${tab}: ${nilai.length} baris, ${terisi} dapat dihitung → kolom ${kolomA1(iDurasi)}/${kolomA1(iAsesmen)}` +
        `${perluJudul ? " (judul ikut ditulis)" : ""}  [Mulai=${kolMulai}, Selesai=${kolSelesai}]`,
    );

    if (!apply) continue;
    if (perluJudul) await writeRange(sa, id, tab, `${kolomA1(iDurasi)}1`, [[JUDUL_DURASI, JUDUL_ASESMEN]]);
    await writeRange(sa, id, tab, `${kolomA1(iDurasi)}2`, nilai);
  }

  console.log(`\nTotal baris: ${totalBaris}`);
  if (!apply) console.log("\nIni hanya rencana. Jalankan ulang dengan -- --apply untuk menulis.");
  else console.log("Selesai ditulis.");
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
