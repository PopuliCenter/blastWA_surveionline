import { describe, it, expect } from "vitest";
import { parsePage, parsePageSize, CONTACT_PAGE_SIZES, CONVO_PAGE_SIZES } from "../src/lib/pageParams.js";

describe("parsePage", () => {
  it("menerima angka halaman yang sah", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("37")).toBe(37);
    expect(parsePage(5)).toBe(5);
  });

  it("nilai ngawur jatuh ke halaman 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("Infinity")).toBe(1);
    expect(parsePage(null)).toBe(1);
  });

  it("pecahan dipangkas ke bawah", () => {
    expect(parsePage("2.9")).toBe(2);
  });
});

describe("parsePageSize", () => {
  it("menerima nilai yang ada di daftar pilihan", () => {
    for (const n of CONTACT_PAGE_SIZES) expect(parsePageSize(String(n), CONTACT_PAGE_SIZES, 100)).toBe(n);
    for (const n of CONVO_PAGE_SIZES) expect(parsePageSize(n, CONVO_PAGE_SIZES, 200)).toBe(n);
  });

  it("di luar daftar → bawaan, BUKAN dibulatkan ke terdekat", () => {
    // Query string rakitan tangan tidak boleh bisa memesan jutaan baris.
    expect(parsePageSize("1000000", CONTACT_PAGE_SIZES, 100)).toBe(100);
    expect(parsePageSize("499", CONTACT_PAGE_SIZES, 100)).toBe(100);
    expect(parsePageSize("-100", CONTACT_PAGE_SIZES, 100)).toBe(100);
    expect(parsePageSize(undefined, CONTACT_PAGE_SIZES, 100)).toBe(100);
    expect(parsePageSize("abc", CONVO_PAGE_SIZES, 200)).toBe(200);
  });

  it("pilihan Kontak persis permintaan pemakai: 100/500/1000/1500", () => {
    expect([...CONTACT_PAGE_SIZES]).toEqual([100, 500, 1000, 1500]);
  });
});
