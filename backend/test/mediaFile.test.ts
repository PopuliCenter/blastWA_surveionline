import { describe, it, expect, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { readMediaFromUrl, mimeFromName, fileNameFromUrl } from "../src/lib/mediaFile.js";
import { env } from "../src/env.js";

// Media header template: file milik sendiri dibaca dari disk (bukan diunduh),
// dan hanya tipe yang diterima Resumable Upload API Meta yang lolos.

const dir = path.resolve(env.UPLOAD_DIR);

describe("mimeFromName", () => {
  it("tipe yang didukung Meta → MIME", () => {
    expect(mimeFromName("a.jpg")).toBe("image/jpeg");
    expect(mimeFromName("a.JPEG")).toBe("image/jpeg");
    expect(mimeFromName("a.png")).toBe("image/png");
    expect(mimeFromName("rilis.pdf")).toBe("application/pdf");
    expect(mimeFromName("v.mp4")).toBe("video/mp4");
  });

  it("WebP & Office TIDAK didukung Meta untuk header template → null", () => {
    expect(mimeFromName("a.webp")).toBeNull();
    expect(mimeFromName("a.docx")).toBeNull();
    expect(mimeFromName("a.xlsx")).toBeNull();
    expect(mimeFromName("tanpa-ekstensi")).toBeNull();
  });
});

describe("fileNameFromUrl", () => {
  it("ambil segmen akhir tanpa query", () => {
    expect(fileNameFromUrl("https://x.id/uploads/abc.png?v=2")).toBe("abc.png");
    expect(fileNameFromUrl("https://x.id/uploads/nama%20file.pdf")).toBe("nama file.pdf");
  });
});

describe("readMediaFromUrl (file milik sendiri → dari disk)", () => {
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("URL /uploads/ dibaca dari disk beserta MIME-nya", async () => {
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(path.join(dir, "contoh.png"), bytes);

    const f = await readMediaFromUrl("https://wa.populicenter.com/uploads/contoh.png");
    expect(f.mime).toBe("image/png");
    expect(f.filename).toBe("contoh.png");
    expect(f.buffer).toEqual(bytes);
  });

  it("path traversal di URL tidak bisa keluar dari folder upload", async () => {
    // basename dipakai → "../../etc/passwd" menjadi "passwd" (tidak ada) → gagal baca.
    await expect(readMediaFromUrl("https://x.id/uploads/../../etc/passwd")).rejects.toThrow();
  });

  it("tipe tak didukung (webp) ditolak dengan pesan jelas", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "gambar.webp"), Buffer.from([1, 2, 3]));
    await expect(readMediaFromUrl("https://x.id/uploads/gambar.webp")).rejects.toThrow(/tidak didukung/i);
  });
});
