import { describe, it, expect } from "vitest";
import { buildContactFacts, samarkanNomor, type SurveyFact } from "../src/lib/aiContext.js";

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

describe("buildContactFacts — ditolak kuota", () => {
  // Kejadian yang dicegah: mesin survei membalas "kuota sudah terpenuhi", lalu Agen AI pada
  // pesan berikutnya mengatakan "jawaban Anda sudah tercatat" — dua cerita bertentangan.
  it("tidak menyebut jawabannya sudah tercatat", () => {
    const t = buildContactFacts([survei({ ditolakKuota: true })]);
    expect(t).toContain("kuota responden sudah terpenuhi");
    expect(t).toContain("JANGAN katakan jawabannya sudah tercatat");
    expect(t).not.toContain("jelaskan bahwa jawabannya SUDAH tercatat");
    expect(t).not.toContain("SUDAH menyelesaikannya");
  });

  it("melarang menyebut wilayah dan angka kuota, sama seperti pesan penolakan", () => {
    const t = buildContactFacts([survei({ ditolakKuota: true })]);
    expect(t).toContain("JANGAN menyebut nama wilayah, provinsi, maupun angka kuota");
  });

  it("tidak menyuruh membalas kata pemicu lagi", () => {
    const t = buildContactFacts([survei({ ditolakKuota: true })]);
    expect(t).toContain("JANGAN menyuruh dia membalas kata pemicu lagi");
    expect(t).not.toContain('membalas "isi survei"');
  });

  it("pernah diterima menang atas pernah ditolak", () => {
    // Ditolak sekali, lalu diterima setelah kuotanya dinaikkan: dia SUDAH mengisi.
    const t = buildContactFacts([survei({ completedByContact: true, ditolakKuota: true })]);
    expect(t).toContain("SUDAH menyelesaikannya");
    expect(t).not.toContain("JANGAN katakan jawabannya sudah tercatat");
  });

  it("survei lain yang belum diisi tetap ditawarkan", () => {
    const t = buildContactFacts([survei({ ditolakKuota: true }), survei({ title: "Survei B" })]);
    expect(t).toContain('"Survei B": pengirim BELUM mengisi');
    expect(t).not.toContain("JANGAN menyuruh dia membalas kata pemicu lagi");
  });
});

describe("samarkanNomor — riwayat ke penyedia AI tanpa nomor telepon", () => {
  it("deret 8+ digit, termasuk yang berselang spasi/titik/strip, jadi [nomor]", () => {
    expect(samarkanNomor("nomor gopay saya 0812 3456 7890 ya")).toBe("nomor gopay saya [nomor] ya");
    expect(samarkanNomor("+62 812-3456-7890")).toBe("[nomor]");
    expect(samarkanNomor("6281234567890")).toBe("[nomor]");
    expect(samarkanNomor("0812.3456.7890 dan 081298765432")).toBe("[nomor] dan [nomor]");
  });

  it("format yang diterima validator nomor HP selalu tersamarkan", () => {
    expect(samarkanNomor("0812 - 3456 - 7890")).toBe("[nomor]");
    expect(samarkanNomor("081.234.567.890")).toBe("[nomor]"); // bentuknya ribuan, tetapi nomor HP
    expect(samarkanNomor("+62 812 3456 7890")).toBe("[nomor]");
  });

  it("angka pendek, tanggal, dan nominal berpemisah ribuan tidak disentuh", () => {
    expect(samarkanNomor("umur 45, pilihan 1,3")).toBe("umur 45, pilihan 1,3");
    expect(samarkanNomor("lahir 17-08-2026")).toBe("lahir 17-08-2026");
    expect(samarkanNomor("pengeluaran Rp 15.000.000")).toBe("pengeluaran Rp 15.000.000");
    expect(samarkanNomor("1234567")).toBe("1234567");
  });
});
