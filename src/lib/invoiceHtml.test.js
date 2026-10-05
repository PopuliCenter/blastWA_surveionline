import { describe, it, expect } from "vitest";
import { invoiceHtml } from "./invoiceHtml";

// Angka contoh diambil dari invoice Meta yang sebenarnya: subtotal IDR 301.726,
// Tax (12%) IDR 33.190, total IDR 334.916 — 33.190 / 301.726 tepat 11,0%, karena PPN 12%
// dikenakan atas dasar pengenaan pajak 11/12 nilai.
const hasil = {
  mataUang: "IDR",
  baris: [{ kode: "marketing", label: "Pesan template — Marketing", jumlah: 515, tarif: 586.33, subtotal: 301960 }],
  serviceTerkirim: 0,
  serviceGratis: 0,
  serviceDitagih: 0,
  subtotal: 301726,
  marginPersen: 0,
  margin: 0,
  pajakPersen: 12,
  pajakEfektifPersen: 11,
  pajak: 33190,
  total: 334916,
  tarif: { berlakuSejak: "2026-10-01T00:00:00.000Z", gratisServicePerBulan: 0 },
};

const inv = {
  nama: "Populi Center",
  accountId: "1027483456718760",
  tanggal: "2026-10-03",
  metode: "Visa ···· 3809",
  referensi: "SFY7N72KH4",
  transaksi: "29288895167464408-28938179095869353",
  produk: "WhatsApp Business Account",
  status: "Paid",
  catatan: "",
  penerbit: ["Populi Center", "Jalan Contoh 1", "Jakarta Selatan 12790", "Indonesia", "Tax ID (NPWP): 01.234.567.8-901.000"].join("\n"),
  alamatKlien: ["38 Jalan Mampang Prapatan VIII", "Jakarta Selatan 12790", "DKI Jakarta", "Indonesia"].join("\n"),
};

const html = () => invoiceHtml({ hasil, inv, dari: "2026-10-01", sampai: "2026-10-03" });

describe("invoiceHtml", () => {
  it("memuat bidang-bidang invoice Meta", () => {
    const h = html();
    expect(h).toContain("Tax Invoice for Populi Center");
    expect(h).toContain("Account ID: 1027483456718760");
    expect(h).toContain("Oct 3, 2026");
    expect(h).toContain("Visa ···· 3809");
    expect(h).toContain("Reference Number: SFY7N72KH4");
    expect(h).toContain("29288895167464408-28938179095869353");
    expect(h).toContain("WhatsApp Business Account");
    expect(h).toContain("Paid");
  });

  it("menampilkan angka persis seperti invoice aslinya", () => {
    const h = html();
    expect(h).toContain("IDR334,916");
    expect(h).toContain("Subtotal: IDR301,726");
    expect(h).toContain("Tax (12%): IDR33,190");
  });

  it("memberi tanda bintang dan catatan VAT persis seperti invoice Meta", () => {
    const h = html();
    expect(h).toContain("IDR33,190*");
    expect(h).toContain("* VAT amount will be computed at 11/12 of the sale price as the tax base.");
  });

  it("mencetak blok alamat penerbit dan penagihan di kaki dokumen", () => {
    const h = html();
    expect(h).toContain("Populi Center");
    expect(h).toContain("Tax ID (NPWP): 01.234.567.8-901.000");
    expect(h).toContain("38 Jalan Mampang Prapatan VIII");
    expect(h).toContain("DKI Jakarta");
  });

  it("tidak lagi mencetak catatan internal tentang asal angka", () => {
    const h = html();
    expect(h).not.toContain("catatan pengiriman sistem");
    expect(h).not.toContain("invoice resmi Meta");
  });

  it("tanpa tanda bintang bila kedua angka pajaknya sama", () => {
    const h = invoiceHtml({
      hasil: { ...hasil, pajakPersen: 11, pajakEfektifPersen: 11 },
      inv,
      dari: "2026-10-01",
      sampai: "2026-10-03",
    });
    expect(h).toContain("Tax (11%): IDR33,190");
    expect(h).not.toContain("IDR33,190*");
    expect(h).not.toContain("VAT amount will be computed");
  });

  it("memasang logo WhatsApp sebagai penanda produk, digambar inline", () => {
    const h = html();
    expect(h).toContain('aria-label="WhatsApp"');
    // Inline, bukan <img>: dokumen sering disimpan jadi PDF, dan gambar dari jaringan
    // bisa gagal muat tanpa jejak lalu menyisakan kotak kosong di dokumen terkirim.
    expect(h).not.toContain("<img");
  });

  it("penerbitnya tetap jelas — logo produk tidak boleh jadi klaim penerbit", () => {
    // Inilah yang membedakan dokumen ini dari invoice Meta yang asli. Tanpa blok alamat
    // penerbit, logo di kepala halaman akan terbaca sebagai "diterbitkan oleh WhatsApp".
    const h = html();
    expect(h).toContain("Populi Center");
    expect(h).toContain("Tax ID (NPWP): 01.234.567.8-901.000");
    // Tidak pernah mengaku sebagai entitas Meta.
    expect(h).not.toContain("Meta Platforms");
  });

  it("meng-escape isian pemakai supaya tidak merusak dokumen", () => {
    const h = invoiceHtml({
      hasil,
      inv: { ...inv, nama: 'PT "Anu" <script>alert(1)</script>' },
      dari: "2026-10-01",
      sampai: "2026-10-03",
    });
    expect(h).not.toContain("<script>alert(1)</script>");
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("&quot;Anu&quot;");
  });

  it("menyertakan tabel rincian — invoice Meta hanya satu angka, klien perlu asalnya", () => {
    const h = html();
    expect(h).toContain("Usage details 2026-10-01 to 2026-10-03");
    // Nama komponen diambil dari KODE-nya, bukan dari label Indonesia milik layar Biaya.
    expect(h).toContain("Template message — Marketing");
    expect(h).not.toContain("Pesan template");
    expect(h).toContain("Component");
    expect(h).toContain("Quantity");
    expect(h).toContain("Rate");
    expect(h).toContain("IDR586.33"); // tarif satuan tetap 2 desimal
    expect(h).toContain("515");
  });

  it("menampilkan baris margin hanya bila ada", () => {
    expect(html()).not.toContain("Margin");
    const h = invoiceHtml({
      hasil: { ...hasil, marginPersen: 20, margin: 60345.2, total: 395261.2 },
      inv,
      dari: "2026-10-01",
      sampai: "2026-10-03",
    });
    expect(h).toContain("Margin (20%)");
  });
});

describe("invoiceHtml — model ringkas", () => {
  const ringkas = () => invoiceHtml({ hasil, inv, dari: "2026-10-01", sampai: "2026-10-03", rincian: false });

  it("menghilangkan seluruh tabel rincian", () => {
    const h = ringkas();
    expect(h).not.toContain("<table");
    expect(h).not.toContain("Usage details");
    expect(h).not.toContain("Template message");
  });

  it("tetap memuat ringkasan, identitas penerbit, dan catatan pajak", () => {
    // Yang dibuang hanya rinciannya. Angka yang ditagih, siapa yang menagih, dan dasar
    // pengenaan pajaknya tetap harus ada — tanpa itu dokumennya bukan invoice.
    const h = ringkas();
    expect(h).toContain("Tax Invoice for Populi Center");
    expect(h).toContain("Subtotal:");
    expect(h).toContain("Tax (12%)");
    expect(h).toContain("Tax ID (NPWP): 01.234.567.8-901.000");
    expect(h).toContain("VAT amount will be computed");
  });

  it("bawaannya tetap model berincian", () => {
    expect(invoiceHtml({ hasil, inv, dari: "2026-10-01", sampai: "2026-10-03" })).toContain("<table");
  });
});
