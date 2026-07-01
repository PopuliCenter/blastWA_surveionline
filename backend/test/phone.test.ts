import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "../src/lib/phone.js";

describe("normalizePhone", () => {
  it("mengubah awalan 0 → kode negara 62", () => {
    expect(normalizePhone("0812-3456-789")).toBe("628123456789");
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });
  it("menambah 62 pada nomor lokal diawali 8", () => {
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });
  it("menghapus + dan simbol", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });
  it("membiarkan nomor yang sudah 62…", () => {
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });
  it("mendukung kode negara lain", () => {
    expect(normalizePhone("0123", "1")).toBe("1123");
  });
});

describe("isValidPhone", () => {
  it("valid untuk nomor 8–15 digit setelah normalisasi", () => {
    expect(isValidPhone("081234567890")).toBe(true);
    expect(isValidPhone("+6281234567890")).toBe(true);
  });
  it("tidak valid untuk terlalu pendek / kosong / huruf", () => {
    expect(isValidPhone("12")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("abcdefg")).toBe(false);
  });
});
