import { describe, it, expect } from "vitest";
import { INDONESIA, bboxSebaran, dalamIndonesia, jariJari, ringkasLokasi } from "./petaSebaran";

const r = (statusLokasi, lokasi = null, lain = {}) => ({ statusLokasi, lokasi, ...lain });
const jabar = (lat, lng) => ({ lat, lng, kodeProvinsi: "32", provinsi: "Jawa Barat" });

describe("ringkasLokasi", () => {
  it("menghitung status, provinsi, dan menggabungkan titik yang sama", () => {
    const hasil = ringkasLokasi([
      r("tidak-diminta"),
      r("belum-dibagikan"),
      r("sesuai", jabar(-6.91, 107.61)),
      r("sesuai", jabar(-6.91, 107.61)),
      r("tidak-sesuai", { lat: -6.2, lng: 106.85, kodeProvinsi: "31", provinsi: "DKI Jakarta" }),
      r("di-luar-batas", { lat: -5, lng: 105, kodeProvinsi: null, provinsi: null }),
      // Ditolak kuota: tidak dihitung di mana pun.
      r("sesuai", jabar(-6.91, 107.61), { ditolakKuotaPada: "2026-10-16T00:00:00Z" }),
    ]);
    expect(hasil.diminta).toBe(5);
    expect(hasil.dibagikan).toBe(4);
    expect(hasil.status).toMatchObject({ sesuai: 2, "tidak-sesuai": 1, "di-luar-batas": 1, "belum-dibagikan": 1 });
    expect(hasil.perProvinsi.get("32")).toBe(2);
    expect(hasil.distribusiProvinsi).toEqual([
      ["Jawa Barat", 2],
      ["DKI Jakarta", 1],
      ["Di luar batas provinsi", 1],
    ]);
    expect(hasil.titik).toHaveLength(3);
    expect(hasil.titik.find((t) => t.lat === -6.91).n).toBe(2);
  });
});

describe("ringkasLokasi — data batas belum terpasang", () => {
  it("lokasi tanpa provinsi berlabel 'belum dapat ditentukan', bukan 'di luar batas'", () => {
    const h = ringkasLokasi([r("belum-diperiksa", { lat: -6.91, lng: 107.61, kodeProvinsi: null, provinsi: null })]);
    expect(h.status["belum-diperiksa"]).toBe(1);
    expect(h.distribusiProvinsi).toEqual([["Provinsi belum dapat ditentukan", 1]]);
  });
});

describe("dalamIndonesia", () => {
  it("titik di luar negeri tidak ikut menentukan zoom", () => {
    expect(dalamIndonesia({ lat: -6.91, lng: 107.61 })).toBe(true);
    expect(dalamIndonesia({ lat: 21.49, lng: 39.19 })).toBe(false); // Jeddah
    expect(dalamIndonesia({ lat: 51.5, lng: -0.12 })).toBe(false); // London
  });
});

describe("kotak tampilan", () => {
  it("tanpa titik → seluruh Indonesia", () => {
    expect(bboxSebaran([])).toEqual(INDONESIA);
  });

  it("satu titik tidak diperbesar sampai seluas satu desa", () => {
    const [a, b, c, d] = bboxSebaran([{ lat: -6.91, lng: 107.61 }]);
    expect(c - a).toBeGreaterThanOrEqual(1.2);
    expect(d - b).toBeGreaterThanOrEqual(1.2);
    expect((a + c) / 2).toBeCloseTo(107.61);
  });
});

describe("jariJari", () => {
  it("luas sebanding jumlah — jari-jari sebanding akar", () => {
    expect(jariJari(4, 3)).toBe(6);
    expect(jariJari(1, 3)).toBe(3);
  });
});
