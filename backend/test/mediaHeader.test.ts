import { describe, it, expect } from "vitest";
import {
  mediaHeaderComponent,
  mediaHeaderTemplateComponent,
  headerFormatOf,
  qualityScoreOf,
} from "../src/providers/meta.js";

// Parameter header media kirim template Meta: tanpa ini, template ber-header media
// ditolak Meta (error 132018 "issue with the parameters in your template").

describe("mediaHeaderComponent", () => {
  it("image → parameter header {image:{link}}", () => {
    expect(mediaHeaderComponent("image", "https://x.id/uploads/a.jpg")).toEqual({
      type: "header",
      parameters: [{ type: "image", image: { link: "https://x.id/uploads/a.jpg" } }],
    });
  });

  it("video → parameter header {video:{link}}", () => {
    expect(mediaHeaderComponent("video", "https://x.id/v.mp4")).toEqual({
      type: "header",
      parameters: [{ type: "video", video: { link: "https://x.id/v.mp4" } }],
    });
  });

  it("document → menyertakan filename dari segmen akhir URL (tanpa query)", () => {
    expect(mediaHeaderComponent("document", "https://x.id/uploads/rilis.pdf?v=2")).toEqual({
      type: "header",
      parameters: [{ type: "document", document: { link: "https://x.id/uploads/rilis.pdf?v=2", filename: "rilis.pdf" } }],
    });
  });
});

// Saat MEMBUAT template ber-media, Meta minta format + contoh asset handle
// (hasil Resumable Upload) — bukan link seperti saat mengirim pesan.
describe("mediaHeaderTemplateComponent (pengajuan template)", () => {
  it("image → HEADER/IMAGE dengan example.header_handle", () => {
    expect(mediaHeaderTemplateComponent("image", "4::aW1hZ2U=")).toEqual({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: ["4::aW1hZ2U="] },
    });
  });

  it("document & video → format huruf besar", () => {
    expect((mediaHeaderTemplateComponent("document", "h1") as any).format).toBe("DOCUMENT");
    expect((mediaHeaderTemplateComponent("video", "h2") as any).format).toBe("VIDEO");
  });
});

describe("headerFormatOf (deteksi header dari components Meta)", () => {
  it("HEADER format IMAGE → 'image'", () => {
    const comps = [
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "Halo {{1}}" },
    ];
    expect(headerFormatOf(comps)).toBe("image");
  });

  it("tanpa komponen HEADER → null; components bukan array → null", () => {
    expect(headerFormatOf([{ type: "BODY", text: "x" }])).toBeNull();
    expect(headerFormatOf(undefined)).toBeNull();
  });

  it("format tak dikenal (mis. LOCATION) → null; TEXT → 'text'", () => {
    expect(headerFormatOf([{ type: "HEADER", format: "LOCATION" }])).toBeNull();
    expect(headerFormatOf([{ type: "HEADER", format: "TEXT", text: "Judul" }])).toBe("text");
  });
});

// Dokumentasi Meta tidak memastikan bentuk quality_score → parser harus toleran,
// tapi TIDAK boleh menebak nilai yang tak dikenal (lebih baik null = "belum dinilai").
describe("qualityScoreOf (quality rating template)", () => {
  it("objek {score} → nilai score", () => {
    expect(qualityScoreOf({ score: "GREEN", date: 123 })).toBe("GREEN");
    expect(qualityScoreOf({ score: "red" })).toBe("RED");
  });

  it("string polos → dipakai langsung", () => {
    expect(qualityScoreOf("YELLOW")).toBe("YELLOW");
    expect(qualityScoreOf("UNKNOWN")).toBe("UNKNOWN");
  });

  it("kosong / bentuk tak dikenal → null (jangan menebak)", () => {
    expect(qualityScoreOf(undefined)).toBeNull();
    expect(qualityScoreOf(null)).toBeNull();
    expect(qualityScoreOf({})).toBeNull();
    expect(qualityScoreOf({ score: "MAGENTA" })).toBeNull();
    expect(qualityScoreOf(42)).toBeNull();
  });
});
