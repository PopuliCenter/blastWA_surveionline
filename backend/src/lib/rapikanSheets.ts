// ===== Merapikan tab Google Sheets yang sudah berisi data — rencana MURNI =====
//
// Dipakai skrip lengkapi:sheets. Fungsi ini hanya MERENCANAKAN: menerima isi tab apa
// adanya, mengembalikan daftar sel yang perlu ditulis. Pembacaan dan penulisannya ada di
// skrip, supaya aturan "sel mana yang boleh disentuh" bisa diuji tanpa Google.
//
// Prinsipnya: yang ditulis hanya sel yang nilainya memang BERUBAH, dan tidak ada sel yang
// ditimpa bila tidak bisa dipastikan nilai barunya lebih benar dari yang ada.
//   • Sel berisi rumus (diawali "=") tidak pernah disentuh. Menulis ulang kolom penuh dari
//     nilai yang ditampilkan mengubah rumus tim — "=COUNTA(…)" — menjadi angka mati.
//   • Durasi yang sudah tertulis dipertahankan dan dipakai sebagai dasar label. Worker
//     menghitungnya dari stempel waktu lengkap; kolom Mulai/Selesai hanya sampai menit,
//     jadi menghitung ulang dari sana bisa meleset hampir satu menit dan membalik label di
//     sekitar batas — 3,8 menit jadi 3, "Aman" jadi "Terlalu cepat", berlawanan dengan
//     ekspor Excel untuk responden yang sama. Mulai/Selesai hanya dipakai bila Durasi kosong.
//   • Tab yang pemiliknya tidak pasti — surveinya sudah diganti nama atau dihapus, atau dua
//     survei lama berjudul sama berbagi tab — hanya diisi pada sel asesmen yang KOSONG, dan
//     kolom Wilayahnya tidak disentuh. Aturan asesmen aslinya tidak diketahui, dan menimpa
//     label "Aman" dengan label bawaan menghapus data yang benar.

import { asesmenDurasi, bersihkanKodeWilayah, bulatkanMenit, formatLamaPengisian } from "./asesmenDurasi.js";
import { durasiDariSheet } from "./sheetRows.js";

export const JUDUL_DURASI = "Durasi (menit)";
export const JUDUL_ASESMEN = "Asesmen Durasi";
export const JUDUL_LAMA = "Lama Pengisian";

export type PemilikTab = { aturanDurasi: unknown; teksWilayah: readonly string[] };
// baris: indeks baris DATA (0 = baris kedua spreadsheet); kolom: indeks 0-based.
export type SelBaru = { baris: number; kolom: number; nilai: string | number };

export type RencanaTab =
  | { lewati: string }
  | {
      lewati?: undefined;
      judulBaru: { kolom: number; nilai: string[] } | null;
      sel: SelBaru[];
      hitung: { durasi: number; asesmen: number; lama: number; wilayah: number };
      kolomDurasi: number;
      kolomWilayah: number[];
    };

const rumus = (v: unknown): boolean => typeof v === "string" && v.trimStart().startsWith("=");
const teks = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

// Durasi yang tertulis di sel: angka (ditulis worker dengan RAW), atau teks angka yang
// diketik manusia ("3,8" maupun "3.8"). null bila kosong atau tak terbaca.
function angkaDurasi(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = teks(v).trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function rencanaRapikanTab(input: {
  header: readonly string[];
  // Baris data mulai baris 2, dibaca dengan valueRenderOption=FORMULA: rumus tetap rumus,
  // angka tetap angka. Sel kosong di ujung baris boleh tidak ada.
  baris: readonly (readonly unknown[])[];
  pemilik: PemilikTab | null;
}): RencanaTab {
  const { header, baris, pemilik } = input;
  const iMulai = header.indexOf("Mulai");
  const iSelesai = header.indexOf("Selesai");
  if (iMulai < 0 || iSelesai < 0) return { lewati: "tidak ada kolom Mulai/Selesai (bukan tab respons survei)" };

  let iDurasi = header.indexOf(JUDUL_DURASI);
  let iAsesmen = header.indexOf(JUDUL_ASESMEN);
  let iLama = header.indexOf(JUDUL_LAMA);
  let judulBaru: { kolom: number; nilai: string[] } | null = null;
  if (iDurasi < 0 || iAsesmen < 0) {
    if (iLama >= 0) return { lewati: `ada kolom "${JUDUL_LAMA}" tanpa kolom "${JUDUL_DURASI}"/"${JUDUL_ASESMEN}"` };
    // Kolom baru di kanan, urutannya sama dengan tab buatan worker. Tidak pernah menimpa
    // kolom berjudul lain.
    iDurasi = header.length;
    iAsesmen = header.length + 1;
    iLama = header.length + 2;
    judulBaru = { kolom: iDurasi, nilai: [JUDUL_DURASI, JUDUL_ASESMEN, JUDUL_LAMA] };
  } else if (iAsesmen !== iDurasi + 1) {
    return { lewati: `kolom "${JUDUL_DURASI}" dan "${JUDUL_ASESMEN}" tidak bersebelahan` };
  } else if (iLama < 0) {
    // Tab dari sebelum kolom ini ada: judulnya menyusul di kanan, sama seperti yang
    // dilakukan worker saat baris berikutnya masuk.
    iLama = header.length;
    judulBaru = { kolom: iLama, nilai: [JUDUL_LAMA] };
  }

  // Kolom yang akan DIBERI JUDUL baru harus benar-benar kosong. Di tab yang judulnya bukan
  // susunan worker, nilai lama bisa sudah tertulis menurut urutan di kolom tanpa judul di
  // kanan header — memberinya judul "Lama Pengisian" akan menamai data lain dengan keliru.
  if (judulBaru) {
    const { kolom, nilai } = judulBaru;
    const terisi = baris.some((b) => nilai.some((_, n) => teks(b[kolom + n]).trim() !== ""));
    if (terisi) return { lewati: `kolom di kanan judul (${nilai.join(", ")}) sudah berisi data tanpa judul` };
  }

  // Kolom Wilayah dikenali dari judulnya = teks pertanyaan Wilayah milik survei ini.
  const kolomWilayah = pemilik
    ? pemilik.teksWilayah.map((t) => header.indexOf(t)).filter((i, n, a) => i >= 0 && a.indexOf(i) === n)
    : [];

  const sel: SelBaru[] = [];
  const hitung = { durasi: 0, asesmen: 0, lama: 0, wilayah: 0 };

  baris.forEach((b, i) => {
    const sDurasi = b[iDurasi];
    const sAsesmen = b[iAsesmen];

    if (!rumus(sDurasi) && !rumus(sAsesmen)) {
      const lama = angkaDurasi(sDurasi);
      const menit = lama ?? durasiDariSheet(teks(b[iMulai]), teks(b[iSelesai]));
      if (lama === null && menit !== null && teks(sDurasi).trim() === "") {
        sel.push({ baris: i, kolom: iDurasi, nilai: bulatkanMenit(menit) });
        hitung.durasi++;
      }
      const asesmenLama = teks(sAsesmen).trim();
      // Tanpa pemilik pasti: hanya mengisi yang kosong — label yang ada mungkin hasil
      // aturan khusus yang tidak bisa diketahui lagi.
      if (pemilik || !asesmenLama) {
        const baru = asesmenDurasi(menit, pemilik?.aturanDurasi);
        if (baru !== asesmenLama) {
          sel.push({ baris: i, kolom: iAsesmen, nilai: baru });
          hitung.asesmen++;
        }
      }
      // Lama Pengisian hanya diisi bila kosong: nilainya turunan langsung dari durasi, dan
      // tidak bergantung pada aturan survei mana pun.
      const sLama = b[iLama];
      const lamaBaru = formatLamaPengisian(menit === null ? null : bulatkanMenit(menit));
      if (!rumus(sLama) && teks(sLama).trim() === "" && lamaBaru) {
        sel.push({ baris: i, kolom: iLama, nilai: lamaBaru });
        hitung.lama++;
      }
    }

    for (const k of kolomWilayah) {
      const v = b[k];
      if (typeof v !== "string" || rumus(v)) continue;
      const bersih = bersihkanKodeWilayah(v);
      if (bersih !== v) {
        sel.push({ baris: i, kolom: k, nilai: bersih });
        hitung.wilayah++;
      }
    }
  });

  return { judulBaru, sel, hitung, kolomDurasi: iDurasi, kolomWilayah };
}
