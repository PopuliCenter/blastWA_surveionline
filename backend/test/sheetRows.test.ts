import { describe, it, expect } from "vitest";
import {
  sheetTabName,
  sheetHeader,
  sheetRow,
  sourceLabel,
  fmtJakarta,
  extractSpreadsheetId,
  MAX_TAB_CHARS,
} from "../src/lib/sheetRows.js";

const questions = [
  { id: "q1", text: "Puas dengan pemerintah?" },
  { id: "q2", text: "Alasannya?" },
];

describe("sheetTabName", () => {
  it("membuang karakter terlarang Google dan merapikan spasi", () => {
    expect(sheetTabName("Survei [Nasional]: Juli/Agustus *2026?")).toBe("Survei Nasional Juli Agustus 2026");
  });

  it("membuang kutip tunggal karena mengacaukan notasi A1", () => {
    expect(sheetTabName("Survei D'Populi")).toBe("Survei D Populi");
  });

  it("memotong ke batas 100 karakter", () => {
    expect(sheetTabName("x".repeat(150)).length).toBe(MAX_TAB_CHARS);
  });

  it("judul kosong atau tinggal karakter terlarang → nama cadangan", () => {
    expect(sheetTabName("")).toBe("Survei");
    expect(sheetTabName("***")).toBe("Survei");
  });
});

describe("fmtJakarta", () => {
  it("mengubah UTC ke WIB (+7) dengan format terurut", () => {
    // 2026-07-31 17:30 UTC = 2026-08-01 00:30 WIB — sekalian menguji ganti hari.
    expect(fmtJakarta(new Date("2026-07-31T17:30:00Z"))).toBe("2026-08-01 00:30");
    expect(fmtJakarta(new Date("2026-07-31T02:05:00Z"))).toBe("2026-07-31 09:05");
  });

  it("tanggal kosong → string kosong", () => {
    expect(fmtJakarta(null)).toBe("");
    expect(fmtJakarta(undefined)).toBe("");
  });
});

describe("sheetHeader & sheetRow", () => {
  it("header: kolom tetap lalu tiap pertanyaan", () => {
    expect(sheetHeader(questions)).toEqual([
      "Nomor",
      "Nama",
      "Sumber Kontak",
      "Mulai",
      "Selesai",
      "Puas dengan pemerintah?",
      "Alasannya?",
    ]);
  });

  it("baris sejajar dengan header; jawaban dipetakan lewat questionId", () => {
    const row = sheetRow({
      phone: "628123",
      name: "Ani",
      consentSource: "import",
      startedAt: new Date("2026-07-31T02:00:00Z"),
      completedAt: new Date("2026-07-31T02:05:00Z"),
      questions,
      // Urutan jawaban sengaja dibalik — pemetaan harus lewat id, bukan posisi.
      answers: [
        { questionId: "q2", value: "Ekonomi membaik" },
        { questionId: "q1", value: "Puas" },
      ],
    });
    expect(row).toEqual(["628123", "Ani", "Impor", "2026-07-31 09:00", "2026-07-31 09:05", "Puas", "Ekonomi membaik"]);
    expect(row.length).toBe(sheetHeader(questions).length);
  });

  it("pertanyaan tak terjawab → sel kosong, bukan bergeser", () => {
    const row = sheetRow({
      phone: "628999",
      name: null,
      consentSource: null,
      startedAt: new Date("2026-07-31T02:00:00Z"),
      completedAt: null,
      questions,
      answers: [{ questionId: "q2", value: "Saja" }],
    });
    expect(row).toEqual(["628999", "", "(tidak diketahui)", "2026-07-31 09:00", "", "", "Saja"]);
  });
});

describe("sourceLabel", () => {
  it("label sama persis dengan ekspor Excel", () => {
    expect(sourceLabel("import")).toBe("Impor");
    expect(sourceLabel("inbound")).toBe("Pesan masuk");
    expect(sourceLabel(null)).toBe("(tidak diketahui)");
    expect(sourceLabel("api")).toBe("api"); // sumber baru harus terlihat, bukan disembunyikan
  });
});

describe("extractSpreadsheetId", () => {
  it("mengambil ID dari URL lengkap", () => {
    expect(extractSpreadsheetId("https://docs.google.com/spreadsheets/d/1AbC_d-EF9/edit#gid=0")).toBe("1AbC_d-EF9");
  });
  it("ID telanjang atau berspasi diteruskan bersih", () => {
    expect(extractSpreadsheetId("  1AbC_d-EF9  ")).toBe("1AbC_d-EF9");
  });
});
