import { describe, it, expect } from "vitest";
import { susunBatas, type FiturSumber } from "../src/lib/susunBatas.js";
import { PROVINSI } from "../src/lib/wilayah.js";

// Pengolah data batas provinsi: berkas sumber yang salah bentuk harus DITOLAK dengan alasan
// yang jelas, bukan menghasilkan peta yang retak atau provinsi yang hilang diam-diam.

const kotak = (x: number, y: number) => [
  [x, y, 12.5], // koordinat ketiga (tinggi) — harus dibuang
  [x + 1, y, 12.5],
  [x + 1, y + 1, 12.5],
  [x, y + 1, 12.5],
  [x, y, 12.5],
];
const fitur = (props: Record<string, unknown>, x = 0): FiturSumber => ({
  properties: props,
  geometry: { type: "Polygon", coordinates: [kotak(x, 0)] },
});
const lengkap = () => PROVINSI.map((p, i) => fitur({ KDPPUM: p.kode }, i * 2));

describe("susunBatas", () => {
  it("satu fitur per provinsi: lengkap, 2 dimensi, terurut", () => {
    const h = susunBatas(lengkap(), { propKode: "KDPPUM" });
    expect(h.hilang).toEqual([]);
    expect(h.belumDilebur).toEqual([]);
    expect(h.fitur).toHaveLength(PROVINSI.length);
    expect(h.fitur[0]!.poligon[0]![0]![0]).toEqual([0, 0]);
    expect(h.fitur.map((f) => f.kode)).toEqual([...h.fitur.map((f) => f.kode)].sort());
  });

  it("data per kab/kota yang belum dilebur dilaporkan", () => {
    const sumber = [...lengkap(), fitur({ KDPPUM: "32" }, 99), fitur({ KDPPUM: "32" }, 101)];
    const h = susunBatas(sumber, { propKode: "KDPPUM" });
    expect(h.belumDilebur).toEqual([["32", 3]]);
  });

  it("provinsi yang tidak ada di sumber (pembagian lama 34 provinsi) dilaporkan", () => {
    const tanpaPapuaBaru = lengkap().filter((f) => !["93", "94", "95", "96"].includes(String(f.properties!.KDPPUM)));
    const h = susunBatas(tanpaPapuaBaru, { propKode: "KDPPUM" });
    expect(h.hilang.map((p) => p.kode).sort()).toEqual(["93", "94", "95", "96"]);
  });

  it("kunci kosong atau tak dikenal dilewati dan disebutkan", () => {
    const h = susunBatas([...lengkap(), fitur({ KDPPUM: "" }), fitur({ KDPPUM: "99" }), fitur({})], {
      propKode: "KDPPUM",
    });
    expect(h.takCocok).toEqual(["(kosong)", "99", "(kosong)"]);
  });

  it("kode bertitik kab/kota dibaca kode provinsinya; kode 3 digit tidak", () => {
    const h = susunBatas([fitur({ K: "32.04" }), fitur({ K: "320" })], { propKode: "K" });
    expect(h.fitur.map((f) => f.kode)).toEqual(["32"]);
    expect(h.takCocok).toEqual(["320"]);
  });

  it("MultiPolygon dan pencocokan nama provinsi", () => {
    const h = susunBatas(
      [
        {
          properties: { WADMPR: "Daerah Khusus Ibukota Jakarta" },
          geometry: { type: "MultiPolygon", coordinates: [[kotak(0, 0)], [kotak(5, 5)]] },
        },
      ],
      { propNama: "WADMPR" },
    );
    expect(h.fitur).toHaveLength(1);
    expect(h.fitur[0]!.kode).toBe("31");
    expect(h.fitur[0]!.poligon).toHaveLength(2);
  });
});
