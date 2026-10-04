import { describe, it, expect } from "vitest";
import { nomorReferensi, nomorTransaksi, kunciInvoice } from "./invoiceNomor";

const kunci = kunciInvoice({ nama: "Populi Center", dari: "2026-10-01", sampai: "2026-10-05", total: 334916 });

describe("nomor invoice", () => {
  it("deterministik — invoice yang sama selalu bernomor sama", () => {
    // Invoice tidak disimpan; ia disusun ulang tiap dibuka. Nomor acak akan berbeda tiap
    // kali dicetak, dan klien yang merujuk nomor dari cetakan pertama tidak akan menemukannya.
    expect(nomorReferensi(kunci)).toBe(nomorReferensi(kunci));
    expect(nomorTransaksi(kunci)).toBe(nomorTransaksi(kunci));
  });

  it("invoice berbeda bernomor berbeda", () => {
    const lain = kunciInvoice({ nama: "Klien Lain", dari: "2026-10-01", sampai: "2026-10-05", total: 334916 });
    expect(nomorReferensi(lain)).not.toBe(nomorReferensi(kunci));
    expect(nomorTransaksi(lain)).not.toBe(nomorTransaksi(kunci));
  });

  it("total ikut menentukan — periode sama dengan angka berbeda bukan invoice yang sama", () => {
    // Mis. setelah margin diubah. Memakai nomor lama akan membuat dua dokumen berbeda
    // beredar dengan nomor yang sama.
    const a = kunciInvoice({ nama: "X", dari: "2026-10-01", sampai: "2026-10-05", total: 100 });
    const b = kunciInvoice({ nama: "X", dari: "2026-10-01", sampai: "2026-10-05", total: 200 });
    expect(nomorReferensi(a)).not.toBe(nomorReferensi(b));
  });

  it("Reference Number: 10 karakter huruf besar dan angka", () => {
    expect(nomorReferensi(kunci)).toMatch(/^[A-Z0-9]{10}$/);
  });

  it("Transaction ID: dua blok 17 digit, tak pernah berawalan nol", () => {
    // Nomor berawalan nol kerap kehilangan angkanya saat ditempel ke spreadsheet.
    const t = nomorTransaksi(kunci);
    expect(t).toMatch(/^[1-9]\d{16}-[1-9]\d{16}$/);
  });

  it("bertahan pada isian kosong", () => {
    expect(nomorReferensi(kunciInvoice())).toMatch(/^[A-Z0-9]{10}$/);
    expect(nomorTransaksi(kunciInvoice({}))).toMatch(/^[1-9]\d{16}-[1-9]\d{16}$/);
  });
});
