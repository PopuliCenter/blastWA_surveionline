import { describe, it, expect } from "vitest";
import {
  pertanyaanBerlaku,
  langkahBerlaku,
  adaPertanyaanBerlaku,
  saluranPertanyaan,
} from "../src/lib/saluranPertanyaan.js";
import {
  langkahBerikutUntuk,
  jalurPertanyaan,
  validateAnswer,
  formatQuestion,
  type QLite,
} from "../src/lib/surveyLogic.js";
import { nomorHpSurvei } from "../src/lib/phone.js";
import type { NormalizedInbound } from "../src/providers/types.js";

// Pertanyaan yang hanya ditanyakan di satu saluran (Question.options.saluran) — mis. nomor
// e-wallet untuk imbalan, yang hanya perlu ditanyakan ke responden Instagram karena nomor
// responden WhatsApp sudah diketahui.

const q = (id: string, options: any = null, type = "text", required = true): QLite => ({
  id,
  text: `Pertanyaan ${id}?`,
  type,
  required,
  options,
});
const IG = { saluran: "instagram" };
const WA = { saluran: "whatsapp" };

const ev = (text?: string): NormalizedInbound =>
  ({ vendor: "meta", kind: "message", timestamp: "2026-07-01T00:00:00Z", raw: {}, text }) as NormalizedInbound;

describe("pertanyaanBerlaku", () => {
  it("tanpa options.saluran (semua survei lama) → berlaku di kedua saluran", () => {
    for (const opsi of [null, undefined, {}, { choices: ["A"] }, { saluran: "semua" }]) {
      expect(pertanyaanBerlaku(q("a", opsi), "whatsapp")).toBe(true);
      expect(pertanyaanBerlaku(q("a", opsi), "instagram")).toBe(true);
    }
  });

  it("instagram/whatsapp → hanya di saluran itu", () => {
    expect(pertanyaanBerlaku(q("a", IG), "instagram")).toBe(true);
    expect(pertanyaanBerlaku(q("a", IG), "whatsapp")).toBe(false);
    expect(pertanyaanBerlaku(q("a", WA), "whatsapp")).toBe(true);
    expect(pertanyaanBerlaku(q("a", WA), "instagram")).toBe(false);
  });

  it("nilai tak dikenal dibaca 'semua' — lebih baik ditanyakan daripada hilang diam-diam", () => {
    expect(saluranPertanyaan({ saluran: "Instagram" })).toBe("semua");
    expect(saluranPertanyaan({ saluran: 1 })).toBe("semua");
    expect(pertanyaanBerlaku(q("a", { saluran: "ig" }), "whatsapp")).toBe(true);
  });
});

describe("navigasi chatbot yang melewati pertanyaan tak berlaku", () => {
  it("pertanyaan PERTAMA khusus IG → responden WA mulai dari pertanyaan kedua", () => {
    const qs = [q("hp", IG, "phone"), q("b"), q("c")];
    expect(langkahBerlaku(qs, 0, "whatsapp")).toBe(1);
    expect(langkahBerlaku(qs, 0, "instagram")).toBe(0);
  });

  it("pertanyaan di TENGAH khusus IG dilewati responden WA, ditanyakan ke responden IG", () => {
    const qs = [q("a"), q("hp", IG, "phone"), q("c")];
    expect(langkahBerikutUntuk(qs, 0, "x", "whatsapp")).toBe(2);
    expect(langkahBerikutUntuk(qs, 0, "x", "instagram")).toBe(1);
  });

  it("pertanyaan TERAKHIR khusus IG → bagi responden WA survei selesai di pertanyaan sebelumnya", () => {
    const qs = [q("a"), q("b"), q("hp", IG, "phone")];
    expect(langkahBerikutUntuk(qs, 1, "x", "whatsapp")).toBe(qs.length);
    expect(langkahBerikutUntuk(qs, 1, "x", "instagram")).toBe(2);
    // Beberapa pertanyaan tak berlaku berturut-turut di ujung juga berarti selesai.
    const qs2 = [q("a"), q("hp", IG, "phone"), q("ew", IG)];
    expect(langkahBerikutUntuk(qs2, 0, "x", "whatsapp")).toBe(qs2.length);
  });

  it("cabang yang MENDARAT di pertanyaan tak berlaku diteruskan ke pertanyaan berlaku berikutnya", () => {
    const qs = [q("a", { branches: [{ value: "Ya", goto: 2 }] }, "boolean"), q("b"), q("hp", IG, "phone"), q("d")];
    expect(langkahBerikutUntuk(qs, 0, "Ya", "whatsapp")).toBe(3);
    expect(langkahBerikutUntuk(qs, 0, "Ya", "instagram")).toBe(2);
    // Cabang "akhiri" tetap mengakhiri, apa pun salurannya.
    const akhir = [q("a", { branches: [{ value: "Tidak", goto: "end" }] }, "boolean"), q("hp", IG, "phone")];
    expect(langkahBerikutUntuk(akhir, 0, "Tidak", "instagram")).toBe(akhir.length);
  });

  it("pertanyaan khusus WhatsApp dilewati responden Instagram", () => {
    const qs = [q("a"), q("wa", WA), q("c")];
    expect(langkahBerikutUntuk(qs, 0, "x", "instagram")).toBe(2);
    expect(langkahBerikutUntuk(qs, 0, "x", "whatsapp")).toBe(1);
  });

  it("adaPertanyaanBerlaku: survei yang semua pertanyaannya khusus IG tidak bisa dimulai di WA", () => {
    expect(adaPertanyaanBerlaku([q("hp", IG, "phone")], "whatsapp")).toBe(false);
    expect(adaPertanyaanBerlaku([q("hp", IG, "phone")], "instagram")).toBe(true);
    expect(adaPertanyaanBerlaku([], "instagram")).toBe(false);
  });

  it("jalurPertanyaan per saluran: pertanyaan khusus IG bukan bagian jalur responden WA", () => {
    const qs = [q("a"), q("hp", IG, "phone"), q("c")];
    const jawab = [
      { questionId: "a", value: "x" },
      { questionId: "c", value: "y" },
    ];
    expect([...jalurPertanyaan(qs, jawab, "whatsapp")]).toEqual([0, 2]);
    expect([...jalurPertanyaan(qs, jawab, "instagram")]).toEqual([0, 1, 2]);
    // Tanpa saluran: perilaku lama (semua pertanyaan di jalur).
    expect([...jalurPertanyaan(qs, jawab)]).toEqual([0, 1, 2]);
  });
});

describe("tipe phone (nomor HP / e-wallet)", () => {
  const hp = q("hp", IG, "phone");

  it("menerima 08…, 62…, +62… dengan spasi/titik/strip dan menormalkan ke 62…", () => {
    for (const t of ["0812 3456 7890", "081234567890", "+62 812-3456-7890", "62.812.3456.7890", "(0812) 3456-7890"])
      expect(validateAnswer(hp, ev(t))).toEqual({ ok: true, value: "6281234567890" });
  });

  it("menolak yang bukan nomor HP Indonesia yang sah", () => {
    for (const t of [
      "",
      "0812",
      "nomor saya 081234567890",
      "abc",
      "0812345678901234567",
      "+1 555 123 4567",
      "0062812345678",
    ])
      expect(validateAnswer(hp, ev(t))).toEqual({
        ok: false,
        error: "Mohon tulis nomor HP yang valid, mis. 0812 3456 7890.",
      });
  });

  it("nomorHpSurvei: batas 10–15 digit diawali 62", () => {
    expect(nomorHpSurvei("08123456")).toBeNull(); // 9 digit
    expect(nomorHpSurvei("081234567")).toBe("6281234567"); // 10 digit
    expect(nomorHpSurvei("0812345678901")).toBe("62812345678901");
    expect(nomorHpSurvei("08123456789012")).toBe("628123456789012"); // 15 digit
    expect(nomorHpSurvei("081234567890123")).toBeNull(); // 16 digit
  });

  it("formatQuestion memberi petunjuk singkat", () => {
    expect(formatQuestion(hp)).toContain("Tulis nomor HP Anda (mis. 0812");
  });
});
