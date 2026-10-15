import { describe, it, expect } from "vitest";
import {
  asesmenDurasi,
  galatAturanDurasi,
  bersihkanKodeWilayah,
  ATURAN_DURASI_BAWAAN,
  type AturanDurasi,
} from "../src/lib/asesmenDurasi.js";
// Kembaran di frontend — dipakai ekspor Excel. Diimpor langsung supaya keduanya diuji
// berdampingan: Sheets dan berkas ekspor tidak boleh memberi label berbeda untuk respons
// yang sama.
import * as frontend from "../../src/lib/exportSurvey.js";
import { surveySchema } from "../src/routes/surveys.js";

const pendek: AturanDurasi = { batas: [{ sampai: 3, label: "Terlalu cepat" }], selebihnya: "Aman" };

describe("asesmenDurasi — aturan milik survei", () => {
  it("'sampai X menit' menyertakan X, selebihnya jatuh ke label terakhir", () => {
    expect(asesmenDurasi(2.9, pendek)).toBe("Terlalu cepat");
    expect(asesmenDurasi(3, pendek)).toBe("Terlalu cepat");
    expect(asesmenDurasi(3.1, pendek)).toBe("Aman");
    expect(asesmenDurasi(240, pendek)).toBe("Aman");
  });

  it("diputuskan dari angka yang DITAMPILKAN (satu desimal), bukan angka mentahnya", () => {
    // 3,04 menit tertulis "3" di kolom Durasi — labelnya harus sama dengan baris lain yang
    // juga tertulis "3", kalau tidak kolom asesmen tidak bisa diaudit dari angkanya.
    expect(asesmenDurasi(3.04, pendek)).toBe("Terlalu cepat");
    expect(asesmenDurasi(3.06, pendek)).toBe("Aman");
  });

  it("aturan kosong atau rusak jatuh ke bawaan, bukan ke label aneh", () => {
    expect(asesmenDurasi(5, null)).toBe("Normal");
    expect(asesmenDurasi(5, { batas: [], selebihnya: "X" })).toBe("Normal");
    expect(asesmenDurasi(5, { batas: [{ sampai: 10, label: "" }], selebihnya: "X" })).toBe("Normal");
  });

  it("durasi tak terhitung tetap kosong", () => {
    expect(asesmenDurasi(null, pendek)).toBe("");
  });
});

describe("galatAturanDurasi", () => {
  it("menerima aturan yang sah", () => {
    expect(galatAturanDurasi(pendek)).toBeNull();
    expect(galatAturanDurasi(ATURAN_DURASI_BAWAAN)).toBeNull();
  });

  it("menolak batas yang tidak makin besar — rentangnya akan tumpang tindih", () => {
    expect(
      galatAturanDurasi({
        batas: [
          { sampai: 10, label: "A" },
          { sampai: 5, label: "B" },
        ],
        selebihnya: "C",
      }),
    ).toMatch(/makin besar/);
  });

  it("menolak label kosong, terlalu panjang, atau yang dibaca Excel sebagai rumus", () => {
    expect(galatAturanDurasi({ batas: [{ sampai: 3, label: " " }], selebihnya: "Aman" })).toMatch(/diisi/);
    expect(galatAturanDurasi({ batas: [{ sampai: 3, label: "x".repeat(41) }], selebihnya: "Aman" })).toMatch(
      /paling panjang/,
    );
    expect(galatAturanDurasi({ batas: [{ sampai: 3, label: "=HYPERLINK()" }], selebihnya: "Aman" })).toMatch(/rumus|=/);
  });

  it("menolak batas nol, negatif, atau kosong", () => {
    expect(galatAturanDurasi({ batas: [{ sampai: 0, label: "A" }], selebihnya: "B" })).toMatch(/lebih dari 0/);
    expect(galatAturanDurasi({ batas: [{ sampai: "", label: "A" }], selebihnya: "B" })).toMatch(/lebih dari 0/);
  });
});

describe("bersihkanKodeWilayah", () => {
  it("membuang kode provinsi dan kabupaten/kota", () => {
    expect(bersihkanKodeWilayah("Jawa Barat (32)")).toBe("Jawa Barat");
    expect(bersihkanKodeWilayah("Papua Pegunungan (95)")).toBe("Papua Pegunungan");
    expect(bersihkanKodeWilayah("Kab. Bandung, Jawa Barat (32.04)")).toBe("Kab. Bandung, Jawa Barat");
  });

  it("tidak menyentuh tanda kurung yang bukan kode wilayah", () => {
    expect(bersihkanKodeWilayah("DKI Jakarta")).toBe("DKI Jakarta");
    expect(bersihkanKodeWilayah("Lainnya (sebutkan)")).toBe("Lainnya (sebutkan)");
    expect(bersihkanKodeWilayah("Anak (2)")).toBe("Anak (2)");
  });
});

describe("Sheets dan ekspor Excel memberi hasil yang SAMA", () => {
  const aturan: (AturanDurasi | null)[] = [
    null,
    pendek,
    {
      batas: [
        { sampai: 1.5, label: "Kilat" },
        { sampai: 4, label: "Cepat" },
        { sampai: 12.5, label: "Wajar" },
      ],
      selebihnya: "Lama",
    },
  ];

  it("untuk setiap durasi 0–40 menit per 0,01 menit", () => {
    for (const a of aturan)
      for (let i = 0; i <= 4000; i++) {
        const m = i / 100;
        expect(frontend.asesmenDurasi(m, a)).toBe(asesmenDurasi(m, a));
      }
  });

  it("aturan bawaan dan validasinya identik", () => {
    expect(frontend.ATURAN_DURASI_BAWAAN).toEqual(ATURAN_DURASI_BAWAAN);
    const contoh = [pendek, { batas: [], selebihnya: "X" }, { batas: [{ sampai: 3, label: "@x" }], selebihnya: "Y" }];
    for (const c of contoh) expect(frontend.galatAturanDurasi(c)).toBe(galatAturanDurasi(c));
  });

  it("pembersih kode wilayah identik", () => {
    for (const v of ["Jawa Barat (32)", "Kab. Bandung, Jawa Barat (32.04)", "Anak (2)", "Lainnya (sebutkan)"])
      expect(frontend.bersihkanKodeWilayah(v)).toBe(bersihkanKodeWilayah(v));
  });
});

describe("validasi simpan survei", () => {
  it("menerima aturan sah dan merapikan spasinya", () => {
    const r = surveySchema.safeParse({
      title: "S",
      aturanDurasi: { batas: [{ sampai: "3", label: " Terlalu cepat " }], selebihnya: " Aman " },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.aturanDurasi).toEqual({
      batas: [{ sampai: 3, label: "Terlalu cepat" }],
      selebihnya: "Aman",
    });
  });

  it("null berarti kembali ke bawaan", () => {
    const r = surveySchema.safeParse({ title: "S", aturanDurasi: null });
    expect(r.success && r.data.aturanDurasi).toBeNull();
  });

  it("menolak aturan yang tidak sah dengan pesan yang bisa dibaca", () => {
    const r = surveySchema.safeParse({ title: "S", aturanDurasi: { batas: [], selebihnya: "Aman" } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(!r.success && r.error.flatten())).toMatch(/paling sedikit satu batas/);
  });
});

describe("perbaikan dari peninjauan", () => {
  it("label diawali '-' ditolak — Excel membaca '-Aman' di CSV sebagai rumus (#NAME?)", () => {
    const a = { batas: [{ sampai: 3, label: "Cepat" }], selebihnya: "-Aman" };
    expect(galatAturanDurasi(a)).toMatch(/-/);
    expect(frontend.galatAturanDurasi(a)).toBe(galatAturanDurasi(a));
  });

  it("spasi ganda dirapikan saat disimpan, supaya Sheets dan Excel menulis label yang sama", () => {
    const r = surveySchema.safeParse({
      title: "S",
      aturanDurasi: { batas: [{ sampai: 3, label: "Terlalu   cepat" }], selebihnya: "Aman  sekali" },
    });
    expect(r.success && r.data.aturanDurasi).toEqual({
      batas: [{ sampai: 3, label: "Terlalu cepat" }],
      selebihnya: "Aman sekali",
    });
  });
});
