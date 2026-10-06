import { describe, it, expect } from "vitest";
import { canSeePage, VIEWER_PAGES, SUPERADMIN_PAGES } from "./izinHalaman";

const PEMEGANG_KUNCI = ["wa-account", "sheets", "invoice"];

describe("canSeePage", () => {
  it("superadmin membuka semuanya", () => {
    for (const id of [...VIEWER_PAGES, ...SUPERADMIN_PAGES, "surveys", "broadcast"])
      expect(canSeePage("superadmin", id)).toBe(true);
  });

  it("admin TIDAK membuka halaman pemegang kunci atau uang", () => {
    // Kredensial vendor WhatsApp, kunci service account Google beserta tujuan ekspor data
    // responden, serta tarif dan margin yang menentukan apa yang ditagihkan ke klien.
    for (const id of PEMEGANG_KUNCI) expect(canSeePage("admin", id)).toBe(false);
    expect(canSeePage("admin", "admin")).toBe(false);
    expect(canSeePage("admin", "log")).toBe(false);
  });

  it("admin tetap membuka seluruh pekerjaan hariannya", () => {
    for (const id of ["dashboard", "contacts", "chat", "broadcast", "templates", "surveys", "reports", "autoreply", "ai", "webhook"])
      expect(canSeePage("admin", id)).toBe(true);
  });

  it("viewer hanya membuka daftar-izinnya", () => {
    for (const id of VIEWER_PAGES) expect(canSeePage("viewer", id)).toBe(true);
    for (const id of ["surveys", "broadcast", "templates", ...PEMEGANG_KUNCI])
      expect(canSeePage("viewer", id)).toBe(false);
  });

  it("peran tak dikenal diperlakukan seperti bukan viewer, tapi tetap tertutup dari halaman kunci", () => {
    // Token lama dengan peran yang sudah dihapus tidak boleh membuka pengaturan kredensial
    // hanya karena namanya tidak cocok dengan "viewer".
    expect(canSeePage("operator", "dashboard")).toBe(true);
    for (const id of PEMEGANG_KUNCI) expect(canSeePage("operator", id)).toBe(false);
    for (const id of PEMEGANG_KUNCI) expect(canSeePage(undefined, id)).toBe(false);
  });

  it("ketiga halaman itu memang terdaftar sebagai milik superadmin", () => {
    for (const id of PEMEGANG_KUNCI) expect(SUPERADMIN_PAGES.has(id)).toBe(true);
  });
});
