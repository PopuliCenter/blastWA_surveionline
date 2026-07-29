import { describe, it, expect } from "vitest";
import { resolveHeaderMedia } from "../src/services/blastService.js";

// Kasus nyata di lapangan: blast memakai template ber-header TEKS tapi mengirim parameter
// IMAGE → Meta menolak SEMUA penerima dengan
// #132012 "Parameter format does not match format in the created template"
// (details: "header: Format mismatch, expected TEXT, received IMAGE").
// Format header versi META harus jadi penentu, bukan pilihan operator.

const base = {
  templateName: "undangan_survei",
  metaHeaderFormat: null as string | null,
  localHeaderType: null as string | null,
  localHeaderMediaUrl: null as string | null,
  inputType: null as "image" | "document" | "video" | null,
  inputUrl: null as string | null,
};

describe("resolveHeaderMedia — format Meta sebagai sumber kebenaran", () => {
  it("Meta bilang TEXT + operator melampirkan gambar → DITOLAK sejak awal (bukan gagal di Meta)", () => {
    expect(() =>
      resolveHeaderMedia({
        ...base,
        metaHeaderFormat: "text",
        inputType: "image",
        inputUrl: "https://x.id/uploads/a.png",
      }),
    ).toThrow(/ber-header TEXT di Meta, bukan media/i);
  });

  it("Meta bilang TEXT tanpa lampiran → tanpa parameter header (null)", () => {
    expect(resolveHeaderMedia({ ...base, metaHeaderFormat: "text" })).toBeNull();
  });

  it("Meta bilang TEXT tapi template lokal punya media → media lokal DIABAIKAN", () => {
    // Mencegah kebocoran: header lokal usang tak boleh menimpa kenyataan di Meta.
    expect(
      resolveHeaderMedia({
        ...base,
        metaHeaderFormat: "text",
        localHeaderType: "image",
        localHeaderMediaUrl: "https://x.id/uploads/lama.png",
      }),
    ).toBeNull();
  });

  it("Meta bilang IMAGE → pakai format Meta walau operator memilih tipe lain", () => {
    expect(
      resolveHeaderMedia({
        ...base,
        metaHeaderFormat: "image",
        inputType: "document",
        inputUrl: "https://x.id/uploads/a.png",
      }),
    ).toEqual({ headerMediaType: "image", headerMediaUrl: "https://x.id/uploads/a.png" });
  });

  it("Meta bilang IMAGE tanpa file mana pun → error jelas sebelum blast dibuat", () => {
    expect(() => resolveHeaderMedia({ ...base, metaHeaderFormat: "image" })).toThrow(/wajib melampirkan file media/i);
  });

  it("Meta bilang IMAGE, URL diambil dari template lokal bila blast tak mengisi", () => {
    expect(
      resolveHeaderMedia({
        ...base,
        metaHeaderFormat: "image",
        localHeaderMediaUrl: "https://x.id/uploads/tersimpan.jpg",
      }),
    ).toEqual({ headerMediaType: "image", headerMediaUrl: "https://x.id/uploads/tersimpan.jpg" });
  });
});

describe("resolveHeaderMedia — format Meta belum diketahui", () => {
  it("ikuti input operator", () => {
    expect(resolveHeaderMedia({ ...base, inputType: "video", inputUrl: "https://x.id/v.mp4" })).toEqual({
      headerMediaType: "video",
      headerMediaUrl: "https://x.id/v.mp4",
    });
  });

  it("cadangan: media tersimpan di template lokal", () => {
    expect(
      resolveHeaderMedia({ ...base, localHeaderType: "document", localHeaderMediaUrl: "https://x.id/r.pdf" }),
    ).toEqual({ headerMediaType: "document", headerMediaUrl: "https://x.id/r.pdf" });
  });

  it("template lokal ber-header teks → null", () => {
    expect(resolveHeaderMedia({ ...base, localHeaderType: "text" })).toBeNull();
  });

  it("tipe dipilih tapi URL kosong → null (tak mengirim header setengah jadi)", () => {
    expect(resolveHeaderMedia({ ...base, inputType: "image" })).toBeNull();
  });
});
