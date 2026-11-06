import { describe, it, expect } from "vitest";
import {
  sheetTabName,
  sheetHeader,
  sheetRow,
  sourceLabel,
  fmtJakarta,
  extractSpreadsheetId,
  MAX_TAB_CHARS,
  durasiMenit,
  asesmenDurasi,
  durasiDariSheet,
  parseWaktuSheet,
  susunBarisSheet,
  cariBarisRespons,
  JUDUL_ASAL,
  JUDUL_LOKASI,
  JUDUL_USERNAME_IG,
  TRAILING_HEADER,
} from "../src/lib/sheetRows.js";
import { judulYangKurang, kolomA1 } from "../src/services/sheetPush.js";

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
      // Di AKHIR, bukan di samping Mulai/Selesai: header tab yang sudah berisi data tidak
      // pernah ditimpa, jadi menyisipkan di tengah akan menggeser setiap baris baru.
      "Durasi (menit)",
      "Asesmen Durasi",
      "Lama Pengisian",
      "Saluran",
      "Jalur Masuk",
      "Metode",
      "ID Iklan",
      "Username IG",
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
    expect(row).toEqual([
      "628123",
      "Ani",
      "Impor",
      "2026-07-31 09:00",
      "2026-07-31 09:05",
      "Puas",
      "Ekonomi membaik",
      5,
      "Normal",
      "5 menit",
      "",
      "",
      "",
      "",
      "",
    ]);
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
    // Belum selesai → durasi, asesmen, dan lama pengisiannya kosong, bukan ditebak.
    expect(row.slice(0, 10)).toEqual([
      "628999",
      "",
      "(tidak diketahui)",
      "2026-07-31 09:00",
      "",
      "",
      "Saja",
      "",
      "",
      "",
    ]);
  });
});

describe("sourceLabel", () => {
  it("label sama persis dengan ekspor Excel", () => {
    expect(sourceLabel("import")).toBe("Impor");
    expect(sourceLabel("inbound")).toBe("Pesan masuk");
    expect(sourceLabel("instagram")).toBe("Instagram");
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

describe("asesmen durasi (Sheets)", () => {
  it("aturan bawaan: sampai 2 / 10 / 30 menit, selebihnya terlalu lama", () => {
    // Kesamaan dengan ekspor Excel diuji langsung di asesmenDurasi.test.ts.
    expect(asesmenDurasi(1.99)).toBe("Terlalu cepat");
    expect(asesmenDurasi(2)).toBe("Terlalu cepat"); // "sampai 2 menit" — 2 masih termasuk
    expect(asesmenDurasi(2.1)).toBe("Normal");
    expect(asesmenDurasi(10)).toBe("Normal");
    expect(asesmenDurasi(10.1)).toBe("Lambat");
    expect(asesmenDurasi(30)).toBe("Lambat");
    expect(asesmenDurasi(30.1)).toBe("Terlalu lama");
    expect(asesmenDurasi(2.5)).toBe("Normal"); // celah 2-3 menit
  });

  it("sheetRow memakai aturan survei dan membuang kode wilayah", () => {
    const row = sheetRow({
      phone: "6281",
      name: "Budi",
      consentSource: "inbound",
      startedAt: new Date("2026-10-15T02:00:00Z"),
      completedAt: new Date("2026-10-15T02:02:30Z"),
      questions: [
        { id: "p", text: "Provinsi?", type: "wilayah" },
        { id: "t", text: "Jumlah anak?", type: "text" },
      ],
      answers: [
        { questionId: "p", value: "Jawa Barat (32)" },
        // Bukan pertanyaan Wilayah — angka dalam kurungnya jawaban, bukan kode.
        { questionId: "t", value: "Dua (2)" },
      ],
      aturanDurasi: { batas: [{ sampai: 3, label: "Terlalu cepat" }], selebihnya: "Aman" },
    });
    expect(row.slice(5, 10)).toEqual(["Jawa Barat", "Dua (2)", 2.5, "Terlalu cepat", "2 menit 30 detik"]);
  });

  it("yang tak terhitung tidak dinilai", () => {
    const t = new Date("2026-07-31T02:00:00Z");
    expect(durasiMenit(t, null)).toBeNull();
    expect(durasiMenit(null, t)).toBeNull();
    expect(durasiMenit(new Date("2026-07-31T03:00:00Z"), t)).toBeNull(); // terbalik
    expect(asesmenDurasi(null)).toBe("");
  });
});

describe("judul kolom yang kurang", () => {
  it("menambah hanya di kanan saat header lama memang awalan dari yang baru", () => {
    expect(judulYangKurang(["A", "B"], ["A", "B", "C", "D"])).toEqual({ mulai: 2, nilai: ["C", "D"] });
  });

  it("TIDAK menyentuh apa pun saat bentuk tabnya sudah berbeda", () => {
    // Pertanyaan diubah atau kolom disusun ulang tim. Menulis judul baru di atasnya akan
    // memberi nama salah pada data lama — kolom tanpa judul jauh lebih tidak berbahaya.
    expect(judulYangKurang(["A", "X"], ["A", "B", "C"])).toBeNull();
    expect(judulYangKurang(["A", "B", "C"], ["A", "B", "C"])).toBeNull();
    expect(judulYangKurang(["A", "B", "C", "D"], ["A", "B", "C"])).toBeNull();
    expect(judulYangKurang([], ["A", "B"])).toBeNull();
  });

  describe("kolom sesudah Lama Pengisian ditaruh menurut judul", () => {
    const BUNTUT = ["Durasi (menit)", "Asesmen Durasi", "Lama Pengisian"];
    const ASAL = ["Saluran", "Jalur Masuk", "Metode", "ID Iklan"];
    const LOKASI = ["Provinsi Lokasi", "Status Lokasi"];
    const AWAL = ["Nomor", "Q1", ...BUNTUT];

    it("tab yang sudah punya asal tetap mendapat judul lokasi saat survei mulai memintanya", () => {
      const ada = [...AWAL, ...ASAL];
      expect(judulYangKurang(ada, [...AWAL, ...LOKASI, ...ASAL])).toEqual({ mulai: ada.length, nilai: LOKASI });
    });

    it("kolom tim atau lokasi lama di kanan Lama Pengisian tidak menghalangi judul asal", () => {
      const ada = [...AWAL, "Catatan QC", ...LOKASI];
      expect(judulYangKurang(ada, [...AWAL, ...ASAL])).toEqual({ mulai: ada.length, nilai: ASAL });
    });

    it("pertanyaan yang sudah diubah pun tetap mendapat judulnya, di ujung kanan", () => {
      const ada = ["Nomor", "Q1 versi lama", ...BUNTUT];
      expect(judulYangKurang(ada, [...AWAL, ...ASAL])).toEqual({ mulai: ada.length, nilai: ASAL });
    });

    it("pertanyaan yang kebetulan berjudul Saluran tidak dianggap kolom asal", () => {
      const ada = ["Nomor", "Saluran", ...BUNTUT];
      expect(judulYangKurang(ada, ["Nomor", "Saluran", ...BUNTUT, "Saluran", "Metode"])).toEqual({
        mulai: ada.length,
        nilai: ["Saluran", "Metode"],
      });
    });

    it("yang judulnya sudah lengkap tidak ditulis lagi, apa pun urutannya", () => {
      expect(judulYangKurang([...AWAL, ...ASAL, ...LOKASI], [...AWAL, ...LOKASI, ...ASAL])).toBeNull();
    });
  });

  it("kolom A1 benar melewati Z — survei 27 pertanyaan melampauinya", () => {
    expect(kolomA1(0)).toBe("A");
    expect(kolomA1(25)).toBe("Z");
    expect(kolomA1(26)).toBe("AA");
    expect(kolomA1(27)).toBe("AB");
    expect(kolomA1(51)).toBe("AZ");
    expect(kolomA1(52)).toBe("BA");
  });
});

describe("durasi dari kolom spreadsheet", () => {
  it("menghitung selisih dari format yang ditulis fmtJakarta", () => {
    expect(durasiDariSheet("2026-10-01 11:35", "2026-10-01 11:49")).toBe(14);
    expect(durasiDariSheet("2026-10-01 23:55", "2026-10-02 00:10")).toBe(15);
  });

  it("cocok dengan yang dihitung dari objek Date", () => {
    // Kolomnya ditulis fmtJakarta, jadi membacanya kembali harus menghasilkan menit yang
    // sama — kalau tidak, baris lama dan baris baru akan dinilai dengan ukuran berbeda.
    const a = new Date("2026-10-01T04:35:00Z"); // 11:35 Jakarta
    const b = new Date("2026-10-01T04:49:00Z"); // 11:49 Jakarta
    expect(durasiDariSheet(fmtJakarta(a), fmtJakarta(b))).toBe(durasiMenit(a, b));
  });

  it("sel kosong, rusak, atau terbalik tidak dinilai", () => {
    expect(durasiDariSheet("", "2026-10-01 11:49")).toBeNull();
    expect(durasiDariSheet("2026-10-01 11:35", "")).toBeNull();
    expect(durasiDariSheet("bukan tanggal", "2026-10-01 11:49")).toBeNull();
    expect(durasiDariSheet("2026-10-01 12:00", "2026-10-01 11:00")).toBeNull();
  });

  it("menit pecahan dipertahankan agar asesmennya sama dengan jalur normal", () => {
    expect(parseWaktuSheet("2026-10-01 11:35")).toBe(Date.UTC(2026, 9, 1, 11, 35));
    expect(asesmenDurasi(durasiDariSheet("2026-10-01 11:35", "2026-10-01 11:36"))).toBe("Terlalu cepat");
    expect(asesmenDurasi(durasiDariSheet("2026-10-01 11:35", "2026-10-01 11:40"))).toBe("Normal");
  });
});

describe("kolom Lama Pengisian (Sheets)", () => {
  it("dibaca dari angka Durasi yang sama: 1,9 → 1 menit 54 detik, walau aslinya 1 menit 53 detik", () => {
    const row = sheetRow({
      phone: "6281",
      name: "Budi",
      consentSource: "inbound",
      startedAt: new Date("2026-10-15T02:00:00Z"),
      completedAt: new Date("2026-10-15T02:01:53Z"),
      questions: [],
      answers: [],
    });
    expect(row.slice(-8, -5)).toEqual([1.9, "Terlalu cepat", "1 menit 54 detik"]);
  });
});

describe("susunBarisSheet — kolom buntut ditaruh menurut judulnya", () => {
  const qs = [{ id: "u", text: "Umur?" }];
  const judul = sheetHeader(qs); // ... Umur?, Durasi (menit), Asesmen Durasi, Lama Pengisian
  const nilai = [
    "6281",
    "Budi",
    "Pesan masuk",
    "2026-10-15 09:00",
    "2026-10-15 09:02",
    "30",
    1.9,
    "Terlalu cepat",
    "1 menit 54 detik",
    "WhatsApp",
    "Kata pemicu",
    "Form",
    "",
    "@budi.ig",
  ];
  const awal = ["Nomor", "Nama", "Sumber Kontak", "Mulai", "Selesai", "Umur?"];

  it("tab buatan worker: sama persis dengan urutan", () => {
    expect(susunBarisSheet(judul, judul, nilai)).toEqual(nilai);
  });

  it("kolom milik tim di kanan Asesmen TIDAK diisi data otomatis", () => {
    // Tab lama + kolom "Catatan QC" buatan tim. Menurut urutan, "1 menit 54 detik" akan
    // mendarat di Catatan QC pada setiap baris baru — tanpa galat apa pun.
    const aktual = [...awal, "Durasi (menit)", "Asesmen Durasi", "Catatan QC"];
    const baris = susunBarisSheet(judul, aktual, nilai);
    expect(baris).toEqual(nilai.slice(0, 8));
    expect(baris[aktual.indexOf("Catatan QC")]).toBeUndefined();
  });

  it("kolom yang judulnya ditambahkan skrip lebih ke kanan diisi di tempatnya", () => {
    const aktual = [...awal, "Durasi (menit)", "Asesmen Durasi", "Catatan QC", "Lama Pengisian"];
    const baris = susunBarisSheet(judul, aktual, nilai);
    expect(baris[8]).toBe(""); // Catatan QC dibiarkan kosong di baris baru
    expect(baris[9]).toBe("1 menit 54 detik");
  });

  it("tab tanpa judul sama sekali tetap menurut urutan", () => {
    expect(susunBarisSheet(judul, [], nilai)).toEqual(nilai);
  });
});

describe("kolom lokasi (Sheets)", () => {
  // Kolom sesudah Lama Pengisian pada survei tanpa lokasi: asal + Username IG. Dipotong
  // untuk meniru tab dari sebelum kolom-kolom itu ada.
  const SESUDAH_LAMA = JUDUL_ASAL.length + 1;
  const dasar = {
    phone: "6281",
    name: "Ani",
    consentSource: null,
    startedAt: new Date("2026-10-01T03:00:00Z"),
    completedAt: new Date("2026-10-01T03:05:00Z"),
    questions,
    answers: [],
  };

  it("paling belakang, setelah asesmen waktu — hanya bila diminta", () => {
    expect(sheetHeader(questions).slice(-8)).toEqual([...TRAILING_HEADER, ...JUDUL_ASAL, JUDUL_USERNAME_IG]);
    expect(sheetHeader(questions, { lokasi: true }).slice(-10)).toEqual([
      ...TRAILING_HEADER,
      ...JUDUL_LOKASI,
      ...JUDUL_ASAL,
      JUDUL_USERNAME_IG,
    ]);
    const baris = sheetRow({ ...dasar, lokasi: ["DKI Jakarta", "Beda provinsi"] });
    expect(baris).toHaveLength(sheetHeader(questions, { lokasi: true }).length);
    expect(baris.slice(-7, -5)).toEqual(["DKI Jakarta", "Beda provinsi"]);
    expect(sheetRow(dasar)).toHaveLength(sheetHeader(questions).length);
  });

  it("tab lama yang belum punya judul lokasi: nilai lokasi dilewati, tidak ada yang bergeser", () => {
    const judul = sheetHeader(questions, { lokasi: true });
    const lama = sheetHeader(questions).slice(0, -SESUDAH_LAMA);
    const nilai = sheetRow({ ...dasar, lokasi: ["Jawa Barat", "Sesuai"] });
    expect(susunBarisSheet(judul, lama, nilai)).toEqual(nilai.slice(0, lama.length));
  });

  it("kolom tim di kanan Lama Pengisian tidak terisi lokasi; judul lokasi dicari menurut namanya", () => {
    const judul = sheetHeader(questions, { lokasi: true });
    const aktual = [...sheetHeader(questions).slice(0, -SESUDAH_LAMA), "Catatan QC", ...JUDUL_LOKASI];
    const nilai = sheetRow({ ...dasar, lokasi: ["Jawa Barat", "Sesuai"] });
    const baris = susunBarisSheet(judul, aktual, nilai);
    expect(baris[aktual.indexOf("Catatan QC")]).toBe("");
    expect(baris.slice(-2)).toEqual(["Jawa Barat", "Sesuai"]);
  });

  it("pertanyaan yang kebetulan berjudul 'Durasi (menit)' tidak mengacaukan letak buntut", () => {
    const qs = [...questions, { id: "q3", text: TRAILING_HEADER[0] }];
    const judul = sheetHeader(qs, { lokasi: true });
    const nilai = sheetRow({
      ...dasar,
      questions: qs,
      answers: [{ questionId: "q3", value: "7" }],
      lokasi: ["Bali", "Sesuai"],
    });
    expect(susunBarisSheet(judul, judul, nilai)).toEqual(nilai);
  });

  it("cariBarisRespons: Nomor + Mulai, berapa pun urutannya", () => {
    const header = sheetHeader(questions, { lokasi: true });
    const mulai = fmtJakarta(dasar.startedAt);
    const baris = [
      ["6282", "", "", mulai],
      ["6281", "", "", "2026-09-30 10:00"],
      [" 6281 ", "", "", mulai],
    ];
    expect(cariBarisRespons(header, baris, "6281", mulai)).toEqual([2]);
    expect(cariBarisRespons(["Nama", "Mulai"], baris, "6281", mulai)).toEqual([]);
  });
});

describe("kolom asal responden (Sheets)", () => {
  const dasar = {
    phone: "6281",
    name: "Ani",
    consentSource: null,
    startedAt: new Date("2026-10-01T03:00:00Z"),
    completedAt: new Date("2026-10-01T03:05:00Z"),
    questions,
    answers: [],
    asal: { saluran: "WhatsApp", jalurMasuk: "Iklan", metode: "Form", iklanId: "A1" },
  };
  const nilaiAsal = ["WhatsApp", "Iklan", "Form", "A1"];

  it("paling akhir, sejajar dengan judulnya", () => {
    const baris = sheetRow({ ...dasar, lokasi: ["Bali", "Sesuai"] });
    const judul = sheetHeader(questions, { lokasi: true });
    expect(baris).toHaveLength(judul.length);
    expect(baris.slice(-5, -1)).toEqual(nilaiAsal);
    expect(judul.slice(-5, -1)).toEqual([...JUDUL_ASAL]);
  });

  it("tab yang sudah punya kolom lokasi: asal ikut terisi menurut judul, lokasi tidak bergeser", () => {
    const judul = sheetHeader(questions, { lokasi: true });
    const baris = susunBarisSheet(judul, judul, sheetRow({ ...dasar, lokasi: ["Bali", "Sesuai"] }));
    expect(baris[judul.indexOf("Provinsi Lokasi")]).toBe("Bali");
    expect(baris[judul.indexOf("Jalur Masuk")]).toBe("Iklan");
  });

  it("survei tanpa lokasi pada tab yang punya kolom lokasi: kolom lokasi dibiarkan kosong", () => {
    const aktual = sheetHeader(questions, { lokasi: true });
    const baris = susunBarisSheet(sheetHeader(questions), aktual, sheetRow(dasar));
    expect(baris[aktual.indexOf("Provinsi Lokasi")]).toBe("");
    expect(baris[aktual.indexOf("Metode")]).toBe("Form");
  });
});

describe("kolom Username IG (Sheets)", () => {
  const dasar = {
    phone: "ig:8123456789",
    name: "Siti",
    consentSource: "instagram",
    startedAt: new Date("2026-11-01T03:00:00Z"),
    completedAt: new Date("2026-11-01T03:05:00Z"),
    questions,
    answers: [],
    asal: { saluran: "Instagram", jalurMasuk: "Kata pemicu", metode: "Chatbot", iklanId: "" },
  };

  it("paling akhir untuk semua survei, berisi @username — kosong bila tak diketahui", () => {
    for (const lokasi of [false, true]) {
      const judul = sheetHeader(questions, { lokasi });
      expect(judul.at(-1)).toBe(JUDUL_USERNAME_IG);
      expect(judul.at(-2)).toBe("ID Iklan");
      const baris = sheetRow({ ...dasar, igUsername: "siti.ig", ...(lokasi ? { lokasi: ["Bali", "Sesuai"] } : {}) });
      expect(baris).toHaveLength(judul.length);
      expect(baris.at(-1)).toBe("@siti.ig");
    }
    expect(sheetRow({ ...dasar, igUsername: null }).at(-1)).toBe("");
    expect(sheetRow({ ...dasar, phone: "6281" }).at(-1)).toBe(""); // WhatsApp
  });

  it("tab lama yang sudah punya kolom asal: judulnya menyusul di kanan, tidak ada yang bergeser", () => {
    const judul = sheetHeader(questions);
    const lama = judul.slice(0, -1);
    expect(judulYangKurang(lama, judul)).toEqual({ mulai: lama.length, nilai: [JUDUL_USERNAME_IG] });
    const nilai = sheetRow({ ...dasar, igUsername: "siti.ig" });
    // Sebelum judulnya tertulis: nilainya dilewati, kolom lain persis di tempatnya.
    expect(susunBarisSheet(judul, lama, nilai)).toEqual(nilai.slice(0, -1));
  });

  it("kolom tim di kanan ID Iklan tidak terisi username; ditaruh menurut judulnya", () => {
    const judul = sheetHeader(questions);
    const aktual = [...judul.slice(0, -1), "Catatan QC", JUDUL_USERNAME_IG];
    const baris = susunBarisSheet(judul, aktual, sheetRow({ ...dasar, igUsername: "siti.ig" }));
    expect(baris[aktual.indexOf("Catatan QC")]).toBe("");
    expect(baris[aktual.indexOf(JUDUL_USERNAME_IG)]).toBe("@siti.ig");
    expect(baris[aktual.indexOf("Saluran")]).toBe("Instagram");
  });
});
