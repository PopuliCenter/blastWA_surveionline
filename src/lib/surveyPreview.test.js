import { describe, it, expect } from "vitest";
import { formatQuestion, validateAnswer, nextStep, quickReplies, inputPlaceholder } from "./surveyPreview";

const q = (type, options = null, required = true) => ({ text: "T?", type, required, options });

describe("validateAnswer", () => {
  it("choice: nomor & teks", () => {
    const c = q("choice", { choices: ["Ya", "Tidak"] });
    expect(validateAnswer(c, "1")).toEqual({ ok: true, saved: "Ya" });
    expect(validateAnswer(c, "tidak")).toEqual({ ok: true, saved: "Tidak" });
    expect(validateAnswer(c, "9").ok).toBe(false);
  });
  it("multichoice: beberapa nomor + dedupe", () => {
    const m = q("multichoice", { choices: ["A", "B", "C"] });
    expect(validateAnswer(m, "1,3")).toEqual({ ok: true, saved: "A, C" });
    expect(validateAnswer(m, "2 2 1")).toEqual({ ok: true, saved: "B, A" });
    expect(validateAnswer(m, "").ok).toBe(false);
  });
  it("rating: hormati rentang", () => {
    const r = q("rating", { min: 1, max: 5 });
    expect(validateAnswer(r, "4")).toEqual({ ok: true, saved: "4" });
    expect(validateAnswer(r, "6").ok).toBe(false);
  });
  it("opsional: 'lewati' → dilewati", () => {
    expect(validateAnswer(q("text", null, false), "lewati")).toEqual({ ok: true, saved: "[dilewati]" });
  });
});

describe("nextStep (skip-logic) — inti perbaikan drift", () => {
  const total = 5;
  it("tanpa branch → maju satu langkah", () => {
    expect(nextStep(q("choice", { choices: ["A"] }), 0, "A", total)).toBe(1);
  });
  it("branch 'end' → selesai (= total)", () => {
    const c = q("boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    expect(nextStep(c, 0, "Tidak", total)).toBe(total);
  });
  it("branch lompat MAJU ke indeks", () => {
    const c = q("boolean", { branches: [{ value: "Ya", goto: 3 }] });
    expect(nextStep(c, 0, "Ya", total)).toBe(3);
  });
  it("abaikan lompat mundur/di luar batas → default", () => {
    expect(nextStep(q("choice", { branches: [{ value: "A", goto: 0 }] }), 2, "A", total)).toBe(3);
    expect(nextStep(q("choice", { branches: [{ value: "A", goto: 99 }] }), 0, "A", total)).toBe(1);
  });
  it("dilewati / tak cocok → default maju", () => {
    const c = q("choice", { branches: [{ value: "A", goto: "end" }] });
    expect(nextStep(c, 0, "[dilewati]", total)).toBe(1);
    expect(nextStep(c, 0, "B", total)).toBe(1);
  });
});

describe("format & util", () => {
  it("formatQuestion menampilkan rating berlabel", () => {
    const out = formatQuestion(q("rating", { min: 1, max: 5, minLabel: "Buruk", maxLabel: "Bagus" }), 0, 3);
    expect(out).toContain("1 = Buruk");
    expect(out).toContain("5 = Bagus");
  });
  it("quickReplies: boolean & choice", () => {
    expect(quickReplies(q("boolean"))).toEqual(["Ya", "Tidak"]);
    expect(quickReplies(q("choice", { choices: ["A", "B"] }))).toEqual(["1", "2"]);
    expect(quickReplies(q("multichoice", { choices: ["A"] }))).toEqual([]);
  });
  it("inputPlaceholder per tipe", () => {
    expect(inputPlaceholder(q("rating", { min: 1, max: 5 }))).toContain("1–5");
    expect(inputPlaceholder(q("multichoice"))).toContain("1,3");
  });
});
