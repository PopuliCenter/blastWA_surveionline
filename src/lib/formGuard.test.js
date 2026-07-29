import { describe, it, expect } from "vitest";
import { isChanged, needsDiscardConfirm } from "./formGuard";

describe("isChanged", () => {
  it("menganggap draf yang identik sebagai belum berubah", () => {
    const initial = { name: "gilang", role: "admin", active: true };
    expect(isChanged({ ...initial }, initial)).toBe(false);
  });

  it("mendeteksi perubahan nilai teks", () => {
    const initial = { name: "gilang", role: "admin" };
    expect(isChanged({ ...initial, name: "gilang k" }, initial)).toBe(true);
  });

  it("mendeteksi perubahan boolean, termasuk kembali ke false", () => {
    expect(isChanged({ active: false }, { active: true })).toBe(true);
    expect(isChanged({ active: true }, { active: true })).toBe(false);
  });

  it("mendeteksi perubahan di dalam array — mis. kata kunci pemicu", () => {
    const initial = { triggerKeywords: ["isi survei"] };
    expect(isChanged({ triggerKeywords: ["isi survei", "survei"] }, initial)).toBe(true);
    expect(isChanged({ triggerKeywords: ["isi survei"] }, initial)).toBe(false);
  });

  it("peka pada urutan pertanyaan — memindah urutan dihitung sebagai perubahan", () => {
    const initial = { questions: [{ id: "a" }, { id: "b" }] };
    expect(isChanged({ questions: [{ id: "b" }, { id: "a" }] }, initial)).toBe(true);
  });

  it("mendeteksi pertanyaan yang ditambah atau dihapus", () => {
    const initial = { questions: [{ id: "a", text: "P1" }] };
    expect(isChanged({ questions: [] }, initial)).toBe(true);
    expect(isChanged({ questions: [{ id: "a", text: "P1" }, { id: "b", text: "P2" }] }, initial)).toBe(true);
  });

  it("menghitung isian yang diketik lalu dikembalikan seperti semula sebagai belum berubah", () => {
    const initial = { title: "Survei Nasional" };
    expect(isChanged({ title: "Survei Nasional" }, initial)).toBe(false);
  });
});

describe("needsDiscardConfirm", () => {
  it("tidak meminta konfirmasi bila dirty tidak diisi — modal hanya-baca tetap bisa ditutup", () => {
    expect(needsDiscardConfirm(undefined)).toBe(false);
    expect(needsDiscardConfirm(null)).toBe(false);
  });

  it("menerima boolean langsung", () => {
    expect(needsDiscardConfirm(true)).toBe(true);
    expect(needsDiscardConfirm(false)).toBe(false);
  });

  it("memanggil fungsi saat penutupan diminta, bukan memakai nilai lama", () => {
    let kotor = false;
    const dirty = () => kotor;
    expect(needsDiscardConfirm(dirty)).toBe(false);
    kotor = true;
    expect(needsDiscardConfirm(dirty)).toBe(true);
  });

  it("membaca ulang setiap kali dipanggil sehingga isian yang dibatalkan tidak terus dianggap kotor", () => {
    let nilai = "berubah";
    const dirty = () => nilai !== "";
    expect(needsDiscardConfirm(dirty)).toBe(true);
    nilai = "";
    expect(needsDiscardConfirm(dirty)).toBe(false);
  });
});
