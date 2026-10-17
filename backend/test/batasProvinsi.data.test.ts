import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { batasTerpasang, provinsiDariTitik } from "../src/services/petaProvinsi.js";

// Pemeriksaan berkas data backend/data/batas-provinsi.json yang SUNGGUHAN: ibu kota setiap
// provinsi harus jatuh di provinsinya, kota di dekat batas antarprovinsi tidak tertukar,
// dan kota di negara tetangga tidak mendapat provinsi. Dijalankan ulang setiap kali
// berkasnya dibuat ulang (scripts/siapkan-batas-provinsi.ts).
const ADA = existsSync(new URL("../data/batas-provinsi.json", import.meta.url));

// [nama, lintang, bujur, kode yang diharapkan]
const IBU_KOTA: [string, number, number, string][] = [
  ["Banda Aceh", 5.55, 95.32, "11"],
  ["Medan", 3.59, 98.67, "12"],
  ["Padang", -0.95, 100.35, "13"],
  ["Pekanbaru", 0.51, 101.45, "14"],
  ["Jambi", -1.6, 103.61, "15"],
  ["Palembang", -2.98, 104.76, "16"],
  ["Bengkulu", -3.8, 102.27, "17"],
  ["Bandar Lampung", -5.43, 105.26, "18"],
  ["Pangkal Pinang", -2.13, 106.11, "19"],
  ["Tanjung Pinang", 0.92, 104.45, "21"],
  ["Jakarta", -6.2, 106.85, "31"],
  ["Bandung", -6.91, 107.61, "32"],
  ["Semarang", -6.99, 110.42, "33"],
  ["Yogyakarta", -7.8, 110.36, "34"],
  ["Surabaya", -7.25, 112.75, "35"],
  ["Serang", -6.12, 106.15, "36"],
  ["Denpasar", -8.65, 115.22, "51"],
  ["Mataram", -8.58, 116.12, "52"],
  ["Kupang", -10.18, 123.6, "53"],
  ["Pontianak", -0.03, 109.33, "61"],
  ["Palangka Raya", -2.21, 113.92, "62"],
  ["Banjarmasin", -3.32, 114.59, "63"],
  ["Samarinda", -0.5, 117.15, "64"],
  ["Tanjung Selor", 2.84, 117.37, "65"],
  ["Manado", 1.47, 124.84, "71"],
  ["Palu", -0.9, 119.87, "72"],
  ["Makassar", -5.14, 119.43, "73"],
  ["Kendari", -3.97, 122.51, "74"],
  ["Gorontalo", 0.54, 123.06, "75"],
  ["Mamuju", -2.68, 118.89, "76"],
  ["Ambon", -3.69, 128.18, "81"],
  ["Sofifi", 0.74, 127.56, "82"],
  ["Jayapura", -2.53, 140.72, "91"],
  ["Manokwari", -0.86, 134.08, "92"],
  ["Merauke", -8.49, 140.4, "93"],
  ["Nabire", -3.37, 135.5, "94"],
  ["Wamena", -4.1, 138.95, "95"],
  ["Sorong", -0.88, 131.25, "96"],
];

// Kota di dekat batas antarprovinsi — tempat poligon laut yang kasar paling mungkin
// menumpuk dengan daratan tetangga.
const DEKAT_BATAS: [string, number, number, string][] = [
  ["Banyuwangi", -8.22, 114.37, "35"],
  ["Gilimanuk", -8.17, 114.44, "51"],
  ["Cilegon", -6.0, 106.05, "36"],
  ["Bakauheni", -5.87, 105.75, "18"],
  ["Tangerang", -6.18, 106.63, "36"],
  ["Bekasi", -6.24, 107.0, "32"],
  ["Depok", -6.4, 106.82, "32"],
  ["Cirebon", -6.71, 108.56, "32"],
  ["Brebes", -6.87, 109.04, "33"],
  ["Magelang", -7.48, 110.22, "33"],
  ["Sleman", -7.72, 110.36, "34"],
  ["Ngawi", -7.4, 111.45, "35"],
  ["Labuan Bajo", -8.5, 119.88, "53"],
  ["Bima", -8.46, 118.73, "52"],
  ["Pulau Batam", 1.13, 104.05, "21"],
  ["Dumai", 1.67, 101.45, "14"],
  ["Entikong", 0.99, 110.35, "61"],
  ["Nunukan", 4.14, 117.66, "65"],
  ["Atambua", -9.1, 124.89, "53"],
  ["Skouw", -2.62, 140.95, "91"],
];

const LUAR_NEGERI: [string, number, number][] = [
  ["Kuala Lumpur", 3.14, 101.69],
  ["Singapura", 1.29, 103.85],
  ["Kuching", 1.55, 110.36],
  ["Tawau", 4.25, 117.89],
  ["Dili", -8.56, 125.57],
  ["Port Moresby", -9.44, 147.18],
  ["Darwin", -12.46, 130.84],
  ["Manila", 14.6, 120.98],
];

describe.skipIf(!ADA)("data batas provinsi (backend/data/batas-provinsi.json)", () => {
  it("terpasang", async () => {
    expect(await batasTerpasang()).toBe(true);
  });

  it.each(IBU_KOTA)("ibu kota %s → provinsinya", async (_n, lat, lng, kode) => {
    expect(await provinsiDariTitik({ lat, lng })).toBe(kode);
  });

  it.each(DEKAT_BATAS)("dekat batas: %s → provinsinya", async (_n, lat, lng, kode) => {
    expect(await provinsiDariTitik({ lat, lng })).toBe(kode);
  });

  it.each(LUAR_NEGERI)("luar negeri: %s → tanpa provinsi", async (_n, lat, lng) => {
    expect(await provinsiDariTitik({ lat, lng })).toBeNull();
  });
});
