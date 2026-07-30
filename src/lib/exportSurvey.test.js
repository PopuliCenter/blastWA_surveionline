import { describe, it, expect } from "vitest";
import { buildResponseRows, contactSourceLabel, exportFilename, INTERNAL_ATTRS } from "./exportSurvey";

const survey = { title: "Survei Ekonomi 2026!", questions: [{ text: "Puas?" }, { text: "Alasan?" }] };
const responses = [
  {
    phone: "628123",
    name: "  Andi  Susanto ",
    consentSource: "import",
    attributes: { Kota: "Bandung", Umur: 30, chatResolved: true, notes: "abaikan" },
    answers: [{ question: "Puas?", value: "Ya" }],
  },
  {
    phone: "628999",
    name: "",
    consentSource: "inbound",
    attributes: { Kota: "Jakarta" },
    answers: [
      { question: "Puas?", value: "Tidak" },
      { question: "Alasan?", value: "mahal " },
    ],
  },
];

describe("buildResponseRows", () => {
  const { header, rows } = buildResponseRows(survey, responses);

  it("header: Nomor, Nama, Sumber Kontak, pembobot (urut kemunculan), lalu tiap pertanyaan", () => {
    expect(header).toEqual(["Nomor", "Nama", "Sumber Kontak", "Kota", "Umur", "Puas?", "Alasan?"]);
  });
  it("mengecualikan atribut internal chat", () => {
    expect(header).not.toContain("chatResolved");
    expect(header).not.toContain("notes");
    expect([...INTERNAL_ATTRS]).toContain("chatResolved");
  });
  it("baris cocok kolom; spasi dirapikan; sel kosong = ''", () => {
    expect(rows[0]).toEqual(["628123", "Andi Susanto", "Impor", "Bandung", "30", "Ya", ""]);
    expect(rows[1]).toEqual(["628999", "", "Pesan masuk", "Jakarta", "", "Tidak", "mahal"]);
  });
  it("opts.upper → HURUF KAPITAL", () => {
    const up = buildResponseRows(survey, responses, { upper: true });
    expect(up.rows[0]).toEqual(["628123", "ANDI SUSANTO", "IMPOR", "BANDUNG", "30", "YA", ""]);
  });
  it("responden tanpa consentSource tetap punya sel terisi", () => {
    // Kontak lama sebelum consentSource dipakai. Sel kosong di kolom ini akan terbaca
    // sebagai data hilang; "(tidak diketahui)" menyatakan keadaannya dengan jujur.
    // Tanpa atribut → tak ada kolom pembobot, jadi tinggal 2 kolom pertanyaan yang kosong.
    const { rows: r } = buildResponseRows(survey, [{ phone: "628777", name: "Budi", answers: [] }]);
    expect(r[0]).toEqual(["628777", "Budi", "(tidak diketahui)", "", ""]);
  });
});

describe("contactSourceLabel", () => {
  it("menerjemahkan nilai yang dikenal", () => {
    expect(contactSourceLabel("import")).toBe("Impor");
    expect(contactSourceLabel("manual")).toBe("Manual");
    expect(contactSourceLabel("inbound")).toBe("Pesan masuk");
    expect(contactSourceLabel("form")).toBe("Formulir");
  });
  it("kosong atau bukan string → (tidak diketahui)", () => {
    expect(contactSourceLabel(null)).toBe("(tidak diketahui)");
    expect(contactSourceLabel(undefined)).toBe("(tidak diketahui)");
    expect(contactSourceLabel("")).toBe("(tidak diketahui)");
    expect(contactSourceLabel("   ")).toBe("(tidak diketahui)");
    expect(contactSourceLabel(42)).toBe("(tidak diketahui)");
  });
  it("sumber baru yang belum berlabel diteruskan apa adanya, bukan disembunyikan", () => {
    expect(contactSourceLabel("api")).toBe("api");
  });
});

describe("exportFilename", () => {
  it("slug judul + tanggal_jam + ekstensi (date di-inject)", () => {
    const d = new Date(2026, 6, 4, 9, 5); // 2026-07-04 09:05
    expect(exportFilename(survey, "xlsx", d)).toBe("survei-survei-ekonomi-2026-2026-07-04_0905.xlsx");
    expect(exportFilename(survey, "csv", d)).toBe("survei-survei-ekonomi-2026-2026-07-04_0905.csv");
  });
});
