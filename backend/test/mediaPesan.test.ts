import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { bisaUnduhMedia, mediaDariPayload, mimeBersih, MAKS_BYTE_MEDIA } from "../src/lib/mediaPesan.js";
import { MetaCloudAdapter } from "../src/providers/meta.js";
import type { HasilUnduhMedia } from "../src/providers/types.js";

// Gambar/stiker di kotak masuk diambil dari Meta SAAT DIBUKA — tidak disimpan di server.

describe("mediaDariPayload", () => {
  it("gambar dan stiker Meta", () => {
    expect(mediaDariPayload({ type: "image", image: { id: "123456", mime_type: "image/jpeg" } })).toEqual({
      jenis: "image",
      id: "123456",
    });
    expect(mediaDariPayload({ type: "sticker", sticker: { id: "987", animated: false } })).toEqual({
      jenis: "sticker",
      id: "987",
    });
  });

  it("bukan gambar/stiker, atau ID yang bukan angka, ditolak", () => {
    expect(mediaDariPayload({ type: "audio", audio: { id: "1" } })).toBeNull();
    expect(mediaDariPayload({ type: "text", text: { body: "halo" } })).toBeNull();
    expect(mediaDariPayload({ image: { id: "../me?fields=x" } })).toBeNull();
    expect(mediaDariPayload(null)).toBeNull();
  });

  it("vendor tak dikenal tidak menggagalkan apa pun", () => {
    expect(
      bisaUnduhMedia(() => {
        throw new Error("Vendor tidak dikenal");
      }),
    ).toBe(false);
    expect(bisaUnduhMedia(() => ({ downloadMedia: async () => null }))).toBe(true);
    expect(bisaUnduhMedia(() => ({}))).toBe(false);
  });

  it("mimeBersih", () => {
    expect(mimeBersih("image/JPEG; charset=binary")).toBe("image/jpeg");
  });
});

describe("MetaCloudAdapter.downloadMedia", () => {
  const meta = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });
  const asli = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = asli;
  });

  it("dua langkah: info media lalu unduh URL-nya, keduanya dengan token", async () => {
    const panggilan: { url: string; auth?: string }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      panggilan.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
      if (url.includes("graph.facebook.com"))
        return new Response(
          JSON.stringify({ url: "https://lookaside.fbsbx.com/x", mime_type: "image/webp", file_size: 3 }),
        );
      return new Response(new Uint8Array([1, 2, 3]));
    }) as never;
    const hasil = await meta.downloadMedia("4242", MAKS_BYTE_MEDIA);
    expect(hasil?.mimeType).toBe("image/webp");
    expect([...hasil!.data]).toEqual([1, 2, 3]);
    expect(panggilan.map((p) => p.url)).toEqual([
      "https://graph.facebook.com/v21.0/4242",
      "https://lookaside.fbsbx.com/x",
    ]);
    expect(panggilan.every((p) => p.auth === "Bearer T")).toBe(true);
  });

  it("kegagalan dibedakan: kedaluwarsa, terlalu besar, gangguan Meta", async () => {
    const jawab = (status: number, body: unknown) =>
      (globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as never);
    jawab(404, {});
    expect(await meta.downloadMedia("4242", MAKS_BYTE_MEDIA)).toEqual({ gagal: "kedaluwarsa" });
    jawab(400, { error: { code: 100, message: "Object does not exist" } });
    expect(await meta.downloadMedia("4242", MAKS_BYTE_MEDIA)).toEqual({ gagal: "kedaluwarsa" });
    // Token kedaluwarsa, batas permintaan, gangguan server: BUKAN "media hilang".
    for (const [status, body] of [
      [401, { error: { code: 190 } }],
      [429, { error: { code: 80007 } }],
      [503, {}],
    ] as const) {
      jawab(status, body);
      expect(await meta.downloadMedia("4242", MAKS_BYTE_MEDIA)).toMatchObject({ gagal: "galat-vendor", status });
    }
    jawab(200, { url: "https://lookaside.fbsbx.com/x", mime_type: "image/jpeg", file_size: 10 });
    expect(await meta.downloadMedia("4242", 5)).toEqual({ gagal: "terlalu-besar" });
  });

  it("ID media yang bukan angka tidak pernah dikirim ke Graph API", async () => {
    globalThis.fetch = vi.fn() as never;
    expect(await meta.downloadMedia("me/messages", MAKS_BYTE_MEDIA)).toMatchObject({ gagal: expect.any(String) });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

// ===== Rute GET /api/messages/:id/media =====

const keadaan: {
  pesan: { direction: string; vendor: string; payload: unknown } | null;
  unduh: (() => Promise<HasilUnduhMedia>) | null;
} = { pesan: null, unduh: null };

vi.mock("../src/db.js", () => ({
  prisma: { message: { findUnique: async () => keadaan.pesan } },
}));
vi.mock("../src/providers/registry.js", () => ({
  getProvider: (v: string) => {
    if (v !== "meta") return {};
    return keadaan.unduh ? { downloadMedia: keadaan.unduh } : {};
  },
}));

async function aplikasi() {
  const { mediaRoutes } = await import("../src/routes/media.js");
  const app = Fastify();
  app.decorate("authenticate", async () => {});
  await app.register(mediaRoutes);
  return app;
}

describe("GET /api/messages/:id/media", () => {
  beforeEach(() => {
    keadaan.pesan = { direction: "in", vendor: "meta", payload: { type: "image", image: { id: "55" } } };
    keadaan.unduh = async () => ({ data: Buffer.from([9, 9]), mimeType: "image/jpeg" });
  });

  it("menyajikan gambar dengan tipe yang benar dan tanpa izin skrip", async () => {
    const r = await (await aplikasi()).inject({ url: "/api/messages/m1/media" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("image/jpeg");
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
    expect([...r.rawPayload]).toEqual([9, 9]);
  });

  it("pesan keluar / bukan gambar → 404", async () => {
    keadaan.pesan = { direction: "out", vendor: "meta", payload: { image: { id: "55" } } };
    expect((await (await aplikasi()).inject({ url: "/api/messages/m1/media" })).statusCode).toBe(404);
    keadaan.pesan = { direction: "in", vendor: "meta", payload: { text: { body: "x" } } };
    expect((await (await aplikasi()).inject({ url: "/api/messages/m1/media" })).statusCode).toBe(404);
  });

  it("vendor tanpa unduhan media → 422 dengan penjelasan", async () => {
    keadaan.pesan = { direction: "in", vendor: "baileys", payload: { image: { id: "55" } } };
    const r = await (await aplikasi()).inject({ url: "/api/messages/m1/media" });
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toContain("Meta");
  });

  it("media kedaluwarsa di Meta → 410; terlalu besar → 413", async () => {
    keadaan.unduh = async () => ({ gagal: "kedaluwarsa" });
    expect((await (await aplikasi()).inject({ url: "/api/messages/m1/media" })).statusCode).toBe(410);
    keadaan.unduh = async () => ({ gagal: "terlalu-besar" });
    expect((await (await aplikasi()).inject({ url: "/api/messages/m1/media" })).statusCode).toBe(413);
  });

  it("gangguan Meta (token, batas permintaan) → 502 'coba lagi', bukan 'sudah tidak tersedia'", async () => {
    keadaan.unduh = async () => ({ gagal: "galat-vendor", status: 401, rincian: { code: 190 } });
    const r = await (await aplikasi()).inject({ url: "/api/messages/m1/media" });
    expect(r.statusCode).toBe(502);
    expect(r.json().error).toContain("Coba lagi");
  });

  it("format yang bisa membawa skrip (SVG) ditolak → 415", async () => {
    keadaan.unduh = async () => ({ data: Buffer.from("<svg/>"), mimeType: "image/svg+xml" });
    expect((await (await aplikasi()).inject({ url: "/api/messages/m1/media" })).statusCode).toBe(415);
  });
});
