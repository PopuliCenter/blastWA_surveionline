/**
 * Lengkapi dan rapikan tab Google Sheets yang SUDAH berisi data:
 *   • kolom "Durasi (menit)" dan "Asesmen Durasi" — diisi bila kosong, dan label asesmennya
 *     disesuaikan dengan aturan milik survei (bila aturannya diubah setelah barisnya masuk);
 *   • kolom pertanyaan Wilayah — kode resminya dibuang: "Jawa Barat (32)" → "Jawa Barat";
 *   • kolom "Provinsi Lokasi" dan "Status Lokasi" (survei yang meminta lokasi) — diambil dari
 *     basis data dan dicocokkan ke baris lewat Nomor + Mulai; judulnya ditambahkan di kanan
 *     bila belum ada. Status yang berubah ("Tidak dibagikan" → "Sesuai") ikut diperbarui.
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
 * worker sinkron). Durasi dihitung dari isi spreadsheet itu sendiri, bukan dicocokkan kembali
 * ke basis data: satu nomor bisa mengisi lebih dari sekali, dan urutan baris bisa sudah
 * diubah tim yang menyortir tabelnya. Lokasi tidak ada di spreadsheet, jadi diambil dari basis
 * data — dicocokkan per baris lewat Nomor + Mulai, bukan menurut urutan, dengan alasan sama.
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
import { fmtJakarta, kunciBaris, sheetTabName } from "../lib/sheetRows.js";
import { rencanaLokasiTab, rencanaRapikanTab, type PemilikTab, type RencanaLokasi } from "../lib/rapikanSheets.js";
import { PILIH_LOKASI, lokasiDiSheet, nilaiLokasiSheet } from "../services/lokasiSheet.js";
import {
  readSpreadsheetMeta,
  readRange,
  readRangeMentah,
  writeRange,
  writeCells,
  kolomA1,
} from "../services/sheetPush.js";

type SurveiTab = { id: string; mintaLokasi: boolean };

// Rencana kolom lokasi satu tab. null = tab ini tidak punya respons yang dimintai lokasi.
// `header` = judul tab SETELAH judul durasi yang baru (bila ada) — kolom lokasi menyusul di
// kanannya, sama dengan urutan buatan worker.
async function rencanaLokasi(
  survei: readonly SurveiTab[],
  header: readonly string[],
  baris: readonly (readonly unknown[])[],
): Promise<RencanaLokasi | null> {
  if (!survei.length) return null;
  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: { in: survei.map((s) => s.id) }, completedAt: { not: null }, ditolakKuotaPada: null },
    select: { ...PILIH_LOKASI, surveyId: true, startedAt: true, contact: { select: { phone: true } } },
  });
  const minta = new Map(survei.map((s) => [s.id, s.mintaLokasi]));
  const pakai = responses.filter((x) => lokasiDiSheet(minta.get(x.surveyId) ?? false, x));
  if (!pakai.length) return null;

  // Dua respons berkunci sama (nomor yang sama, mulai di menit yang sama) tidak bisa
  // dibedakan di spreadsheet — ditandai null dan dilewati, bukan ditebak.
  const nilai = new Map<string, [string, string] | null>();
  for (const x of pakai) {
    const k = kunciBaris(x.contact.phone, fmtJakarta(x.startedAt));
    nilai.set(k, nilai.has(k) ? null : await nilaiLokasiSheet(x));
  }
  return rencanaLokasiTab({ header, baris, nilai });
}

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
    select: {
      id: true,
      title: true,
      aturanDurasi: true,
      mintaLokasi: true,
      questions: { where: { type: "wilayah" }, select: { text: true } },
    },
  });
  const pemilikPerTab = new Map<string, PemilikTab | "ambigu">();
  // Untuk kolom lokasi SEMUA survei yang berbagi nama tab ikut: barisnya dicocokkan lewat
  // Nomor + Mulai, jadi tab bersama tidak membuat nilainya tak pasti.
  const surveiPerTab = new Map<string, SurveiTab[]>();
  for (const s of surveys) {
    const k = sheetTabName(s.title).toLowerCase();
    pemilikPerTab.set(
      k,
      pemilikPerTab.has(k) ? "ambigu" : { aturanDurasi: s.aturanDurasi, teksWilayah: s.questions.map((q) => q.text) },
    );
    surveiPerTab.set(k, [...(surveiPerTab.get(k) ?? []), { id: s.id, mintaLokasi: s.mintaLokasi }]);
  }

  let totalSel = 0;
  for (const tab of tabs) {
    const header = ((await readRange(sa, id, tab, "1:1"))[0] ?? []).map(String);
    const p = pemilikPerTab.get(tab.toLowerCase());
    const pemilik = p && p !== "ambigu" ? p : null;

    // Seluruh data tab dibaca SEKALI, apa adanya (rumus tetap rumus). Sampai lima kolom di
    // kanan header: tempat kolom durasi (tiga) dan lokasi (dua) yang mungkin ditambahkan.
    const baris = header.length ? await readRangeMentah(sa, id, tab, `A2:${kolomA1(header.length + 4)}`) : [];
    const r = rencanaRapikanTab({ header, baris, pemilik });
    const judulDurasi = r.lewati === undefined ? r.judulBaru : null;
    const rl = await rencanaLokasi(
      surveiPerTab.get(tab.toLowerCase()) ?? [],
      judulDurasi ? [...header, ...judulDurasi.nilai] : header,
      baris,
    );

    if (r.lewati !== undefined) {
      console.log(`  ${tab}: dilewati — ${r.lewati}.`);
    } else {
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
    }
    const lokasi = rl && rl.lewati === undefined ? rl : null;
    if (rl && rl.lewati !== undefined) console.log(`    lokasi: dilewati — ${rl.lewati}.`);
    else if (lokasi)
      console.log(
        `    lokasi: ${lokasi.hitung.diperbarui} baris diperbarui` +
          (lokasi.hitung.takDitemukan
            ? `, ${lokasi.hitung.takDitemukan} baris tak cocok dengan respons mana pun`
            : "") +
          (lokasi.judulBaru ? ", judul kolom ditambahkan" : ""),
      );

    const sel = [...(r.lewati === undefined ? r.sel : []), ...(lokasi?.sel ?? [])];
    totalSel += sel.length;

    if (!apply) continue;
    if (judulDurasi) await writeRange(sa, id, tab, `${kolomA1(judulDurasi.kolom)}1`, [judulDurasi.nilai]);
    if (lokasi?.judulBaru)
      await writeRange(sa, id, tab, `${kolomA1(lokasi.judulBaru.kolom)}1`, [lokasi.judulBaru.nilai]);
    if (sel.length)
      await writeCells(
        sa,
        id,
        tab,
        sel.map((s) => ({ a1: `${kolomA1(s.kolom)}${s.baris + 2}`, nilai: s.nilai })),
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
