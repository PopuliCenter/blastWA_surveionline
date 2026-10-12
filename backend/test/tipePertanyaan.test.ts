import { describe, it, expect } from "vitest";
import { questionSchema } from "../src/routes/surveys.js";
import { flowSupported } from "../src/lib/flowJson.js";

// Daftar tipe yang DITAWARKAN pemilih tipe jawaban di UI (src/pages/survey/constants.js).
// Disalin ke sini dengan sengaja: frontend dan backend tidak berbagi modul, dan uji inilah
// satu-satunya hal yang mengikat keduanya.
const TIPE_DI_UI = [
  "text",
  "rating",
  "number",
  "choice",
  "multichoice",
  "boolean",
  "date",
  "consent",
  "image",
  "wilayah",
];

describe("tipe pertanyaan yang diterima server", () => {
  it("menerima SETIAP tipe yang ditawarkan UI", () => {
    // Pernah tidak: "wilayah" ada di pemilih tipe tapi tidak di skema, jadi setiap survei
    // yang memakainya ditolak saat disimpan — dan pesan galatnya tidak terbaca.
    for (const type of TIPE_DI_UI) {
      const r = questionSchema.safeParse({ text: "Pertanyaan", type });
      expect(r.success, `tipe "${type}" ditolak server padahal ditawarkan di UI`).toBe(true);
    }
  });

  it("tetap menolak tipe yang memang tidak ada", () => {
    expect(questionSchema.safeParse({ text: "x", type: "wilayahh" }).success).toBe(false);
    expect(questionSchema.safeParse({ text: "x", type: "" }).success).toBe(false);
  });

  it("tipe wilayah didukung juga oleh pembangun Flow", () => {
    // Kalau server menerimanya tapi Flow tidak mengenalinya, pertanyaannya akan hilang
    // diam-diam dari formulir yang diterima responden.
    expect(flowSupported({ id: "q1", text: "Wilayah", type: "wilayah" })).toBe(true);
  });

  it("teks kosong tetap ditolak", () => {
    expect(questionSchema.safeParse({ text: "", type: "text" }).success).toBe(false);
  });
});
