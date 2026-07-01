import { describe, it, expect } from "vitest";
import { validateAnswer, nextStepWithBranch, formatQuestion, closingText, type QLite } from "../src/lib/surveyLogic.js";
import type { NormalizedInbound } from "../src/providers/types.js";

// Bantu buat event masuk minimal.
const ev = (text?: string, extra: Partial<NormalizedInbound> = {}): NormalizedInbound =>
  ({ vendor: "meta", kind: "message", timestamp: "2026-07-01T00:00:00Z", raw: {}, text, ...extra }) as NormalizedInbound;

const q = (type: string, options: any = null, required = true): QLite => ({ id: "q1", text: "Pertanyaan?", type, required, options });

describe("validateAnswer", () => {
  it("rating: terima dalam rentang, tolak di luar", () => {
    const r = q("rating", { min: 1, max: 5 });
    expect(validateAnswer(r, ev("4"))).toEqual({ ok: true, value: "4" });
    expect(validateAnswer(r, ev("9")).ok).toBe(false);
    expect(validateAnswer(r, ev("abc")).ok).toBe(false);
  });

  it("number: terima angka, tolak teks/kosong", () => {
    expect(validateAnswer(q("number"), ev("12.5"))).toEqual({ ok: true, value: "12.5" });
    expect(validateAnswer(q("number"), ev("dua")).ok).toBe(false);
    expect(validateAnswer(q("number"), ev("")).ok).toBe(false);
  });

  it("choice: pilih via nomor, teks persis, dan sebagian tak-ambigu", () => {
    const c = q("choice", { choices: ["Sangat puas", "Puas", "Biasa"] });
    expect(validateAnswer(c, ev("2"))).toEqual({ ok: true, value: "Puas" });
    expect(validateAnswer(c, ev("sangat puas"))).toEqual({ ok: true, value: "Sangat puas" });
    expect(validateAnswer(c, ev("biasa"))).toEqual({ ok: true, value: "Biasa" });
    expect(validateAnswer(c, ev("9")).ok).toBe(false); // di luar rentang pilihan
  });

  it("boolean: kenali ragam ya/tidak", () => {
    const b = q("boolean");
    expect(validateAnswer(b, ev("iya"))).toEqual({ ok: true, value: "Ya" });
    expect(validateAnswer(b, ev("nggak"))).toEqual({ ok: true, value: "Tidak" });
    expect(validateAnswer(b, ev("mungkin")).ok).toBe(false);
  });

  it("image: butuh media gambar", () => {
    const img = q("image");
    expect(validateAnswer(img, ev(undefined, { mediaType: "image", mediaId: "M1" }))).toEqual({ ok: true, value: "[gambar] M1" });
    expect(validateAnswer(img, ev("teks")).ok).toBe(false);
  });

  it("text: butuh teks non-kosong", () => {
    expect(validateAnswer(q("text"), ev("halo"))).toEqual({ ok: true, value: "halo" });
    expect(validateAnswer(q("text"), ev("   ")).ok).toBe(false);
  });
});

describe("nextStepWithBranch (skip logic)", () => {
  const total = 5;
  it("tanpa branch → maju ke langkah berikutnya", () => {
    expect(nextStepWithBranch(q("choice", { choices: ["A", "B"] }), 0, "A", total)).toBe(1);
  });
  it("branch 'end' → selesaikan survei (= total)", () => {
    const c = q("boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    expect(nextStepWithBranch(c, 0, "Tidak", total)).toBe(total);
  });
  it("branch lompat maju ke indeks tertentu", () => {
    const c = q("boolean", { branches: [{ value: "Ya", goto: 3 }] });
    expect(nextStepWithBranch(c, 0, "Ya", total)).toBe(3);
  });
  it("abaikan lompat mundur/di luar batas → default maju", () => {
    const back = q("choice", { branches: [{ value: "A", goto: 0 }] });
    expect(nextStepWithBranch(back, 2, "A", total)).toBe(3); // goto 0 (mundur) diabaikan
    const oob = q("choice", { branches: [{ value: "A", goto: 99 }] });
    expect(nextStepWithBranch(oob, 0, "A", total)).toBe(1);
  });
  it("jawaban dilewati atau tak cocok → default maju", () => {
    const c = q("choice", { branches: [{ value: "A", goto: "end" }] });
    expect(nextStepWithBranch(c, 0, "[dilewati]", total)).toBe(1);
    expect(nextStepWithBranch(c, 0, "B", total)).toBe(1);
  });
  it("cocokkan case-insensitive", () => {
    const c = q("choice", { branches: [{ value: "Tidak Tahu", goto: "end" }] });
    expect(nextStepWithBranch(c, 0, "tidak tahu", total)).toBe(total);
  });
});

describe("formatQuestion & closingText", () => {
  it("choice menampilkan opsi bernomor", () => {
    const out = formatQuestion(q("choice", { choices: ["A", "B"] }));
    expect(out).toContain("1. A");
    expect(out).toContain("2. B");
  });
  it("pertanyaan opsional memberi petunjuk LEWATI", () => {
    expect(formatQuestion(q("text", null, false))).toContain("LEWATI");
  });
  it("closingText pakai custom bila ada, selain itu default", () => {
    expect(closingText("Makasih ya!")).toBe("Makasih ya!");
    expect(closingText("")).toContain("Terima kasih");
    expect(closingText(null)).toContain("Terima kasih");
  });
});
