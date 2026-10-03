import { describe, it, expect } from "vitest";
import { cutoffFor } from "../src/lib/retention.js";

// WebhookLog menyimpan SELURUH badan webhook apa adanya — nomor telepon, nama profil,
// isi pesan responden — dan sampai sekarang tidak pernah dibersihkan. Batas umurnya
// dihitung terpisah dari kuerinya supaya bisa diuji tanpa database.

const kini = new Date("2026-10-03T06:00:00.000Z");

describe("cutoffFor", () => {
  it("menghitung batas sesuai jumlah hari", () => {
    expect(cutoffFor(30, kini).toISOString()).toBe("2026-09-03T06:00:00.000Z");
    expect(cutoffFor(1, kini).toISOString()).toBe("2026-10-02T06:00:00.000Z");
    expect(cutoffFor(90, kini).toISOString()).toBe("2026-07-05T06:00:00.000Z");
  });

  it("jatuh ke 30 hari bila nilainya tidak masuk akal", () => {
    // Penjaga terakhir: nilai aneh dari env tidak boleh berubah jadi batas di masa depan,
    // yang akan menghapus SELURUH isi tabel.
    const bawaan = cutoffFor(30, kini).toISOString();
    expect(cutoffFor(0, kini).toISOString()).toBe(bawaan);
    expect(cutoffFor(-5, kini).toISOString()).toBe(bawaan);
    expect(cutoffFor(Number.NaN, kini).toISOString()).toBe(bawaan);
    expect(cutoffFor(Number.POSITIVE_INFINITY, kini).toISOString()).toBe(bawaan);
  });

  it("batasnya selalu di MASA LALU, tidak pernah menghapus baris baru", () => {
    for (const hari of [1, 7, 30, 365, 0, -1, Number.NaN]) {
      expect(cutoffFor(hari, kini).getTime()).toBeLessThan(kini.getTime());
    }
  });

  it("membulatkan pecahan ke bawah, bukan menghasilkan batas berpindah-pindah", () => {
    expect(cutoffFor(30.9, kini).toISOString()).toBe(cutoffFor(30, kini).toISOString());
  });
});
