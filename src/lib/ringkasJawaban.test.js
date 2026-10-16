import { describe, it, expect } from "vitest";
import { tally, provinsiDariJawaban, distribusiWilayah, distribusiPilihanGanda, nilaiTampil } from "./ringkasJawaban";

describe("distribusiWilayah", () => {
  it("menghitung per provinsi tanpa kode resminya", () => {
    const d = distribusiWilayah(["Jawa Barat (32)", "Jawa Barat (32)", "Banten (36)", "Jawa Timur (35)"]);
    expect(d.provinsi).toEqual([
      ["Jawa Barat", 2],
      ["Banten", 1],
      ["Jawa Timur", 1],
    ]);
    expect(d.kabKota).toBeNull();
  });

  it("jawaban tingkat kabupaten/kota menghasilkan dua sebaran: provinsi dan kabupaten/kota", () => {
    const d = distribusiWilayah([
      "Kab. Bandung, Jawa Barat (32.04)",
      "Kota Bandung, Jawa Barat (32.73)",
      "Kab. Bandung, Jawa Barat (32.04)",
      "Banten (36)", // provinsi saja — tetap terhitung di sebaran provinsi
    ]);
    expect(d.provinsi).toEqual([
      ["Jawa Barat", 3],
      ["Banten", 1],
    ]);
    expect(d.kabKota).toEqual([
      ["Kab. Bandung, Jawa Barat", 2],
      ["Kota Bandung, Jawa Barat", 1],
    ]);
  });

  it("provinsiDariJawaban membaca kedua bentuk", () => {
    expect(provinsiDariJawaban("Jawa Barat (32)")).toBe("Jawa Barat");
    expect(provinsiDariJawaban("Kab. Bandung, Jawa Barat (32.04)")).toBe("Jawa Barat");
  });
});

describe("distribusiPilihanGanda", () => {
  const q = { options: { choices: ["Harga, kualitas", "Pelayanan", "Lokasi"] } };

  it("menghitung per pilihan, termasuk pilihan yang teksnya berkoma", () => {
    // Dipecah di setiap koma, "Harga, kualitas" akan terhitung sebagai dua pilihan palsu.
    const d = distribusiPilihanGanda(q, ["Harga, kualitas, Pelayanan", "Pelayanan", "Lokasi, Pelayanan"]);
    expect(d).toEqual([
      ["Pelayanan", 3],
      ["Harga, kualitas", 1],
      ["Lokasi", 1],
    ]);
  });

  it("tanpa daftar pilihan, jawaban dipecah apa adanya", () => {
    expect(distribusiPilihanGanda({}, ["A, B", "B"])).toEqual([
      ["B", 2],
      ["A", 1],
    ]);
  });
});

describe("tally dan nilaiTampil", () => {
  it("tally mengurutkan dari yang terbanyak", () => {
    expect(tally(["x", "y", "y"])).toEqual([
      ["y", 2],
      ["x", 1],
    ]);
  });

  it("nilaiTampil membuang kode hanya untuk pertanyaan Wilayah", () => {
    expect(nilaiTampil({ type: "wilayah" }, "Jawa Barat (32)")).toBe("Jawa Barat");
    expect(nilaiTampil({ type: "text" }, "Anak (2)")).toBe("Anak (2)");
  });
});
