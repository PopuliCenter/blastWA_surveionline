import { describe, it, expect } from "vitest";
import { looksLikeQuestion } from "../src/lib/surveyLogic.js";

describe("looksLikeQuestion — melindungi pertanyaan agar tidak memulai survei", () => {
  it("mengenali pertanyaan yang MEMUAT kata kunci pemicu", () => {
    // Kasus nyata dari produksi: responden mengetik "Cara isi survei" untuk bertanya,
    // tapi kalimat itu mengandung kata kunci "isi survei" sehingga dulu langsung
    // melempar dia ke dalam survei (dan dibalas "sudah pernah mengisi").
    for (const t of ["cara isi survei", "Cara isi survei", "bagaimana cara isi survei", "gimana isi survei"]) {
      expect(looksLikeQuestion(t), t).toBe(true);
    }
  });

  it("mengenali kalimat bertanda tanya", () => {
    for (const t of ["isi survei?", "ini siapa ya?", "survei apa?"]) {
      expect(looksLikeQuestion(t), t).toBe(true);
    }
  });

  it("mengenali kata tanya umum di awal kalimat", () => {
    for (const t of ["apa itu populi center", "berapa lama pengisiannya", "kapan ditutup", "siapa ini", "kenapa saya"]) {
      expect(looksLikeQuestion(t), t).toBe(true);
    }
  });

  it("TIDAK menganggap perintah memulai sebagai pertanyaan", () => {
    for (const t of ["isi survei", "ISI SURVEI", "mau isi survei", "saya mau isi survei", "survei", "ok"]) {
      expect(looksLikeQuestion(t), t).toBe(false);
    }
  });

  it("tidak tertipu kata yang hanya DIAWALI huruf sama", () => {
    // "caranya" bukan "cara ..." — jangan dianggap kata tanya.
    expect(looksLikeQuestion("caranya sudah saya isi")).toBe(false);
    expect(looksLikeQuestion("apapun jawabannya saya kirim")).toBe(false);
  });

  it("menolak pesan kosong", () => {
    for (const t of ["", "   ", "🙏"]) expect(looksLikeQuestion(t), t).toBe(false);
  });
});
