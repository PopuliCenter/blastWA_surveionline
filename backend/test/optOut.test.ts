import { describe, it, expect } from "vitest";
import {
  isOptOutExact,
  isOptOutMessage,
  isOptInExact,
  isOptInMessage,
  normalizeMessage,
  MAX_OPT_OUT_WORDS,
} from "../src/lib/optOut.js";

describe("isOptOutExact — dipakai saat responden SEDANG mengisi survei", () => {
  it("menerima perintah tunggal apa adanya", () => {
    for (const t of ["stop", "STOP", "Berhenti", "unsubscribe", "unsub", "cabut", "hapus saya"]) {
      expect(isOptOutExact(t), t).toBe(true);
    }
  });

  it("menerima perintah yang dibubuhi tanda baca atau emoji", () => {
    for (const t of ["STOP.", "berhenti!", "  BERHENTI  ", "stop 🙏"]) {
      expect(isOptOutExact(t), t).toBe(true);
    }
  });

  it("MENOLAK jawaban survei pendek yang memuat kata berhenti", () => {
    // Ini perlindungan utamanya. Di survei kebijakan publik, "cabut saja" adalah
    // JAWABAN, bukan permintaan berhenti — responden tidak boleh terlempar keluar
    // di tengah pengisian.
    for (const t of ["cabut saja", "berhenti dulu", "stop subsidi", "harus berhenti", "cabut subsidi bbm"]) {
      expect(isOptOutExact(t), t).toBe(false);
    }
  });
});

describe("isOptOutMessage — dipakai saat responden TIDAK sedang mengisi survei", () => {
  it("menerima frasa pendek yang lazim dipakai orang", () => {
    for (const t of ["berhenti ya", "saya mau berhenti", "tolong stop", "stop dong", "mohon berhenti"]) {
      expect(isOptOutMessage(t), t).toBe(true);
    }
  });

  it("menolak kalimat panjang yang kebetulan memuat kata berhenti", () => {
    const panjang = [
      "menurut saya pemerintah harus berhenti menaikkan harga bahan bakar",
      "saya ingin pemerintah berhenti melakukan pemborosan anggaran negara",
    ];
    for (const t of panjang) expect(isOptOutMessage(t), t).toBe(false);
  });

  it("menolak potongan kata, bukan kata utuh", () => {
    for (const t of ["pemberhentian", "diberhentikan", "nonstop", "stopwatch"]) {
      expect(isOptOutMessage(t), t).toBe(false);
    }
  });

  it("menolak pesan kosong dan sapaan biasa", () => {
    for (const t of ["", "   ", "🙏", "halo", "isi survei", "ya", "5"]) {
      expect(isOptOutMessage(t), t).toBe(false);
    }
  });

  it(`menerima tepat ${MAX_OPT_OUT_WORDS} kata tapi menolak yang lebih panjang`, () => {
    expect(isOptOutMessage("tolong saya mau berhenti")).toBe(true);
    expect(isOptOutMessage("tolong ya saya mau berhenti")).toBe(false);
  });
});

describe("opt-in", () => {
  it("mengenali perintah berlangganan kembali", () => {
    for (const t of ["mulai", "MULAI", "mulai!", "subscribe", "daftar"]) {
      expect(isOptInExact(t), t).toBe(true);
    }
    expect(isOptInMessage("saya mau mulai")).toBe(true);
  });

  it("tidak menganggap pemicu survei sebagai opt-in", () => {
    // "isi survei" harus jatuh ke pemicu survei, bukan dianggap berlangganan.
    expect(isOptInExact("isi survei")).toBe(false);
    expect(isOptInMessage("isi survei")).toBe(false);
  });

  it("menolak kalimat panjang", () => {
    expect(isOptInMessage("saya ingin mendaftar sebagai relawan pemantau pemilu")).toBe(false);
  });
});

describe("normalizeMessage", () => {
  it("merapikan huruf besar, tanda baca, dan spasi berlebih", () => {
    expect(normalizeMessage("  BERHENTI,,,  ya!! ")).toBe("berhenti ya");
  });

  it("menghasilkan string kosong untuk pesan tanpa huruf/angka", () => {
    expect(normalizeMessage("!!! 🙏 ???")).toBe("");
  });
});
