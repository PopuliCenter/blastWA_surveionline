import { describe, it, expect } from "vitest";
import { periksaKuota, sisaKuota, persenKuota } from "../src/lib/kuota.js";
import { provinsiDariAtribut } from "../src/services/kuotaSurvei.js";
import { kodeProvinsiDari } from "../src/lib/wilayah.js";
import { menolakConsent } from "../src/lib/surveyLogic.js";

const batas = (o: Partial<Parameters<typeof periksaKuota>[0]> = {}) => ({
  targetGlobal: null,
  terisiGlobal: 0,
  targetProvinsi: null,
  terisiProvinsi: 0,
  ...o,
});

describe("periksaKuota", () => {
  it("mengizinkan saat tak ada batas sama sekali", () => {
    expect(periksaKuota(batas())).toEqual({ boleh: true });
    expect(periksaKuota(batas({ terisiGlobal: 99999 }))).toEqual({ boleh: true });
  });

  it("menolak saat kuota global penuh", () => {
    expect(periksaKuota(batas({ targetGlobal: 1200, terisiGlobal: 1200 }))).toEqual({
      boleh: false,
      alasan: "global",
      target: 1200,
      terisi: 1200,
    });
    expect(periksaKuota(batas({ targetGlobal: 1200, terisiGlobal: 1199 }))).toEqual({ boleh: true });
  });

  it("menolak saat kuota provinsi penuh walau global masih longgar", () => {
    const r = periksaKuota(batas({ targetGlobal: 1200, terisiGlobal: 300, targetProvinsi: 200, terisiProvinsi: 200 }));
    expect(r).toEqual({ boleh: false, alasan: "provinsi", target: 200, terisi: 200 });
  });

  it("mendahulukan alasan global — pesan per provinsi membingungkan bila survei sudah tutup", () => {
    const r = periksaKuota(batas({ targetGlobal: 1200, terisiGlobal: 1200, targetProvinsi: 200, terisiProvinsi: 200 }));
    expect(r.boleh).toBe(false);
    if (!r.boleh) expect(r.alasan).toBe("global");
  });

  it("provinsi tanpa kuota tidak pernah menolak", () => {
    // targetProvinsi null = provinsi tak diketahui ATAU memang tak dibatasi.
    expect(periksaKuota(batas({ targetProvinsi: null, terisiProvinsi: 9999 }))).toEqual({ boleh: true });
  });

  it("kelebihan karena pengisian berbarengan tetap menutup kuota", () => {
    expect(periksaKuota(batas({ targetGlobal: 100, terisiGlobal: 103 })).boleh).toBe(false);
  });
});

describe("sisaKuota & persenKuota", () => {
  it("null berarti tanpa batas", () => {
    expect(sisaKuota(null, 50)).toBeNull();
    expect(persenKuota(null, 50)).toBeNull();
    expect(persenKuota(0, 50)).toBeNull();
  });

  it("tidak pernah negatif atau melebihi 100%", () => {
    expect(sisaKuota(100, 130)).toBe(0);
    expect(persenKuota(100, 130)).toBe(100);
    expect(sisaKuota(200, 150)).toBe(50);
    expect(persenKuota(200, 150)).toBe(75);
  });
});

describe("kodeProvinsiDari", () => {
  it("mengenali kode polos, kode kabupaten, dan kode dalam nilai jawaban", () => {
    expect(kodeProvinsiDari("32")).toBe("32");
    expect(kodeProvinsiDari("32.73")).toBe("32");
    expect(kodeProvinsiDari("Kota Bandung, Jawa Barat (32.73)")).toBe("32");
    expect(kodeProvinsiDari("DI Yogyakarta (34)")).toBe("34");
  });

  it("mengenali nama provinsi, termasuk bentuk panjang dan berawalan", () => {
    expect(kodeProvinsiDari("Jawa Barat")).toBe("32");
    expect(kodeProvinsiDari("jawa tengah")).toBe("33");
    expect(kodeProvinsiDari("Provinsi Jawa Timur")).toBe("35");
    expect(kodeProvinsiDari("DKI Jakarta")).toBe("31");
    expect(kodeProvinsiDari("Daerah Khusus Ibukota Jakarta")).toBe("31");
    expect(kodeProvinsiDari("Daerah Khusus Jakarta")).toBe("31"); // nama resmi sejak UU 2/2024
    expect(kodeProvinsiDari("Daerah Istimewa Yogyakarta")).toBe("34");
    expect(kodeProvinsiDari("DIY")).toBe("34");
    expect(kodeProvinsiDari("Provinsi DKI Jakarta")).toBe("31");
    // Bentuk bertitik yang NYATA ada di jawaban lapangan.
    expect(kodeProvinsiDari("D.I Yogyakarta")).toBe("34");
    expect(kodeProvinsiDari("D.K.I Jakarta")).toBe("31");
    expect(kodeProvinsiDari("Prov. Jawa Barat")).toBe("32");
    // Nama tanpa awalan "Kepulauan" yang juga ada di jawaban lapangan.
    expect(kodeProvinsiDari("Bangka Belitung")).toBe("19");
    // Nama pendek yang TIDAK boleh tertukar dengan nama panjang yang memuatnya.
    expect(kodeProvinsiDari("Riau")).toBe("14");
    expect(kodeProvinsiDari("Papua")).toBe("91");
    expect(kodeProvinsiDari("Maluku")).toBe("81");
  });

  it("menolak yang tidak dikenali atau ambigu, bukan menebak", () => {
    // Menebak provinsi akan membuat kuota terhitung ke wilayah yang salah.
    expect(kodeProvinsiDari("Wakanda")).toBeNull();
    expect(kodeProvinsiDari("")).toBeNull();
    expect(kodeProvinsiDari(null)).toBeNull();
    expect(kodeProvinsiDari("99")).toBeNull();
    expect(kodeProvinsiDari("Jawa")).toBeNull(); // cocok ke Barat/Tengah/Timur → ambigu
  });
});

describe("provinsiDariAtribut", () => {
  it("menemukan kolom provinsi apa pun penulisannya", () => {
    expect(provinsiDariAtribut({ Provinsi: "Jawa Barat" })).toBe("32");
    expect(provinsiDariAtribut({ provinsi: "32" })).toBe("32");
    expect(provinsiDariAtribut({ PROVINSI: "DKI Jakarta" })).toBe("31");
    expect(provinsiDariAtribut({ Province: "Jawa Tengah" })).toBe("33");
    expect(provinsiDariAtribut({ Umur: "25", Provinsi: "Bali", Pekerjaan: "PNS" })).toBe("51");
  });

  it("null bila kolomnya tidak ada atau isinya tak dikenali", () => {
    expect(provinsiDariAtribut({ Umur: "25" })).toBeNull();
    expect(provinsiDariAtribut({ Provinsi: "entah" })).toBeNull();
    expect(provinsiDariAtribut(null)).toBeNull();
    expect(provinsiDariAtribut("bukan objek")).toBeNull();
  });
});

describe("menolakConsent", () => {
  const q = [
    { id: "c1", type: "consent" },
    { id: "n1", type: "text" },
    { id: "b1", type: "boolean" },
  ];

  it("mengenali penolakan pada pertanyaan consent", () => {
    expect(menolakConsent(q, [{ questionId: "c1", value: "Tidak" }])).toBe(true);
    expect(menolakConsent(q, [{ questionId: "c1", value: " tidak " }])).toBe(true);
    expect(menolakConsent(q, [{ questionId: "c1", value: "TIDAK" }])).toBe(true);
  });

  it("persetujuan bukan penolakan", () => {
    expect(menolakConsent(q, [{ questionId: "c1", value: "Ya" }])).toBe(false);
  });

  it("jawaban 'Tidak' pada pertanyaan LAIN tidak dianggap menolak consent", () => {
    // Pertanyaan Ya/Tidak biasa ("Apakah Anda pernah memilih?") tidak boleh membatalkan
    // seluruh respons dari hitungan kuota.
    expect(menolakConsent(q, [{ questionId: "b1", value: "Tidak" }])).toBe(false);
    expect(menolakConsent(q, [{ questionId: "n1", value: "Tidak" }])).toBe(false);
  });

  it("survei tanpa pertanyaan consent tidak pernah dianggap menolak", () => {
    expect(menolakConsent([{ id: "n1", type: "text" }], [{ questionId: "n1", value: "Tidak" }])).toBe(false);
    expect(menolakConsent([], [])).toBe(false);
  });

  it("responden yang menjawab consent lalu berhenti tetap terdeteksi", () => {
    // Inilah bentuk nyata 15 respons di produksi: hanya berisi jawaban consent.
    expect(menolakConsent(q, [{ questionId: "c1", value: "Tidak" }])).toBe(true);
  });
});
