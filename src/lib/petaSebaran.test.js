import { describe, it, expect } from "vitest";
import {
  INDONESIA,
  bboxSebaran,
  bboxPoligon,
  bersinggungan,
  dalamIndonesia,
  jalurPoligon,
  jariJari,
  pasAspek,
  proyeksi,
  ringkasLokasi,
} from "./petaSebaran";

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

  it("pasAspek menghasilkan perbandingan yang diminta dengan titik tengah tetap", () => {
    for (const aspek of [0.4, 0.85]) {
      const bb = pasAspek([105, -8, 109, -5], aspek);
      const { tinggi } = proyeksi(bb, 1000);
      expect(tinggi / 1000).toBeCloseTo(aspek, 5);
      expect((bb[0] + bb[2]) / 2).toBeCloseTo(107);
      expect((bb[1] + bb[3]) / 2).toBeCloseTo(-6.5);
    }
  });
});

describe("proyeksi & jalur", () => {
  it("sudut kiri atas di (0,0), kanan bawah di (lebar, tinggi)", () => {
    const p = proyeksi([100, -10, 110, 0], 1000);
    expect(p.xy(100, 0)).toEqual([0, 0]);
    const [x, y] = p.xy(110, -10);
    expect(x).toBeCloseTo(1000);
    expect(y).toBeCloseTo(p.tinggi);
  });

  it("jalur SVG menutup setiap cincin", () => {
    const p = proyeksi([0, 0, 10, 10], 100);
    const d = jalurPoligon(
      [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 0],
          ],
        ],
      ],
      p.xy,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/L/g)).toHaveLength(3);
  });

  it("provinsi di luar kotak tampilan dilewati; yang tampil sebagian — termasuk di sudut — tidak", () => {
    const besar = [
      [
        [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
          [0, 0],
        ],
      ],
    ];
    expect(bersinggungan(bboxPoligon(besar), [30, 30, 40, 40])).toBe(false);
    expect(bersinggungan(bboxPoligon(besar), [5, 5, 6, 6])).toBe(true);
    // Segitiga yang memotong sudut kiri bawah kotak [4,4,7,7] tanpa satu titik pun di dalamnya.
    const segitiga = [
      [
        [
          [0, 0],
          [10, 0],
          [0, 10],
          [0, 0],
        ],
      ],
    ];
    expect(bersinggungan(bboxPoligon(segitiga), [4, 4, 7, 7])).toBe(true);
  });
});

describe("jariJari", () => {
  it("luas sebanding jumlah — jari-jari sebanding akar", () => {
    expect(jariJari(4, 3)).toBe(6);
    expect(jariJari(1, 3)).toBe(3);
  });
});
