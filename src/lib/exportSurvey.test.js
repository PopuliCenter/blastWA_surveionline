import { describe, it, expect } from "vitest";
import {
  buildResponseRows,
  contactSourceLabel,
  exportFilename,
  INTERNAL_ATTRS,
  durasiMenit,
  asesmenDurasi,
} from "./exportSurvey";

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
    expect(header).toEqual([
      "Nomor",
      "Nama",
      "Sumber Kontak",
      "Durasi (menit)",
      "Asesmen Durasi",
      "Kota",
      "Umur",
      "Puas?",
      "Alasan?",
    ]);
  });
  it("mengecualikan atribut internal chat", () => {
    expect(header).not.toContain("chatResolved");
    expect(header).not.toContain("notes");
    expect([...INTERNAL_ATTRS]).toContain("chatResolved");
  });
  it("baris cocok kolom; spasi dirapikan; sel kosong = ''", () => {
    // Durasi kosong: contoh ini tanpa stempel waktu, dan yang tak terhitung tidak dinilai.
    expect(rows[0]).toEqual(["628123", "Andi Susanto", "Impor", "", "", "Bandung", "30", "Ya", ""]);
    expect(rows[1]).toEqual(["628999", "", "Pesan masuk", "", "", "Jakarta", "", "Tidak", "mahal"]);
  });
  it("opts.upper → HURUF KAPITAL", () => {
    const up = buildResponseRows(survey, responses, { upper: true });
    expect(up.rows[0]).toEqual(["628123", "ANDI SUSANTO", "IMPOR", "", "", "BANDUNG", "30", "YA", ""]);
  });
  it("responden tanpa consentSource tetap punya sel terisi", () => {
    // Kontak lama sebelum consentSource dipakai. Sel kosong di kolom ini akan terbaca
    // sebagai data hilang; "(tidak diketahui)" menyatakan keadaannya dengan jujur.
    // Tanpa atribut → tak ada kolom pembobot, jadi tinggal 2 kolom pertanyaan yang kosong.
    const { rows: r } = buildResponseRows(survey, [{ phone: "628777", name: "Budi", answers: [] }]);
    expect(r[0]).toEqual(["628777", "Budi", "(tidak diketahui)", "", "", "", ""]);
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

describe("asesmen durasi pengisian", () => {
  const resp = (menit, lain = {}) => ({
    phone: "628123",
    name: "A",
    consentSource: "import",
    attributes: {},
    answers: [],
    startedAt: "2026-10-06T00:00:00.000Z",
    completedAt: new Date(Date.parse("2026-10-06T00:00:00.000Z") + menit * 60000).toISOString(),
    ...lain,
  });

  it("menghitung menit dari selisih mulai dan selesai", () => {
    expect(durasiMenit(resp(4.5))).toBe(4.5);
    expect(durasiMenit(resp(0))).toBe(0);
  });

  it("memberi label sesuai ambang, termasuk tepat di batasnya", () => {
    expect(asesmenDurasi(0.5)).toBe("Terlalu cepat");
    expect(asesmenDurasi(1.99)).toBe("Terlalu cepat");
    expect(asesmenDurasi(2)).toBe("Normal");
    expect(asesmenDurasi(10)).toBe("Normal");
    expect(asesmenDurasi(10.1)).toBe("Lambat");
    expect(asesmenDurasi(30)).toBe("Lambat");
    expect(asesmenDurasi(30.1)).toBe("Terlalu lama");
    expect(asesmenDurasi(600)).toBe("Terlalu lama");
  });

  it("menutup celah 2-3 menit yang tidak disebut di rentang aslinya", () => {
    // Rentang yang diminta melompat dari "<2" ke "3-10". Lubangnya masuk Normal, bukan
    // Terlalu cepat: menaikkan batas curiga berarti menuduh lebih banyak responden.
    expect(asesmenDurasi(2.5)).toBe("Normal");
  });

  it("respons belum selesai tidak dinilai, bukan dinilai 'terlalu cepat'", () => {
    // Menebak di sini akan mencemari justru kolom yang dibuat untuk membersihkan data.
    expect(durasiMenit(resp(5, { completedAt: null }))).toBeNull();
    expect(asesmenDurasi(null)).toBe("");
  });

  it("stempel waktu terbalik diperlakukan sebagai tak terhitung", () => {
    const r = resp(5, { startedAt: "2026-10-06T01:00:00.000Z", completedAt: "2026-10-06T00:00:00.000Z" });
    expect(durasiMenit(r)).toBeNull();
  });

  it("kolomnya muncul di tabel ekspor dengan angka yang bisa dihitung", () => {
    const survey = { title: "S", questions: [{ text: "Q1" }] };
    const { header, rows } = buildResponseRows(survey, [resp(4.26), resp(45), resp(1)]);
    expect(header.slice(0, 5)).toEqual(["Nomor", "Nama", "Sumber Kontak", "Durasi (menit)", "Asesmen Durasi"]);
    expect(rows[0][3]).toBe(4.3); // angka, bukan teks — bisa disortir & dirata-ratakan
    expect(rows[0][4]).toBe("Normal");
    expect(rows[1][4]).toBe("Terlalu lama");
    expect(rows[2][4]).toBe("Terlalu cepat");
  });
});
