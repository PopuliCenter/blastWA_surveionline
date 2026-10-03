import { describe, it, expect } from "vitest";
import {
  PROVINSI,
  KAB_KOTA,
  kabKotaDari,
  fieldProvinsi,
  fieldKabKota,
  formatWilayah,
  readWilayahAnswer,
  cariWilayah,
} from "../src/lib/wilayah.js";
import { buildSurveyFlow, parseFlowAnswers, fieldNamesOf, flowSupported, fieldName } from "../src/lib/flowJson.js";
import { validateAnswer, type QLite } from "../src/lib/surveyLogic.js";
import type { NormalizedInbound } from "../src/providers/types.js";

const ev = (text?: string): NormalizedInbound =>
  ({ vendor: "meta", kind: "message", timestamp: "2026-10-03T00:00:00Z", raw: {}, text }) as NormalizedInbound;

const qWilayah: QLite = { id: "w1", text: "Kabupaten/kota domisili?", type: "wilayah", required: true, options: null };

describe("data wilayah Kepmendagri", () => {
  it("jumlahnya cocok dengan angka resmi", () => {
    expect(PROVINSI).toHaveLength(38);
    expect(KAB_KOTA).toHaveLength(514);
    expect(KAB_KOTA.filter((k) => k.nama.startsWith("Kota "))).toHaveLength(98);
    expect(KAB_KOTA.filter((k) => k.nama.startsWith("Kabupaten "))).toHaveLength(416);
  });

  it("tidak ada kode ganda dan setiap kab/kota menunjuk provinsi yang ada", () => {
    expect(new Set(PROVINSI.map((p) => p.kode)).size).toBe(38);
    expect(new Set(KAB_KOTA.map((k) => k.kode)).size).toBe(514);
    const kodeProv = new Set(PROVINSI.map((p) => p.kode));
    for (const k of KAB_KOTA) expect(kodeProv.has(k.kodeProvinsi)).toBe(true);
  });

  it("memakai label pendek yang diminta untuk dua provinsi", () => {
    expect(PROVINSI.find((p) => p.kode === "31")?.nama).toBe("DKI Jakarta");
    expect(PROVINSI.find((p) => p.kode === "34")?.nama).toBe("DI Yogyakarta");
  });

  it("setiap nama memakai awalan yang seragam — tak ada 'Kab ' atau awalan ganda", () => {
    for (const k of KAB_KOTA) {
      expect(k.nama).toMatch(/^(Kabupaten|Kota) /);
      expect(k.nama).not.toMatch(/^(Kabupaten|Kota) (Kabupaten|Kota|Kab) /);
    }
  });

  it("tiap provinsi punya kab/kota, dan jumlahnya muat di satu dropdown Flow", () => {
    for (const p of PROVINSI) {
      const n = kabKotaDari(p.kode).length;
      expect(n).toBeGreaterThan(0);
      // Alasan utama memecah per provinsi: 514 entri dalam satu dropdown tak terpakai.
      expect(n).toBeLessThanOrEqual(50);
    }
    expect(kabKotaDari("35")).toHaveLength(38); // Jawa Timur, yang terbanyak
    expect(kabKotaDari("93")).toHaveLength(4); // Papua Selatan, yang paling sedikit
  });
});

describe("formatWilayah", () => {
  it("menyertakan kode supaya hasil survei bisa dicocokkan ke tabel pembobot", () => {
    expect(formatWilayah("34.04")).toBe("Kabupaten Sleman, DI Yogyakarta (34.04)");
    expect(formatWilayah("32.73")).toBe("Kota Bandung, Jawa Barat (32.73)");
  });

  it("mengembalikan null untuk kode yang tidak ada", () => {
    expect(formatWilayah("99.99")).toBeNull();
  });
});

describe("readWilayahAnswer", () => {
  const base = fieldName("w1");

  it("mengambil kabupaten dari field milik provinsi yang dipilih", () => {
    const resp = {
      [fieldProvinsi(base)]: "34",
      [fieldKabKota(base, "34")]: "34.04",
      [fieldKabKota(base, "32")]: "", // dropdown provinsi lain tak pernah dirender
    };
    expect(readWilayahAnswer(base, resp)).toBe("Kabupaten Sleman, DI Yogyakarta (34.04)");
  });

  it("menyimpan provinsi saja bila kabupaten tak terisi — lebih baik daripada hilang", () => {
    expect(readWilayahAnswer(base, { [fieldProvinsi(base)]: "34" })).toBe("DI Yogyakarta (34)");
  });

  it("null bila provinsi pun tak dipilih", () => {
    expect(readWilayahAnswer(base, {})).toBeNull();
    expect(readWilayahAnswer(base, { [fieldProvinsi(base)]: "" })).toBeNull();
  });
});

describe("cariWilayah — mode chat", () => {
  it("menerima nama lengkap, tanpa awalan, dan beda huruf besar-kecil", () => {
    expect(cariWilayah("Kabupaten Sleman")).toEqual({ ok: true, value: "Kabupaten Sleman, DI Yogyakarta (34.04)" });
    expect(cariWilayah("sleman")).toEqual({ ok: true, value: "Kabupaten Sleman, DI Yogyakarta (34.04)" });
    expect(cariWilayah("  KOTA BANDUNG ")).toEqual({ ok: true, value: "Kota Bandung, Jawa Barat (32.73)" });
  });

  it("menerima kode wilayah langsung", () => {
    expect(cariWilayah("34.04")).toEqual({ ok: true, value: "Kabupaten Sleman, DI Yogyakarta (34.04)" });
  });

  it("menolak dan menawarkan kandidat saat ambigu, bukan menebak", () => {
    // "bandung" cocok dengan Kabupaten Bandung DAN Kota Bandung.
    const r = cariWilayah("bandung");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kandidat.length).toBeGreaterThan(1);
      expect(r.kandidat).toContain("Kabupaten Bandung, Jawa Barat (32.04)");
      expect(r.kandidat).toContain("Kota Bandung, Jawa Barat (32.73)");
    }
  });

  it("menolak yang tidak dikenali tanpa kandidat", () => {
    expect(cariWilayah("Wakanda")).toEqual({ ok: false, kandidat: [] });
    expect(cariWilayah("")).toEqual({ ok: false, kandidat: [] });
  });

  it("tidak menjaring puluhan wilayah dari potongan kata terlalu pendek", () => {
    const r = cariWilayah("ban");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kandidat).toHaveLength(0);
  });
});

describe("validateAnswer tipe wilayah", () => {
  it("menerima nama yang dikenali", () => {
    expect(validateAnswer(qWilayah, ev("Sleman"))).toEqual({
      ok: true,
      value: "Kabupaten Sleman, DI Yogyakarta (34.04)",
    });
  });

  it("menolak pesan kosong dan nama yang tak dikenali", () => {
    expect(validateAnswer(qWilayah, ev("")).ok).toBe(false);
    expect(validateAnswer(qWilayah, ev(undefined)).ok).toBe(false);
    expect(validateAnswer(qWilayah, ev("Wakanda")).ok).toBe(false);
  });

  it("menyebutkan kandidat pada jawaban ambigu", () => {
    const r = validateAnswer(qWilayah, ev("bandung"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Kota Bandung");
  });
});

describe("Flow JSON untuk pertanyaan wilayah", () => {
  const survey = { title: "Survei", questions: [{ id: "w1", text: "Domisili?", type: "wilayah", required: true }] };

  it("didukung Flow dan menghasilkan 39 field", () => {
    expect(flowSupported(survey.questions[0]!)).toBe(true);
    expect(fieldNamesOf(survey.questions[0]!)).toHaveLength(39); // 1 provinsi + 38 kabupaten
  });

  it("membuat dropdown provinsi dan satu dropdown kab/kota per provinsi di dalam If", () => {
    const flow = buildSurveyFlow(survey) as any;
    const kids = flow.screens[0].layout.children[0].children;
    const base = fieldName("w1");

    const prov = kids.find((c: any) => c.type === "Dropdown" && c.name === fieldProvinsi(base));
    expect(prov).toBeTruthy();
    expect(prov["data-source"]).toHaveLength(38);
    expect(prov["data-source"][0]).toEqual({ id: "11", title: "Aceh" });

    const ifs = kids.filter((c: any) => c.type === "If");
    expect(ifs).toHaveLength(38);

    // Komponen di dalam If yang salah tidak dirender, jadi `required` di dalamnya tidak
    // ikut menagih — inilah yang membuat 38 dropdown saling eksklusif ini aman.
    const diy = ifs.find((c: any) => c.condition.includes("'34'"));
    expect(diy.condition).toBe("${form." + fieldProvinsi(base) + "} == '34'");
    expect(diy.then[0].name).toBe(fieldKabKota(base, "34"));
    expect(diy.then[0]["data-source"]).toHaveLength(5);
    expect(diy.then[0].required).toBe(true);
  });

  it("memetakan jawaban Flow balik ke satu nilai", () => {
    const base = fieldName("w1");
    const out = parseFlowAnswers(
      { [fieldProvinsi(base)]: "32", [fieldKabKota(base, "32")]: "32.73" },
      survey.questions,
    );
    expect(out).toEqual([{ questionId: "w1", value: "Kota Bandung, Jawa Barat (32.73)" }]);
  });

  it("tidak memakai penyelamatan by-urutan saat ada pertanyaan wilayah", () => {
    // Satu pertanyaan wilayah memakai 39 field, jadi pencocokan posisi pasti meleset dan
    // akan memasang jawaban ke soal yang salah. Lebih baik kosong daripada salah-pasang.
    const out = parseFlowAnswers({ q_entahapa: "32.73" }, survey.questions);
    expect(out).toEqual([]);
  });
});
