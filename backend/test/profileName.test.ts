import { describe, it, expect } from "vitest";
import { cleanProfileName, MAX_PROFILE_NAME } from "../src/lib/profileName.js";

describe("cleanProfileName", () => {
  it("menerima nama biasa", () => {
    expect(cleanProfileName("Ani Suryani")).toBe("Ani Suryani");
  });

  it("merapatkan spasi dan baris baru", () => {
    expect(cleanProfileName("  Budi \n  Santoso ")).toBe("Budi Santoso");
  });

  it("menerima nama panjang berikut gelar", () => {
    // Contoh nyata sepanjang 37 karakter — jangan sampai ikut tersaring.
    expect(cleanProfileName("Dr. Hj. Siti Nurhaliza binti Abdullah")).toBe("Dr. Hj. Siti Nurhaliza binti Abdullah");
  });

  it("menerima huruf non-Latin", () => {
    expect(cleanProfileName("محمد")).toBe("محمد");
  });

  it("menolak bukan string", () => {
    expect(cleanProfileName(undefined)).toBeUndefined();
    expect(cleanProfileName(null)).toBeUndefined();
    expect(cleanProfileName(628123456789)).toBeUndefined();
    expect(cleanProfileName({ name: "Ani" })).toBeUndefined();
  });

  it("menolak kosong atau spasi saja", () => {
    expect(cleanProfileName("")).toBeUndefined();
    expect(cleanProfileName("   ")).toBeUndefined();
    expect(cleanProfileName("\n\t")).toBeUndefined();
  });

  it("menolak nama tanpa huruf sama sekali", () => {
    // Semuanya nama profil yang benar-benar dipakai orang.
    expect(cleanProfileName(".")).toBeUndefined();
    expect(cleanProfileName("•")).toBeUndefined();
    expect(cleanProfileName("...")).toBeUndefined();
    expect(cleanProfileName("🌹🌹")).toBeUndefined();
    expect(cleanProfileName("628123456789")).toBeUndefined();
    expect(cleanProfileName("+62 812-3456-789")).toBeUndefined();
  });

  it("menolak teks yang kelewat panjang, bukan memotongnya", () => {
    // Kalimat promosi sebagai nama profil. Dipotong di tengah malah jadi sapaan rusak,
    // jadi ditolak agar blast memakai "Pelanggan".
    const promosi = "JUAL PULSA MURAH 24 JAM SIAP KIRIM SEKARANG HUBUNGI SAYA SEGERA YA KAK";
    expect(promosi.length).toBeGreaterThan(MAX_PROFILE_NAME);
    expect(cleanProfileName(promosi)).toBeUndefined();
  });

  it("menerima nama tepat di batas panjang", () => {
    const tepat = "a".repeat(MAX_PROFILE_NAME);
    expect(cleanProfileName(tepat)).toBe(tepat);
    expect(cleanProfileName("a".repeat(MAX_PROFILE_NAME + 1))).toBeUndefined();
  });

  it("mengukur panjang setelah spasi dirapatkan", () => {
    // Spasi berlebih tidak boleh membuat nama yang sah jadi tertolak.
    const renggang = `${"a".repeat(30)}${" ".repeat(20)}${"b".repeat(29)}`;
    expect(renggang.length).toBeGreaterThan(MAX_PROFILE_NAME);
    expect(cleanProfileName(renggang)).toBe(`${"a".repeat(30)} ${"b".repeat(29)}`);
  });

  it("menerima nama bercampur emoji karena masih ada hurufnya", () => {
    expect(cleanProfileName("Bunda Aira 🌸")).toBe("Bunda Aira 🌸");
  });
});
