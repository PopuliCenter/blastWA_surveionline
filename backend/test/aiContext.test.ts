import { describe, it, expect } from "vitest";
import { buildContactFacts, type SurveyFact } from "../src/lib/aiContext.js";

const survei = (over: Partial<SurveyFact> = {}): SurveyFact => ({
  title: "Survei Nasional Juli 2026",
  triggers: ["isi survei"],
  oncePerContact: true,
  completedByContact: false,
  ...over,
});

describe("buildContactFacts", () => {
  it("menyebut kata pemicu untuk responden yang belum mengisi", () => {
    const t = buildContactFacts([survei()]);
    expect(t).toContain("BELUM mengisi");
    expect(t).toContain('membalas "isi survei"');
  });

  it("menyatakan responden sudah selesai dan terkunci", () => {
    const t = buildContactFacts([survei({ completedByContact: true })]);
    expect(t).toContain("SUDAH menyelesaikannya");
    expect(t).toContain("hanya boleh diisi SEKALI");
  });

  it("melarang menyuruh mengulang kata pemicu bila semua survei sudah selesai", () => {
    // Ini kejadian nyata: AI menyuruh membalas "isi survei" lagi, padahal balasannya
    // hanya penolakan yang sama — responden terjebak berputar.
    const t = buildContactFacts([survei({ completedByContact: true })]);
    expect(t).toContain("JANGAN menyuruh dia membalas kata pemicu lagi");
  });

  it("tidak melarang mengulang bila masih ada survei yang belum diisi", () => {
    const t = buildContactFacts([survei({ completedByContact: true }), survei({ title: "Survei B" })]);
    expect(t).not.toContain("JANGAN menyuruh dia membalas kata pemicu lagi");
    expect(t).toContain("Survei B");
  });

  it("selalu melarang menjanjikan tautan atau undangan terpisah", () => {
    // AI sempat mengarang "tautan yang kami kirimkan jika Anda terpilih sebagai responden".
    const belum = buildContactFacts([survei()]);
    const kosong = buildContactFacts([]);
    expect(belum.toLowerCase()).toContain("tautan");
    expect(kosong.toLowerCase()).toContain("tautan");
  });

  it("menangani keadaan tanpa survei aktif", () => {
    const t = buildContactFacts([]);
    expect(t).toContain("TIDAK ADA survei yang sedang berjalan");
  });

  it("tidak menyebut kata pemicu bila pemicunya dimatikan", () => {
    const t = buildContactFacts([survei({ triggers: [] })]);
    expect(t).toContain("tidak dibuka lewat kata kunci");
  });

  it("tidak menyebut kunci sekali-isi bila survei boleh diulang", () => {
    const t = buildContactFacts([survei({ completedByContact: true, oncePerContact: false })]);
    expect(t).toContain("SUDAH menyelesaikannya");
    expect(t).not.toContain("hanya boleh diisi SEKALI");
  });
});
