import { describe, it, expect } from "vitest";
import { periksaKuota, sisaKuota, persenKuota } from "../src/lib/kuota.js";
import { provinsiDariAtribut } from "../src/services/kuotaSurvei.js";
import { kodeProvinsiDari } from "../src/lib/wilayah.js";
import { disaringKeluar, saringJawaban, indeksPenyaringan, jalurPertanyaan } from "../src/lib/surveyLogic.js";

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

describe("disaringKeluar", () => {
  // Konfigurasi NYATA dari produksi: pertanyaan persetujuan bertipe boolean, dengan
  // percabangan yang menghentikan survei saat dijawab "Tidak".
  const consent = {
    id: "c1",
    options: { branches: [{ goto: "end", value: "Tidak" }], newScreen: true, screenTitle: "Informed Consent" },
  };
  const biasa = { id: "b1", options: null };
  const lompat = { id: "l1", options: { branches: [{ goto: 5, value: "Ya" }] } };

  it("mengenali penolakan dari percabangan, bukan dari tipe pertanyaan", () => {
    // Pertanyaannya bertipe boolean, bukan consent — aturan berbasis tipe gagal senyap di
    // produksi justru karena ini.
    expect(disaringKeluar([consent], [{ questionId: "c1", value: "Tidak" }])).toBe(true);
    expect(disaringKeluar([consent], [{ questionId: "c1", value: " tidak " }])).toBe(true);
    expect(disaringKeluar([consent], [{ questionId: "c1", value: "TIDAK" }])).toBe(true);
  });

  it("jawaban yang TIDAK memicu penghentian bukan penyaringan", () => {
    expect(disaringKeluar([consent], [{ questionId: "c1", value: "Ya" }])).toBe(false);
  });

  it("percabangan yang MELOMPAT maju bukan penyaringan", () => {
    // goto berupa angka = lewati beberapa pertanyaan; respondennya tetap mengisi survei.
    expect(disaringKeluar([lompat], [{ questionId: "l1", value: "Ya" }])).toBe(false);
  });

  it("pertanyaan tanpa percabangan tidak pernah menyaring", () => {
    expect(disaringKeluar([biasa], [{ questionId: "b1", value: "Tidak" }])).toBe(false);
    expect(disaringKeluar([], [])).toBe(false);
  });

  it("jawaban ke pertanyaan yang tidak dikenal diabaikan", () => {
    expect(disaringKeluar([consent], [{ questionId: "entah", value: "Tidak" }])).toBe(false);
  });

  it("goto -1 diperlakukan sama dengan 'end'", () => {
    const alt = { id: "a1", options: { branches: [{ goto: -1, value: "Tidak" }] } };
    expect(disaringKeluar([alt], [{ questionId: "a1", value: "Tidak" }])).toBe(true);
  });
});

describe("saringJawaban — penegakan di server", () => {
  // Struktur NYATA dari produksi: informed consent di urutan 0, lalu 20 pertanyaan data.
  const questions = [
    { id: "q0", options: { branches: [{ goto: "end", value: "Tidak" }] } },
    { id: "q1", options: null },
    { id: "q2", options: null },
    { id: "q3", options: null },
  ];

  it("membuang SELURUH jawaban setelah penolakan consent di urutan 0", () => {
    // Kejadian nyata: responden menjawab "Tidak" tapi 20 jawaban berikutnya tetap terkirim.
    // Menyimpannya adalah pemrosesan tanpa dasar persetujuan.
    const r = saringJawaban(questions, [
      { questionId: "q0", value: "Tidak" },
      { questionId: "q1", value: "Aji" },
      { questionId: "q2", value: "Jawa Barat" },
      { questionId: "q3", value: "Islam" },
    ]);
    expect(r.batas).toBe(0);
    expect(r.diterima.map((a) => a.questionId)).toEqual(["q0"]);
    expect(r.ditolak.map((a) => a.questionId)).toEqual(["q1", "q2", "q3"]);
  });

  it("mempertahankan jawaban SEBELUM titik penyaringan", () => {
    // Saringan di tengah survei: yang sudah dijawab sebelumnya tetap sah.
    const q = [
      { id: "a", options: null },
      { id: "b", options: null },
      { id: "c", options: { branches: [{ goto: "end", value: "Tidak" }] } },
      { id: "d", options: null },
    ];
    const r = saringJawaban(q, [
      { questionId: "a", value: "x" },
      { questionId: "b", value: "y" },
      { questionId: "c", value: "Tidak" },
      { questionId: "d", value: "z" },
    ]);
    expect(r.batas).toBe(2);
    expect(r.diterima.map((x) => x.questionId)).toEqual(["a", "b", "c"]);
    expect(r.ditolak.map((x) => x.questionId)).toEqual(["d"]);
  });

  it("tidak membuang apa pun bila tak ada penyaringan", () => {
    const r = saringJawaban(questions, [
      { questionId: "q0", value: "Ya" },
      { questionId: "q1", value: "Aji" },
    ]);
    expect(r.batas).toBeNull();
    expect(r.ditolak).toEqual([]);
    expect(r.diterima).toHaveLength(2);
  });

  it("memakai titik penyaringan PALING AWAL bila ada lebih dari satu", () => {
    const q = [
      { id: "a", options: { branches: [{ goto: "end", value: "Tidak" }] } },
      { id: "b", options: null },
      { id: "c", options: { branches: [{ goto: "end", value: "Tidak" }] } },
    ];
    expect(
      indeksPenyaringan(q, [
        { questionId: "c", value: "Tidak" },
        { questionId: "a", value: "Tidak" },
      ]),
    ).toBe(0);
  });

  it("konsisten dengan disaringKeluar", () => {
    const jawab = [{ questionId: "q0", value: "Tidak" }];
    expect(disaringKeluar(questions, jawab)).toBe(true);
    expect(indeksPenyaringan(questions, jawab)).toBe(0);
  });
});

describe("saringJawaban — pertanyaan yang dilompati percabangan maju", () => {
  // Struktur NYATA dari produksi (terlihat di file ekspor): tiap kebijakan ditanya dengan
  // satu gerbang "Apakah Anda tahu…", dan dua pertanyaan lanjutan yang hanya berlaku bila
  // jawabannya "Ya". Menjawab "Tidak" melompat ke gerbang kebijakan BERIKUTNYA.
  const questions = [
    { id: "mbg", options: { branches: [{ goto: 3, value: "Tidak" }] } }, // tahu MBG?
    { id: "mbg_nilai", options: null }, // "Jika Anda tahu… beri nilai"
    { id: "mbg_setuju", options: null }, // "Seberapa setuju…"
    { id: "kop", options: { branches: [{ goto: 6, value: "Tidak" }] } }, // tahu program lain?
    { id: "kop_nilai", options: null },
    { id: "kop_setuju", options: null },
    { id: "penutup", options: null },
  ];

  it("membuang nilai yang terbawa padahal respondennya menjawab tidak tahu", () => {
    // Di Flow, komponen lanjutan memang hilang dari layar — tapi nilainya sudah telanjur
    // masuk ke state formulir sebelum jawaban gerbangnya diubah, dan payload "complete"
    // mendaftar SEMUA field tanpa syarat. Angka itu lalu ikut dianalisis.
    const r = saringJawaban(questions, [
      { questionId: "mbg", value: "Tidak" },
      { questionId: "mbg_nilai", value: "1" },
      { questionId: "kop", value: "Ya" },
      { questionId: "kop_nilai", value: "8" },
      { questionId: "penutup", value: "selesai" },
    ]);
    // Bukan penyaringan keluar: respondennya tetap mengisi survei sampai habis.
    expect(r.batas).toBeNull();
    expect(r.ditolak.map((a) => a.questionId)).toEqual(["mbg_nilai"]);
    expect(r.diterima.map((a) => a.questionId)).toEqual(["mbg", "kop", "kop_nilai", "penutup"]);
  });

  it("blok yang dijawab 'Ya' tidak ikut terbuang", () => {
    const r = saringJawaban(questions, [
      { questionId: "mbg", value: "Ya" },
      { questionId: "mbg_nilai", value: "4" },
      { questionId: "mbg_setuju", value: "Setuju" },
      { questionId: "kop", value: "Ya" },
      { questionId: "kop_nilai", value: "6" },
    ]);
    expect(r.ditolak).toEqual([]);
  });

  it("dua gerbang ditolak sekaligus — kedua blok lanjutannya dibuang", () => {
    const r = saringJawaban(questions, [
      { questionId: "mbg", value: "Tidak" },
      { questionId: "mbg_setuju", value: "Setuju" },
      { questionId: "kop", value: "Tidak" },
      { questionId: "kop_nilai", value: "1" },
      { questionId: "penutup", value: "selesai" },
    ]);
    expect(r.ditolak.map((a) => a.questionId).sort()).toEqual(["kop_nilai", "mbg_setuju"]);
    expect(r.diterima.map((a) => a.questionId)).toEqual(["mbg", "kop", "penutup"]);
  });

  it("gerbang tanpa jawaban tidak melompat apa pun", () => {
    // Pertanyaan opsional yang dikosongkan tidak boleh menghapus blok di belakangnya.
    const r = saringJawaban(questions, [
      { questionId: "mbg_nilai", value: "4" },
      { questionId: "kop_nilai", value: "6" },
    ]);
    expect(r.ditolak).toEqual([]);
  });

  it("goto yang menunjuk mundur atau ke luar daftar diabaikan", () => {
    // Penjaga terhadap aturan percabangan yang usang (pertanyaan pernah diurut ulang):
    // lebih baik tidak melompat sama sekali daripada menghapus jawaban yang sah.
    const q = [
      { id: "a", options: null },
      { id: "b", options: { branches: [{ goto: 0, value: "Tidak" }] } },
      { id: "c", options: { branches: [{ goto: 99, value: "Tidak" }] } },
      { id: "d", options: null },
    ];
    const r = saringJawaban(q, [
      { questionId: "a", value: "x" },
      { questionId: "b", value: "Tidak" },
      { questionId: "c", value: "Tidak" },
      { questionId: "d", value: "z" },
    ]);
    expect(r.ditolak).toEqual([]);
  });

  it("jalurPertanyaan menelusuri sama seperti mesin chat", () => {
    const jawab = [
      { questionId: "mbg", value: "Tidak" },
      { questionId: "kop", value: "Ya" },
    ];
    expect([...jalurPertanyaan(questions, jawab)]).toEqual([0, 3, 4, 5, 6]);
  });

  it("penyaringan keluar tetap mengalahkan lompatan maju", () => {
    // Consent "Tidak" di urutan 0 menghentikan survei: tak ada satu pun pertanyaan setelahnya
    // yang berlaku, termasuk yang punya percabangan sendiri.
    const q = [
      { id: "consent", options: { branches: [{ goto: "end", value: "Tidak" }] } },
      ...questions,
    ];
    const r = saringJawaban(q, [
      { questionId: "consent", value: "Tidak" },
      { questionId: "mbg", value: "Ya" },
      { questionId: "mbg_nilai", value: "9" },
    ]);
    expect(r.batas).toBe(0);
    expect(r.diterima.map((a) => a.questionId)).toEqual(["consent"]);
  });
});
