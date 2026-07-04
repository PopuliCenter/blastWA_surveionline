import { describe, it, expect } from "vitest";
import { buildResponseRows, exportFilename, INTERNAL_ATTRS } from "./exportSurvey";

const survey = { title: "Survei Ekonomi 2026!", questions: [{ text: "Puas?" }, { text: "Alasan?" }] };
const responses = [
  {
    phone: "628123",
    name: "  Andi  Susanto ",
    attributes: { Kota: "Bandung", Umur: 30, chatResolved: true, notes: "abaikan" },
    answers: [{ question: "Puas?", value: "Ya" }],
  },
  {
    phone: "628999",
    name: "",
    attributes: { Kota: "Jakarta" },
    answers: [
      { question: "Puas?", value: "Tidak" },
      { question: "Alasan?", value: "mahal " },
    ],
  },
];

describe("buildResponseRows", () => {
  const { header, rows } = buildResponseRows(survey, responses);

  it("header: Nomor, Nama, pembobot (urut kemunculan), lalu tiap pertanyaan", () => {
    expect(header).toEqual(["Nomor", "Nama", "Kota", "Umur", "Puas?", "Alasan?"]);
  });
  it("mengecualikan atribut internal chat", () => {
    expect(header).not.toContain("chatResolved");
    expect(header).not.toContain("notes");
    expect([...INTERNAL_ATTRS]).toContain("chatResolved");
  });
  it("baris cocok kolom; spasi dirapikan; sel kosong = ''", () => {
    expect(rows[0]).toEqual(["628123", "Andi Susanto", "Bandung", "30", "Ya", ""]);
    expect(rows[1]).toEqual(["628999", "", "Jakarta", "", "Tidak", "mahal"]);
  });
  it("opts.upper → HURUF KAPITAL", () => {
    const up = buildResponseRows(survey, responses, { upper: true });
    expect(up.rows[0]).toEqual(["628123", "ANDI SUSANTO", "BANDUNG", "30", "YA", ""]);
  });
});

describe("exportFilename", () => {
  it("slug judul + tanggal_jam + ekstensi (date di-inject)", () => {
    const d = new Date(2026, 6, 4, 9, 5); // 2026-07-04 09:05
    expect(exportFilename(survey, "xlsx", d)).toBe("survei-survei-ekonomi-2026-2026-07-04_0905.xlsx");
    expect(exportFilename(survey, "csv", d)).toBe("survei-survei-ekonomi-2026-2026-07-04_0905.csv");
  });
});
