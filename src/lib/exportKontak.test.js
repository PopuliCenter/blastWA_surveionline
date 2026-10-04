import { describe, it, expect } from "vitest";
import { kolomAtribut, buildContactRows, exportKontakFilename } from "./exportKontak";

const kontak = (over = {}) => ({
  phone: "628123456789",
  name: "Budi",
  attributes: null,
  subscribed: true,
  optOutAt: null,
  consentSource: "impor",
  createdAt: "2026-10-01T03:00:00.000Z",
  ...over,
});

describe("kolomAtribut", () => {
  it("mengumpulkan kolom dari SEMUA baris, bukan dari baris pertama", () => {
    // Atribut hasil impor berbeda antar segmen. Membaca baris pertama saja akan
    // menghilangkan kolom milik kontak lain tanpa gejala apa pun di berkas hasilnya.
    const hasil = kolomAtribut([
      kontak({ attributes: { Provinsi: "Jawa Barat" } }),
      kontak({ attributes: { Umur: "30", Provinsi: "Bali" } }),
      kontak({ attributes: null }),
    ]);
    expect(hasil).toEqual(["Provinsi", "Umur"]);
  });

  it("mengabaikan atribut yang bukan objek", () => {
    expect(kolomAtribut([kontak({ attributes: "bukan objek" }), kontak({ attributes: ["a"] })])).toEqual([]);
  });

  it("daftar kosong tidak menghasilkan kolom", () => {
    expect(kolomAtribut([])).toEqual([]);
  });
});

describe("buildContactRows", () => {
  it("menyusun kolom tetap lalu atribut sesuai urutan header", () => {
    const { header, rows } = buildContactRows([
      kontak({ attributes: { Provinsi: "Bali" } }),
      kontak({ phone: "628999", name: null, subscribed: false, attributes: { Umur: "30" } }),
    ]);
    expect(header).toEqual(["Nomor", "Nama", "Berlangganan", "Sumber consent", "Opt-out", "Dibuat", "Provinsi", "Umur"]);
    expect(rows[0]).toEqual(["628123456789", "Budi", "Ya", "impor", "", "2026-10-01", "Bali", ""]);
    // Kontak kedua tidak punya Provinsi: selnya kosong, kolom berikutnya TIDAK bergeser.
    expect(rows[1]).toEqual(["628999", "", "Tidak", "impor", "", "2026-10-01", "", "30"]);
  });

  it("nomor berawalan + tidak terbaca Excel sebagai rumus", () => {
    // "+62…" diawali tanda plus, dan Excel memperlakukan sel semacam itu sebagai rumus.
    const { rows } = buildContactRows([kontak({ phone: "+628123456789" })]);
    expect(rows[0][0]).toBe("'+628123456789");
  });

  it("teks berawalan = tidak jadi rumus saat berkasnya dibuka orang lain", () => {
    // Nama kontak berasal dari impor pihak luar; sel berawalan "=" adalah jalan masuk
    // injeksi rumus ke komputer siapa pun yang membuka berkas hasil unduhan.
    const { rows } = buildContactRows([kontak({ name: "=HYPERLINK(\"http://jahat\",\"klik\")" })]);
    expect(rows[0][1].startsWith("'=")).toBe(true);
  });

  it("tanggal disederhanakan jadi YYYY-MM-DD", () => {
    const { rows } = buildContactRows([kontak({ optOutAt: "2026-09-20T10:11:12.000Z" })]);
    expect(rows[0][4]).toBe("2026-09-20");
  });
});

describe("exportKontakFilename", () => {
  it("memuat jumlah dan stempel waktu agar unduhan tidak saling menimpa", () => {
    const d = new Date(2026, 9, 4, 21, 37);
    expect(exportKontakFilename("xlsx", 5011, d)).toBe("kontak-5011-2026-10-04_2137.xlsx");
    expect(exportKontakFilename("csv", 12, d)).toBe("kontak-12-2026-10-04_2137.csv");
  });
});
