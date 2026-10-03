import { describe, it, expect } from "vitest";
import { hitungBiaya, pilihTarif, kunciBulan, serviceGratisTerpakai, type Tarif } from "../src/lib/biaya.js";

// Tarif pasar Indonesia yang berlaku 1 Oktober 2026, menurut kartu tarif resmi Meta.
const TARIF: Tarif = {
  mataUang: "IDR",
  marketing: 586.33,
  utility: 356.65,
  authentication: 356.65,
  service: 356.65,
  gratisServicePerBulan: 1000,
  pajakPersen: 0,
};

describe("pilihTarif", () => {
  const a = { id: "a", berlakuSejak: new Date("2025-07-01T00:00:00Z") };
  const b = { id: "b", berlakuSejak: new Date("2026-10-01T00:00:00Z") };
  const c = { id: "c", berlakuSejak: new Date("2027-01-01T00:00:00Z") };

  it("memakai set yang berlaku pada tanggalnya, bukan yang terbaru", () => {
    // Inti dari tarif berversi: invoice lama harus tetap memakai tarif lamanya.
    expect(pilihTarif([a, b, c], new Date("2026-09-30T00:00:00Z"))?.id).toBe("a");
    expect(pilihTarif([a, b, c], new Date("2026-10-03T00:00:00Z"))?.id).toBe("b");
    expect(pilihTarif([a, b, c], new Date("2027-06-01T00:00:00Z"))?.id).toBe("c");
  });

  it("tepat pada tanggal berlaku sudah memakai set baru", () => {
    expect(pilihTarif([a, b], new Date("2026-10-01T00:00:00Z"))?.id).toBe("b");
  });

  it("null bila belum ada tarif yang berlaku — menolak menghitung lebih baik daripada menebak", () => {
    expect(pilihTarif([b, c], new Date("2026-01-01T00:00:00Z"))).toBeNull();
    expect(pilihTarif([], new Date())).toBeNull();
  });
});

describe("jatah gratis pesan service", () => {
  it("berlaku per bulan kalender, bukan sekali untuk seluruh periode", () => {
    // Kalau dijumlahkan dulu lalu dikurangi satu kali jatah, periode yang melintasi
    // pergantian bulan akan tertagih terlalu mahal.
    expect(serviceGratisTerpakai({ "2026-10": 4000, "2026-11": 2000 }, 1000)).toBe(2000);
  });

  it("tidak pernah melebihi jumlah pesan di bulan itu", () => {
    expect(serviceGratisTerpakai({ "2026-10": 300 }, 1000)).toBe(300);
    expect(serviceGratisTerpakai({ "2026-10": 0 }, 1000)).toBe(0);
  });

  it("kunciBulan memakai UTC agar sepadan dengan pengelompokan di database", () => {
    expect(kunciBulan(new Date("2026-10-03T06:00:00Z"))).toBe("2026-10");
    expect(kunciBulan(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });
});

describe("hitungBiaya", () => {
  it("menghitung skenario blast 1.200 responden dengan formulir Flow", () => {
    const r = hitungBiaya({
      jumlah: { marketing: 1200, utility: 0, authentication: 0, servicePerBulan: { "2026-10": 6000 } },
      tarif: TARIF,
    });
    expect(r.baris).toHaveLength(2);
    expect(r.baris[0]).toEqual({
      label: "Pesan template — Marketing",
      jumlah: 1200,
      tarif: 586.33,
      subtotal: 703596,
    });
    expect(r.serviceTerkirim).toBe(6000);
    expect(r.serviceGratis).toBe(1000);
    expect(r.serviceDitagih).toBe(5000);
    expect(r.baris[1]!.label).toBe("Pesan service (di luar jatah gratis)");
    expect(r.baris[1]!.subtotal).toBe(1783250);
    expect(r.subtotal).toBe(2486846);
    expect(r.total).toBe(2486846);
  });

  it("margin ditampilkan terpisah, bukan dilebur ke biaya Meta", () => {
    const r = hitungBiaya({
      jumlah: { marketing: 1200, utility: 0, authentication: 0, servicePerBulan: { "2026-10": 6000 } },
      tarif: TARIF,
      marginPersen: 10,
    });
    expect(r.subtotal).toBe(2486846); // biaya Meta tidak berubah
    expect(r.margin).toBe(248684.6);
    expect(r.total).toBe(2735530.6);
  });

  it("pajak dikenakan atas biaya PLUS margin", () => {
    const r = hitungBiaya({
      jumlah: { marketing: 100, utility: 0, authentication: 0, servicePerBulan: {} },
      tarif: { ...TARIF, pajakPersen: 11 },
      marginPersen: 20,
    });
    expect(r.subtotal).toBe(58633); // 100 × 586,33
    expect(r.margin).toBe(11726.6); // 20% dari 58.633
    expect(r.pajak).toBe(7739.56); // 11% dari 70.359,60
    expect(r.total).toBe(78099.16); // 58.633 + 11.726,60 + 7.739,56
  });

  it("memakai tarif pajak EFEKTIF, bukan yang tertulis di label", () => {
    // Invoice Meta untuk Indonesia menulis "Tax (12%)" lalu menagih 11% dari subtotal,
    // karena PPN 12% dikenakan atas dasar pengenaan pajak 11/12 nilai. Memakai 12% penuh
    // membuat invoice ke klien tidak cocok dengan invoice Meta yang direkonsiliasi.
    const r = hitungBiaya({
      jumlah: { marketing: 0, utility: 0, authentication: 0, servicePerBulan: {} },
      tarif: { ...TARIF, pajakPersen: 12, pajakEfektifPersen: 11 },
    });
    expect(r.pajakPersen).toBe(12); // yang ditulis
    expect(r.pajakEfektifPersen).toBe(11); // yang dikalikan
  });

  it("mereproduksi angka invoice Meta yang sebenarnya", () => {
    // Subtotal IDR 301.726 → Tax (12%) IDR 33.190 → Total IDR 334.916.
    // 33.190 / 301.726 = tepat 11,0%.
    const r = hitungBiaya({
      jumlah: { marketing: 1, utility: 0, authentication: 0, servicePerBulan: {} },
      tarif: { ...TARIF, marketing: 301726, pajakPersen: 12, pajakEfektifPersen: 11 },
    });
    expect(r.subtotal).toBe(301726);
    expect(Math.round(r.pajak)).toBe(33190);
    expect(Math.round(r.total)).toBe(334916);
  });

  it("tanpa pajakEfektifPersen, angka yang ditulis juga yang dikalikan", () => {
    const r = hitungBiaya({
      jumlah: { marketing: 100, utility: 0, authentication: 0, servicePerBulan: {} },
      tarif: { ...TARIF, pajakPersen: 11 },
    });
    expect(r.pajakEfektifPersen).toBe(11);
    expect(r.pajak).toBe(6449.63); // 11% dari 58.633
  });

  it("jatah gratis 0 berarti SELURUH pesan service ditagih", () => {
    // Jatah itu milik bulan, bukan milik satu survei; bila sebulan ada dua-tiga survei,
    // membebankannya ke salah satunya sewenang-wenang.
    const r = hitungBiaya({
      jumlah: { marketing: 0, utility: 0, authentication: 0, servicePerBulan: { "2026-10": 6000 } },
      tarif: { ...TARIF, gratisServicePerBulan: 0 },
    });
    expect(r.serviceGratis).toBe(0);
    expect(r.serviceDitagih).toBe(6000);
    expect(r.subtotal).toBe(2139900); // 6.000 × 356,65
    // Label tidak menyebut jatah gratis kalau tak ada yang dipotong.
    expect(r.baris[0]!.label).toBe("Pesan service");
  });

  it("tidak membuat baris untuk kategori yang tak terpakai", () => {
    const r = hitungBiaya({
      jumlah: { marketing: 0, utility: 0, authentication: 0, servicePerBulan: { "2026-10": 500 } },
      tarif: TARIF,
    });
    // 500 pesan service masih di bawah jatah gratis → tidak ada baris sama sekali.
    expect(r.baris).toHaveLength(0);
    expect(r.serviceGratis).toBe(500);
    expect(r.serviceDitagih).toBe(0);
    expect(r.total).toBe(0);
  });

  it("margin negatif atau tak masuk akal diperlakukan sebagai nol", () => {
    const j = { marketing: 10, utility: 0, authentication: 0, servicePerBulan: {} };
    expect(hitungBiaya({ jumlah: j, tarif: TARIF, marginPersen: -5 }).margin).toBe(0);
    expect(hitungBiaya({ jumlah: j, tarif: TARIF, marginPersen: Number.NaN }).margin).toBe(0);
    expect(hitungBiaya({ jumlah: j, tarif: TARIF }).margin).toBe(0);
  });

  it("jumlah baris selalu sama dengan subtotalnya", () => {
    // Pembulatan dilakukan per baris lalu dijumlahkan, supaya invoice tidak memperlihatkan
    // selisih satuan terkecil antara daftar baris dan totalnya.
    const r = hitungBiaya({
      jumlah: { marketing: 777, utility: 333, authentication: 111, servicePerBulan: { "2026-10": 2345 } },
      tarif: TARIF,
      marginPersen: 15,
    });
    const jumlahBaris = r.baris.reduce((a, b) => a + b.subtotal, 0);
    expect(Math.round(jumlahBaris * 100) / 100).toBe(r.subtotal);
    expect(Math.round((r.subtotal + r.margin + r.pajak) * 100) / 100).toBe(r.total);
  });
});
