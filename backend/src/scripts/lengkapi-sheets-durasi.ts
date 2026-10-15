/**
 * Lengkapi dan rapikan tab Google Sheets yang SUDAH berisi data:
 *   • kolom "Durasi (menit)" dan "Asesmen Durasi" — diisi bila kosong, dan label asesmennya
 *     disesuaikan dengan aturan milik survei (bila aturannya diubah setelah barisnya masuk);
 *   • kolom pertanyaan Wilayah — kode resminya dibuang: "Jawa Barat (32)" → "Jawa Barat".
 *
 * Kenapa perlu: kolom-kolom itu ditulis oleh alur sinkron, dan alur sinkron hanya berjalan
 * saat ada respons BARU yang selesai. Survei yang sudah ditutup tidak akan pernah memicunya.
 *
 * Yang ditulis HANYA sel yang nilainya berubah, dalam satu permintaan per tab. Sel berisi
 * rumus tidak disentuh, durasi yang sudah tertulis dipertahankan, dan tab yang pemiliknya
 * tidak pasti hanya diisi pada sel yang kosong. Aturan lengkapnya — dan alasannya — ada di
 * lib/rapikanSheets.ts. Tidak ada baris yang ditambah, dihapus, atau digeser.
 *
 * Survei pemilik tab dikenali dari namanya (nama tab = judul survei, aturan yang sama dengan
 * worker sinkron). Data dihitung dari isi spreadsheet itu sendiri, bukan dicocokkan kembali
 * ke basis data: satu nomor bisa mengisi lebih dari sekali, dan urutan baris bisa sudah
 * diubah tim yang menyortir tabelnya.
 *
 * Pemakaian (dari folder backend/):
 *   npm run lengkapi:sheets            # hanya menampilkan rencana, tidak menulis
 *   npm run lengkapi:sheets -- --apply # benar-benar menulis
 *
 * Aman diulang: menjalankannya dua kali tidak mengubah apa pun pada kali kedua.
 */
import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { parseServiceAccount } from "../lib/googleAuth.js";
import { sheetTabName } from "../lib/sheetRows.js";
import { rencanaRapikanTab, type PemilikTab } from "../lib/rapikanSheets.js";
import {
  readSpreadsheetMeta,
  readRange,
  readRangeMentah,
  writeRange,
  writeCells,
  kolomA1,
} from "../services/sheetPush.js";

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

  // Tab → survei pemiliknya. Dua survei lama yang judulnya menjadi nama tab yang sama
  // berbagi satu tab; pemiliknya tidak pasti, jadi dicatat sebagai "ambigu", bukan dipilih
  // salah satu sembarang.
  const surveys = await prisma.survey.findMany({
    select: { title: true, aturanDurasi: true, questions: { where: { type: "wilayah" }, select: { text: true } } },
  });
  const pemilikPerTab = new Map<string, PemilikTab | "ambigu">();
  for (const s of surveys) {
    const k = sheetTabName(s.title).toLowerCase();
    pemilikPerTab.set(
      k,
      pemilikPerTab.has(k) ? "ambigu" : { aturanDurasi: s.aturanDurasi, teksWilayah: s.questions.map((q) => q.text) },
    );
  }

  let totalSel = 0;
  for (const tab of tabs) {
    const header = ((await readRange(sa, id, tab, "1:1"))[0] ?? []).map(String);
    const p = pemilikPerTab.get(tab.toLowerCase());
    const pemilik = p && p !== "ambigu" ? p : null;

    // Seluruh data tab dibaca SEKALI, apa adanya (rumus tetap rumus).
    // Sampai tiga kolom di kanan header: tempat kolom durasi yang mungkin perlu ditambahkan.
    const baris = header.length ? await readRangeMentah(sa, id, tab, `A2:${kolomA1(header.length + 2)}`) : [];
    const r = rencanaRapikanTab({ header, baris, pemilik });
    if (r.lewati !== undefined) {
      console.log(`  ${tab}: dilewati — ${r.lewati}.`);
      continue;
    }

    const catatan =
      p === "ambigu"
        ? " (dimiliki lebih dari satu survei berjudul sama — hanya sel kosong yang diisi, kolom Wilayah tidak disentuh)"
        : !pemilik
          ? " (tidak cocok dengan survei mana pun — hanya sel kosong yang diisi, kolom Wilayah tidak disentuh)"
          : "";
    console.log(
      `  ${tab}: ${baris.length} baris → ${r.hitung.durasi} durasi diisi, ${r.hitung.asesmen} asesmen diubah, ` +
        `${r.hitung.lama} lama pengisian diisi, ` +
        `${r.hitung.wilayah} sel Wilayah dibuang kodenya${r.judulBaru ? ", judul kolom ditambahkan" : ""}${catatan}`,
    );
    totalSel += r.sel.length;

    if (!apply) continue;
    if (r.judulBaru) await writeRange(sa, id, tab, `${kolomA1(r.judulBaru.kolom)}1`, [r.judulBaru.nilai]);
    if (r.sel.length)
      await writeCells(
        sa,
        id,
        tab,
        r.sel.map((s) => ({ a1: `${kolomA1(s.kolom)}${s.baris + 2}`, nilai: s.nilai })),
      );
  }

  console.log(`\nTotal sel yang ${apply ? "ditulis" : "akan ditulis"}: ${totalSel}`);
  if (!apply) console.log("\nIni hanya rencana. Jalankan ulang dengan -- --apply untuk menulis.");
  else console.log("Selesai ditulis.");
}

main()
  .catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
