import { describe, it, expect } from "vitest";
import { kodeProvinsiDari, PROVINSI } from "../src/lib/wilayah.js";

// Nilai NYATA dari jawaban pertanyaan "Sebutkan Provinsi Anda tinggal:" di produksi,
// beserta jumlah respondennya — 38 nilai berbeda, 5.148 jawaban.
//
// Diuji seluruhnya karena pengisian mundur bergantung sepenuhnya pada penerjemahan ini.
// Satu nama yang gagal diterjemahkan tidak menimbulkan galat apa pun: respondennya hanya
// hilang diam-diam dari hitungan kuota, dan baru ketahuan saat sebarannya dianalisis.
const LAPANGAN: [string, number][] = [
  ["Jawa Barat", 888],
  ["Jawa Tengah", 807],
  ["Jawa Timur", 754],
  ["Sumatera Utara", 260],
  ["Banten", 238],
  ["Sulawesi Selatan", 193],
  ["Lampung", 182],
  ["Sumatera Selatan", 178],
  ["DKI Jakarta", 130],
  ["Riau", 111],
  ["Kalimantan Barat", 90],
  ["Aceh", 89],
  ["Nusa Tenggara Barat", 82],
  ["Sumatera Barat", 80],
  ["Nusa Tenggara Timur", 79],
  ["Kalimantan Selatan", 79],
  ["Bali", 68],
  ["D.I Yogyakarta", 63],
  ["Papua", 61],
  ["Kepulauan Riau", 50],
  ["Kalimantan Tengah", 47],
  ["Sulawesi Utara", 46],
  ["Bengkulu", 43],
  ["Gorontalo", 43],
  ["Bangka Belitung", 43],
  ["Maluku", 42],
  ["Sulawesi Tenggara", 42],
  ["Jambi", 41],
  ["Maluku Utara", 41],
  ["Sulawesi Barat", 41],
  ["Sulawesi Tengah", 39],
  ["Kalimantan Timur", 38],
  ["Kalimantan Utara", 32],
  ["Papua Pegunungan", 30],
  ["Papua Barat", 28],
  ["Papua Tengah", 27],
  ["Papua Selatan", 23],
  ["Papua Barat Daya", 20],
];

describe("kodeProvinsiDari — nilai nyata dari lapangan", () => {
  it("menerjemahkan SELURUH 38 nilai tanpa satu pun gagal", () => {
    const gagal = LAPANGAN.filter(([nama]) => kodeProvinsiDari(nama) === null).map(([n]) => n);
    expect(gagal).toEqual([]);
  });

  it("tidak kehilangan satu jawaban pun", () => {
    // 5.148 jawaban provinsi, dari 5.163 responden selesai: 15 responden tidak menjawab
    // pertanyaan itu sama sekali. Mereka memang tetap tanpa provinsi — tidak ada yang bisa
    // disimpulkan dari jawaban yang tidak ada, dan menebaknya akan merusak kuota.
    const total = LAPANGAN.reduce((a, [, n]) => a + n, 0);
    const terjemah = LAPANGAN.filter(([nama]) => kodeProvinsiDari(nama) !== null).reduce((a, [, n]) => a + n, 0);
    expect(total).toBe(5148);
    expect(terjemah).toBe(5148);
  });

  it("memetakan ke 38 provinsi BERBEDA — tidak ada dua nama yang tertumpuk ke kode sama", () => {
    // Penjaga terpenting: "Riau" tidak boleh jatuh ke "Kepulauan Riau", "Papua" tidak boleh
    // jatuh ke "Papua Barat", "Maluku" tidak boleh jatuh ke "Maluku Utara". Kalau tertumpuk,
    // kuota dua provinsi sekaligus jadi salah tanpa gejala apa pun.
    const kode = LAPANGAN.map(([nama]) => kodeProvinsiDari(nama));
    expect(new Set(kode).size).toBe(38);
    expect(new Set(kode).size).toBe(PROVINSI.length);
  });

  it("memetakan nama pendek ke provinsinya sendiri, bukan ke nama panjang yang memuatnya", () => {
    expect(kodeProvinsiDari("Riau")).not.toBe(kodeProvinsiDari("Kepulauan Riau"));
    expect(kodeProvinsiDari("Papua")).not.toBe(kodeProvinsiDari("Papua Barat"));
    expect(kodeProvinsiDari("Maluku")).not.toBe(kodeProvinsiDari("Maluku Utara"));
    expect(kodeProvinsiDari("Sumatera Barat")).not.toBe(kodeProvinsiDari("Sumatera Utara"));
  });
});
