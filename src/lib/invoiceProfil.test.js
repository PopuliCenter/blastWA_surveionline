import { describe, it, expect } from "vitest";
import { invoiceAwal, profilDariInvoice, BIDANG_TETAP, BIDANG_BERGANTI } from "./invoiceProfil";

const profil = {
  penerbit: "Populi Center\nJalan Siaga Raya No. 31\nIndonesia\nTax ID (NPWP): 01.234.567.8-901.000",
  accountId: "1027483456718760",
  metode: "Visa ···· 3809",
  produk: "WhatsApp Business Account",
  status: "Paid",
};

describe("invoiceAwal", () => {
  it("mengisi bidang tetap dari profil", () => {
    const inv = invoiceAwal(profil, "2026-10-03");
    expect(inv.penerbit).toContain("Tax ID (NPWP): 01.234.567.8-901.000");
    expect(inv.accountId).toBe("1027483456718760");
    expect(inv.metode).toBe("Visa ···· 3809");
    expect(inv.tanggal).toBe("2026-10-03");
  });

  it("SELALU mengosongkan bidang per klien", () => {
    // Inti pemisahannya: invoice untuk klien baru tidak boleh memuat sisa klien sebelumnya.
    const inv = invoiceAwal(
      { ...profil, nama: "Klien Lama", alamatKlien: "Alamat lama", transaksi: "123" },
      "2026-10-03",
    );
    for (const k of BIDANG_BERGANTI) expect(inv[k]).toBe("");
  });

  it("tetap memberi bawaan masuk akal saat profil belum pernah diisi", () => {
    const inv = invoiceAwal(null, "2026-10-03");
    expect(inv.produk).toBe("WhatsApp Business Account");
    expect(inv.status).toBe("Paid");
    expect(inv.penerbit).toBe("");
    expect(inv.accountId).toBe("");
  });

  it("tidak pernah menghasilkan undefined — kolom kosong, bukan kolom hilang", () => {
    const inv = invoiceAwal(undefined, "");
    for (const k of [...BIDANG_TETAP, ...BIDANG_BERGANTI, "tanggal"]) {
      expect(typeof inv[k]).toBe("string");
    }
  });
});

describe("profilDariInvoice", () => {
  it("hanya mengambil bidang tetap", () => {
    const simpan = profilDariInvoice({
      ...profil,
      nama: "PT Klien",
      alamatKlien: "Jalan Klien 1",
      referensi: "SFY7N72KH4",
      transaksi: "292888-289381",
      catatan: "Survei Oktober",
    });
    expect(Object.keys(simpan).sort()).toEqual([...BIDANG_TETAP].sort());
    expect(simpan.accountId).toBe("1027483456718760");
    // Data klien tidak boleh ikut tersimpan ke profil.
    expect(simpan.nama).toBeUndefined();
    expect(simpan.alamatKlien).toBeUndefined();
    expect(simpan.transaksi).toBeUndefined();
  });

  it("tahan terhadap masukan kosong", () => {
    const simpan = profilDariInvoice(null);
    for (const k of BIDANG_TETAP) expect(simpan[k]).toBe("");
  });
});
