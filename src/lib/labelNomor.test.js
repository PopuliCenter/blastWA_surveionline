import { describe, it, expect } from "vitest";
import { apakahInstagram, labelNomor, namaAtauNomor } from "./labelNomor";

describe("apakahInstagram", () => {
  it("mengenali alamat berawalan ig:", () => {
    expect(apakahInstagram("ig:17841400000000001")).toBe(true);
  });
  it("nomor WhatsApp dan nilai kosong bukan Instagram", () => {
    expect(apakahInstagram("6281234567890")).toBe(false);
    expect(apakahInstagram("")).toBe(false);
    expect(apakahInstagram(null)).toBe(false);
    expect(apakahInstagram(undefined)).toBe(false);
  });
});

describe("labelNomor", () => {
  it("nomor WhatsApp tampil apa adanya", () => {
    expect(labelNomor("6281234567890")).toBe("6281234567890");
  });
  it("alamat IG ditandai Instagram dengan potongan ID", () => {
    expect(labelNomor("ig:17841400000000001")).toBe("Instagram · …000001");
  });
  it("alamat IG tanpa ID tetap terbaca Instagram", () => {
    expect(labelNomor("ig:")).toBe("Instagram");
  });
  it("nilai kosong tidak menjadi teks 'undefined'", () => {
    expect(labelNomor(undefined)).toBe("");
    expect(labelNomor(null)).toBe("");
  });
});

describe("namaAtauNomor", () => {
  it("nama didahulukan", () => {
    expect(namaAtauNomor({ name: "Andi", phone: "ig:123" })).toBe("Andi");
  });
  it("tanpa nama → label nomor", () => {
    expect(namaAtauNomor({ name: "", phone: "ig:17841400000000001" })).toBe("Instagram · …000001");
    expect(namaAtauNomor({ phone: "628123" })).toBe("628123");
  });
});
