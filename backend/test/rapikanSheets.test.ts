import { describe, it, expect } from "vitest";
import {
  rencanaRapikanTab,
  JUDUL_DURASI,
  JUDUL_ASESMEN,
  JUDUL_LAMA,
  type PemilikTab,
} from "../src/lib/rapikanSheets.js";

// Tab seperti yang ditulis worker: identitas, pertanyaan, lalu tiga kolom durasi di akhir.
const HEADER = [
  "Nomor",
  "Nama",
  "Sumber Kontak",
  "Mulai",
  "Selesai",
  "Provinsi?",
  "Anak?",
  JUDUL_DURASI,
  JUDUL_ASESMEN,
  JUDUL_LAMA,
];
const I = { prov: 5, anak: 6, durasi: 7, asesmen: 8, lama: 9 };
const PENDEK: PemilikTab = {
  aturanDurasi: { batas: [{ sampai: 3, label: "Terlalu cepat" }], selebihnya: "Aman" },
  teksWilayah: ["Provinsi?"],
};
const baris = (o: {
  mulai?: string;
  selesai?: string;
  prov?: unknown;
  anak?: unknown;
  durasi?: unknown;
  asesmen?: unknown;
  lama?: unknown;
}) => [
  "6281",
  "Budi",
  "Pesan masuk",
  o.mulai ?? "2026-10-14 11:00",
  o.selesai ?? "2026-10-14 11:05",
  o.prov ?? "",
  o.anak ?? "",
  o.durasi ?? "",
  o.asesmen ?? "",
  // Bawaannya sudah terisi, supaya uji lain fokus pada kolomnya sendiri.
  o.lama ?? "(terisi)",
];
const rencana = (b: unknown[][], pemilik: PemilikTab | null = PENDEK, header = HEADER) => {
  const r = rencanaRapikanTab({ header, baris: b, pemilik });
  if (r.lewati !== undefined) throw new Error(r.lewati);
  return r;
};

describe("rencanaRapikanTab — kode wilayah", () => {
  it("membuang kode hanya di kolom Wilayah, dan hanya sel yang berubah", () => {
    const r = rencana([
      baris({ prov: "Jawa Barat (32)", anak: "Dua (2)", durasi: 5, asesmen: "Aman" }),
      baris({ prov: "Banten", durasi: 5, asesmen: "Aman" }),
    ]);
    expect(r.sel).toEqual([{ baris: 0, kolom: I.prov, nilai: "Jawa Barat" }]);
  });

  it("sel berisi rumus tidak pernah disentuh", () => {
    // Menulis balik nilai yang ditampilkan mengubah rumus tim menjadi angka mati.
    const r = rencana([baris({ prov: '=IF(A2="","","Jawa Barat (32)")', durasi: 5, asesmen: "Aman" })]);
    expect(r.sel).toEqual([]);
  });
});

describe("rencanaRapikanTab — durasi dan asesmen", () => {
  it("durasi yang sudah tertulis dipakai, BUKAN dihitung ulang dari Mulai/Selesai yang hanya sampai menit", () => {
    // Worker menulis 3,8 (stempel lengkap). Mulai/Selesai 11:00–11:03 akan memberi 3 dan
    // membalik label menjadi "Terlalu cepat" — berlawanan dengan ekspor Excel.
    const r = rencana([
      baris({ mulai: "2026-10-14 11:00", selesai: "2026-10-14 11:03", durasi: 3.8, asesmen: "Normal" }),
    ]);
    expect(r.sel).toEqual([{ baris: 0, kolom: I.asesmen, nilai: "Aman" }]);
  });

  it("durasi kosong diisi dari Mulai/Selesai, lalu dilabeli", () => {
    const r = rencana([baris({ mulai: "2026-10-14 11:00", selesai: "2026-10-14 11:02" })]);
    expect(r.sel).toEqual([
      { baris: 0, kolom: I.durasi, nilai: 2 },
      { baris: 0, kolom: I.asesmen, nilai: "Terlalu cepat" },
    ]);
  });

  it("durasi yang diketik manusia dengan koma tetap terbaca", () => {
    const r = rencana([baris({ durasi: "3,8", asesmen: "Aman" })]);
    expect(r.sel).toEqual([]);
  });

  it("label yang sudah benar tidak ditulis ulang — menjalankan dua kali tidak mengubah apa pun", () => {
    const r = rencana([baris({ durasi: 2.5, asesmen: "Terlalu cepat" }), baris({ durasi: 7, asesmen: "Aman" })]);
    expect(r.sel).toEqual([]);
  });

  it("baris yang durasi atau asesmennya berupa rumus tidak disentuh", () => {
    const r = rencana([baris({ durasi: "=E2-D2", asesmen: "Normal" })]);
    expect(r.sel).toEqual([]);
  });
});

describe("rencanaRapikanTab — tab tanpa pemilik pasti", () => {
  it("label yang sudah ada DIPERTAHANKAN — aturan aslinya tidak diketahui", () => {
    // Survei diganti nama atau dihapus: tab lama berisi label "Aman" dari aturan khusus.
    // Menimpanya dengan aturan bawaan ("Normal") menghapus data yang benar.
    const r = rencana([baris({ durasi: 5, asesmen: "Aman", prov: "Jawa Barat (32)" })], null);
    expect(r.sel).toEqual([]);
  });

  it("hanya sel asesmen yang KOSONG yang diisi, dengan aturan bawaan", () => {
    const r = rencana([baris({ durasi: 5, asesmen: "" })], null);
    expect(r.sel).toEqual([{ baris: 0, kolom: I.asesmen, nilai: "Normal" }]);
  });

  it("kolom Wilayah tidak disentuh — tanpa surveinya tidak diketahui kolom mana yang Wilayah", () => {
    const r = rencana([baris({ durasi: 5, asesmen: "Normal", prov: "Jawa Barat (32)" })], null);
    expect(r.kolomWilayah).toEqual([]);
    expect(r.sel).toEqual([]);
  });
});

describe("rencanaRapikanTab — bentuk tab", () => {
  it("tab tanpa kolom durasi mendapat tiga kolom baru di kanan", () => {
    const header = HEADER.slice(0, 7);
    const r = rencana([baris({}).slice(0, 7)], PENDEK, header);
    expect(r.judulBaru).toEqual({ kolom: 7, nilai: [JUDUL_DURASI, JUDUL_ASESMEN, JUDUL_LAMA] });
    expect(r.sel).toEqual([
      { baris: 0, kolom: 7, nilai: 5 },
      { baris: 0, kolom: 8, nilai: "Aman" },
      { baris: 0, kolom: 9, nilai: "5 menit" },
    ]);
  });

  it("tab dari sebelum kolom Lama Pengisian ada: judulnya menyusul di kanan dan diisi dari durasi", () => {
    // Durasi 1,9 tertulis desimal — kolom baru menuliskan artinya: 1 menit 54 detik.
    const header = HEADER.slice(0, 9);
    const r = rencana([baris({ durasi: 1.9, asesmen: "Terlalu cepat" }).slice(0, 9)], PENDEK, header);
    expect(r.judulBaru).toEqual({ kolom: 9, nilai: [JUDUL_LAMA] });
    expect(r.sel).toEqual([{ baris: 0, kolom: 9, nilai: "1 menit 54 detik" }]);
  });

  it("Lama Pengisian yang sudah terisi tidak ditimpa", () => {
    const r = rencana([baris({ durasi: 1.9, asesmen: "Terlalu cepat", lama: "1 menit 54 detik" })]);
    expect(r.sel).toEqual([]);
  });

  it("melewati tab yang bukan tab respons survei", () => {
    expect(rencanaRapikanTab({ header: ["A", "B"], baris: [], pemilik: null })).toMatchObject({
      lewati: expect.stringMatching(/Mulai\/Selesai/),
    });
  });

  it("sel kosong di ujung baris (dipangkas API Sheets) tidak membuat galat", () => {
    const r = rencana([["6281", "Budi", "Pesan masuk", "2026-10-14 11:00", "2026-10-14 11:05"]]);
    expect(r.sel).toEqual([
      { baris: 0, kolom: I.durasi, nilai: 5 },
      { baris: 0, kolom: I.asesmen, nilai: "Aman" },
      { baris: 0, kolom: I.lama, nilai: "5 menit" },
    ]);
  });
});

describe("rencanaRapikanTab — kolom di kanan judul yang sudah berisi", () => {
  it("tidak memberi judul baru pada kolom yang sudah berisi data tanpa judul", () => {
    // Nilai lama yang dulu ditulis menurut urutan bisa berada di kolom tanpa judul. Menamai
    // kolom itu "Lama Pengisian" akan memberi data lain judul yang keliru.
    const header = HEADER.slice(0, 9);
    const r = rencanaRapikanTab({
      header,
      baris: [[...baris({ durasi: 2, asesmen: "Terlalu cepat" }).slice(0, 9), "data lama"]],
      pemilik: PENDEK,
    });
    expect(r).toMatchObject({ lewati: expect.stringMatching(/sudah berisi data/) });
  });
});
