import { describe, it, expect } from "vitest";
import {
  AMBANG_PESISIR,
  bboxDari,
  provinsiDariKoordinat,
  titikDalamPoligon,
  type FiturProvinsi,
  type Poligon,
} from "../src/lib/batasWilayah.js";

// Dua "provinsi" persegi bersebelahan; yang pertama berlubang di tengah, dan lubangnya
// adalah provinsi ketiga — seperti DIY yang dikelilingi Jawa Tengah.
const kotak = (a: number, b: number, c: number, d: number): [number, number][] => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
  [a, b],
];
const P32: Poligon = [kotak(0, 0, 10, 10), kotak(4, 4, 6, 6)];
const P33: Poligon = [kotak(10, 0, 20, 10)];
const P34: Poligon = [kotak(4, 4, 6, 6)];
const fitur: FiturProvinsi[] = [
  { kode: "32", poligon: [P32], bbox: bboxDari([P32]) },
  { kode: "33", poligon: [P33], bbox: bboxDari([P33]) },
  { kode: "34", poligon: [P34], bbox: bboxDari([P34]) },
];

describe("titik → provinsi", () => {
  it("titik di dalam, di lubang, dan di luar poligon", () => {
    expect(titikDalamPoligon(2, 2, P32)).toBe(true);
    expect(titikDalamPoligon(5, 5, P32)).toBe(false); // di lubang
    expect(titikDalamPoligon(15, 5, P32)).toBe(false);
  });

  it("provinsiDariKoordinat memakai urutan (lintang, bujur)", () => {
    expect(provinsiDariKoordinat(2, 2, fitur)).toBe("32");
    expect(provinsiDariKoordinat(5, 15, fitur)).toBe("33");
    // Lubang provinsi 32 adalah provinsi 34.
    expect(provinsiDariKoordinat(5, 5, fitur)).toBe("34");
    // Laut / luar negeri.
    expect(provinsiDariKoordinat(50, 50, fitur)).toBeNull();
    expect(provinsiDariKoordinat(-1, 2, fitur)).toBeNull();
  });

  it("titik pesisir yang jatuh sedikit di laut tetap dikenali provinsinya", () => {
    // ±550 m di bawah tepi selatan provinsi 32 — garis pantai yang disederhanakan.
    expect(provinsiDariKoordinat(-0.005, 2, fitur)).toBe("32");
    // Dekat tepi 33 daripada 32.
    expect(provinsiDariKoordinat(-0.005, 15, fitur)).toBe("33");
    // Melewati ambang → tetap laut.
    expect(provinsiDariKoordinat(-0.02, 2, fitur)).toBeNull();
  });

  it("ambang pesisir kecil: titik di negara tetangga tidak ikut diberi provinsi", () => {
    // Perbatasan darat tidak bisa dibedakan dari garis pantai, jadi ambangnya yang dijaga
    // kecil (±1,1 km). Titik 2 km di luar tepi — mis. di seberang pos lintas batas.
    expect(AMBANG_PESISIR).toBeLessThanOrEqual(0.01);
    expect(provinsiDariKoordinat(10.018, 5, fitur)).toBeNull();
  });
});
