import { describe, it, expect } from "vitest";
import { PeredamGalat, kunciGalat, durasiTeks, JEDA_LAPOR_MS } from "../src/lib/peredamGalat.js";

const K = "worker|ECONNREFUSED";

describe("PeredamGalat", () => {
  it("mencatat kemunculan pertama seketika", () => {
    // Sinyal pertama tidak boleh tertunda — itu satu-satunya petunjuk bahwa sesuatu mulai rusak.
    const p = new PeredamGalat();
    expect(p.putuskan(K, 0)).toEqual({ catat: true, pertama: true, ulangan: 1, tertahan: 0, sejakMs: 0 });
  });

  it("insiden nyata: 34 percobaan dalam 11 detik jadi 2 entri, bukan 34", () => {
    // Persis kejadian di produksi — satu deploy, Redis hilang sebentar, dua worker
    // mencoba ulang berbarengan, dan tiap percobaan dulu ditulis sendiri-sendiri.
    const p = new PeredamGalat();
    let ditulis = 0;
    for (let i = 0; i < 34; i++) if (p.putuskan(K, Math.round((i * 11000) / 33)).catat) ditulis++;
    expect(ditulis).toBe(1);

    const r = p.pulih(K, 11000);
    expect(r).toEqual({ ulangan: 34, sejakMs: 11000 });
    expect(ditulis + 1).toBe(2);
  });

  it("gangguan yang berlanjut tetap dilaporkan, dengan jumlah yang tertahan", () => {
    const p = new PeredamGalat();
    p.putuskan(K, 0);
    expect(p.putuskan(K, 30_000).catat).toBe(false);
    const d = p.putuskan(K, 70_000);
    expect(d).toEqual({ catat: true, pertama: false, ulangan: 3, tertahan: 2, sejakMs: 70_000 });
  });

  it("jeda laporan melebar bertahap lalu berhenti di nilai terbesar", () => {
    // Gangguan sejam menghasilkan ~5 entri, bukan ratusan — dan bukan nol.
    const p = new PeredamGalat();
    const waktuLapor: number[] = [];
    for (let t = 0; t <= 3_600_000; t += 1000) if (p.putuskan(K, t).catat) waktuLapor.push(t);
    expect(waktuLapor).toEqual([0, 60_000, 360_000, 1_260_000, 3_060_000]);
    expect(JEDA_LAPOR_MS[JEDA_LAPOR_MS.length - 1]).toBe(1_800_000);
  });

  it("pulih meringkas lalu melupakan, sehingga gangguan berikutnya mulai dari nol", () => {
    const p = new PeredamGalat();
    p.putuskan(K, 0);
    p.putuskan(K, 5_000);
    expect(p.pulih(K, 9_000)).toEqual({ ulangan: 2, sejakMs: 9_000 });
    expect(p.jumlahAktif).toBe(0);
    expect(p.putuskan(K, 50_000)).toMatchObject({ catat: true, pertama: true, ulangan: 1 });
  });

  it("pulih tanpa gangguan aktif tidak menghasilkan apa pun", () => {
    // Sinyal "ready" juga datang pada sambungan pertama yang normal. Kalau itu menulis
    // entri, tiap start worker akan mengarang gangguan yang tidak pernah terjadi.
    const p = new PeredamGalat();
    expect(p.pulih(K, 0)).toBeNull();
    expect(p.pulihSemua(0)).toEqual([]);
  });

  it("pulihSemua menutup tiap worker yang punya kunci sendiri", () => {
    // Satu koneksi Redis dipakai blast worker dan sheet worker; keduanya mencatat terpisah.
    const p = new PeredamGalat();
    p.putuskan("worker|ECONNREFUSED", 0);
    p.putuskan("sheetWorker|ECONNREFUSED", 0);
    const hasil = p.pulihSemua(4_000);
    expect(hasil.map((x) => x.kunci).sort()).toEqual(["sheetWorker|ECONNREFUSED", "worker|ECONNREFUSED"]);
    expect(p.jumlahAktif).toBe(0);
  });

  it("galat yang berbeda tidak saling meredam", () => {
    // Peredaman yang terlalu rakus akan menelan galat baru yang justru penting.
    const p = new PeredamGalat();
    p.putuskan("worker|ECONNREFUSED", 0);
    expect(p.putuskan("worker|ETIMEDOUT", 1_000)).toMatchObject({ catat: true, pertama: true });
  });
});

describe("kunciGalat", () => {
  it("memakai kode galat, bukan alamat yang berubah tiap deploy", () => {
    // IP container berganti tiap deploy. Kalau ikut jadi kunci, satu gangguan pecah jadi
    // beberapa kelompok dan peredamannya tidak pernah mengena.
    const a = { code: "ECONNREFUSED", message: "connect ECONNREFUSED 172.16.4.3:6379" };
    const b = { code: "ECONNREFUSED", message: "connect ECONNREFUSED 172.19.0.5:6379" };
    expect(kunciGalat("worker", a)).toBe(kunciGalat("worker", b));
    expect(kunciGalat("worker", a)).toBe("worker|ECONNREFUSED");
  });

  it("scope berbeda tetap terpisah", () => {
    const e = { code: "ECONNREFUSED" };
    expect(kunciGalat("worker", e)).not.toBe(kunciGalat("sheetWorker", e));
  });

  it("galat tanpa kode jatuh ke pesannya", () => {
    expect(kunciGalat("worker", new Error("Redis tidak menjawab"))).toBe("worker|Redis tidak menjawab");
    expect(kunciGalat("worker", undefined)).toBe("worker|galat");
  });
});

describe("durasiTeks", () => {
  it("menyebut satuan yang pas dengan besarnya", () => {
    expect(durasiTeks(11_000)).toBe("11 detik");
    expect(durasiTeks(180_000)).toBe("3 menit");
    expect(durasiTeks(4_320_000)).toBe("1 jam 12 menit");
    expect(durasiTeks(7_200_000)).toBe("2 jam");
  });
});
