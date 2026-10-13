import { describe, it, expect } from "vitest";
import { judulSalinan, tabBertabrakan, teksPertanyaanGanda } from "../src/lib/salinSurvei.js";
import { sheetTabName, MAX_TAB_CHARS } from "../src/lib/sheetRows.js";

describe("judulSalinan", () => {
  it("menambahkan akhiran salinan", () => {
    expect(judulSalinan("Survei Pangan", ["Survei Pangan"])).toBe("Survei Pangan (salinan)");
  });

  it("menomori salinan berikutnya, bukan menumpuk akhiran", () => {
    const ada = ["Survei Pangan", "Survei Pangan (salinan)"];
    expect(judulSalinan("Survei Pangan", ada)).toBe("Survei Pangan (salinan 2)");
    // Menggandakan salinannya pun tidak menghasilkan "(salinan) (salinan)".
    expect(judulSalinan("Survei Pangan (salinan)", ada)).toBe("Survei Pangan (salinan 2)");
  });

  it("judul panjang dipotong DULU supaya akhirannya tidak ikut terpotong di batas nama tab", () => {
    // Tanpa ini, "<100 huruf> (salinan)" dipotong Google jadi "<100 huruf>" — sama persis
    // dengan tab survei aslinya, dan baris kedua survei bercampur di satu tab.
    const panjang = "Survei Persepsi Publik ".repeat(6).trim(); // > 100 karakter
    const salinan = judulSalinan(panjang, [panjang]);
    expect(sheetTabName(salinan)).not.toBe(sheetTabName(panjang));
    expect(sheetTabName(salinan).endsWith("(salinan)")).toBe(true);
    expect(sheetTabName(salinan).length).toBeLessThanOrEqual(MAX_TAB_CHARS);
  });

  it("tabrakan dibandingkan menurut nama TAB, termasuk beda huruf besar-kecil dan karakter terlarang", () => {
    // "Survei: A" dan "survei  a" menjadi tab yang sama di Google Sheets.
    const salinan = judulSalinan("Survei A", ["Survei A", "survei: a (salinan)"]);
    expect(salinan).toBe("Survei A (salinan 2)");
  });
});

describe("tabBertabrakan", () => {
  it("mengenali judul yang akan berbagi tab", () => {
    expect(tabBertabrakan("Survei: Pangan", ["survei pangan"])).toBe(true);
    expect(tabBertabrakan("Survei Pangan 2026", ["Survei Pangan"])).toBe(false);
  });
});

describe("teksPertanyaanGanda", () => {
  it("menemukan teks yang sama persis, mengabaikan spasi di tepi", () => {
    expect(teksPertanyaanGanda([{ text: "Usia?" }, { text: " Usia? " }, { text: "Nama?" }])).toEqual(["Usia?"]);
  });

  it("kosong bila semuanya berbeda", () => {
    expect(teksPertanyaanGanda([{ text: "Usia?" }, { text: "Usia? (salinan)" }])).toEqual([]);
  });
});
