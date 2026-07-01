import { describe, it, expect } from "vitest";
import { encryptJson, decryptJson } from "../src/lib/crypto.js";

describe("crypto (AES-256-GCM)", () => {
  it("enkripsi lalu dekripsi mengembalikan objek asli (roundtrip)", () => {
    const data = { accessToken: "EAA-rahasia", phoneNumberId: "123", nested: { a: 1 } };
    const blob = encryptJson(data);
    expect(typeof blob).toBe("string");
    expect(blob).not.toContain("EAA-rahasia"); // benar-benar terenkripsi
    expect(decryptJson(blob)).toEqual(data);
  });

  it("dua enkripsi nilai sama menghasilkan ciphertext berbeda (IV acak)", () => {
    const a = encryptJson({ x: 1 });
    const b = encryptJson({ x: 1 });
    expect(a).not.toBe(b);
    expect(decryptJson(a)).toEqual(decryptJson(b));
  });

  it("menolak/berbeda saat ciphertext dirusak", () => {
    const blob = encryptJson({ x: "aman" });
    const tampered = blob.slice(0, -4) + (blob.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    expect(() => decryptJson(tampered)).toThrow();
  });
});
