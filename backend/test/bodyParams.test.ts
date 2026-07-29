import { describe, it, expect } from "vitest";
import { resolveBodyParams } from "../src/services/blastService.js";
import { bodyParamCountOf } from "../src/providers/meta.js";

// Kasus nyata: template BARU tanpa variabel, tapi sistem tetap mengirim nama kontak
// sebagai {{1}} -> Meta menolak SELURUH kiriman:
// #132000 "body: number of localizable_params (1) does not match the expected number of params (0)".

describe("resolveBodyParams", () => {
  it("template TANPA variabel → tidak mengirim parameter sama sekali", () => {
    expect(resolveBodyParams({ expected: 0, contactName: "Budi" })).toEqual([]);
    // walau operator terlanjur mengisi, tetap kosong (template-lah yang menentukan)
    expect(resolveBodyParams({ expected: 0, provided: ["Budi"], contactName: "Budi" })).toEqual([]);
  });

  it("template 1 variabel, operator kosong → diisi nama kontak", () => {
    expect(resolveBodyParams({ expected: 1, contactName: "Budi" })).toEqual(["Budi"]);
  });

  it("template 2 variabel, operator isi 1 → kekurangan diisi nama kontak (jumlah harus pas)", () => {
    expect(resolveBodyParams({ expected: 2, provided: ["Populi Center"], contactName: "Budi" })).toEqual([
      "Populi Center",
      "Budi",
    ]);
  });

  it("operator mengisi LEBIH banyak dari variabel → dipotong sesuai template", () => {
    expect(resolveBodyParams({ expected: 1, provided: ["A", "B", "C"], contactName: "Budi" })).toEqual(["A"]);
  });

  it("nilai kosong/spasi diganti nama kontak (parameter kosong ditolak Meta)", () => {
    expect(resolveBodyParams({ expected: 2, provided: ["  ", "X"], contactName: "Budi" })).toEqual(["Budi", "X"]);
  });

  it("belum disinkron (null) → perilaku lama: isian operator, atau nama kontak", () => {
    expect(resolveBodyParams({ expected: null, contactName: "Budi" })).toEqual(["Budi"]);
    expect(resolveBodyParams({ expected: null, provided: ["A", "B"], contactName: "Budi" })).toEqual(["A", "B"]);
  });
});

describe("bodyParamCountOf (baca jumlah variabel dari components Meta)", () => {
  it("hitung dari indeks tertinggi {{n}} di BODY", () => {
    expect(bodyParamCountOf([{ type: "BODY", text: "Halo {{1}}, dari {{2}}" }])).toBe(2);
    expect(bodyParamCountOf([{ type: "BODY", text: "Tanpa variabel." }])).toBe(0);
  });

  it("indeks tertinggi yang menentukan, bukan jumlah kemunculan", () => {
    expect(bodyParamCountOf([{ type: "BODY", text: "{{1}} dan {{1}} lagi, lalu {{3}}" }])).toBe(3);
  });

  it("hanya BODY yang dihitung — variabel di HEADER diabaikan", () => {
    const comps = [
      { type: "HEADER", format: "TEXT", text: "Judul {{1}}" },
      { type: "BODY", text: "Tanpa variabel" },
    ];
    expect(bodyParamCountOf(comps)).toBe(0);
  });

  it("bentuk tak terduga → 0", () => {
    expect(bodyParamCountOf(undefined)).toBe(0);
    expect(bodyParamCountOf([{ type: "FOOTER", text: "{{1}}" }])).toBe(0);
  });
});
