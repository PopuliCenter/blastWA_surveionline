import { describe, it, expect } from "vitest";
import { MetaCloudAdapter } from "../src/providers/meta.js";

// Banner pesan pembuka survei:
// - mode Flow  -> header interaktif bertipe image (menggantikan header teks; hanya 1 header/pesan)
// - mode Chat  -> pesan bergambar ber-caption (satu pesan, bukan gambar lalu teks terpisah)
// Keduanya dikirim dalam sesi 24 jam sehingga tak butuh template.
//
// Payload diperiksa dengan mencegat fetch — tanpa memanggil Graph API sungguhan.

function captureBody(): { calls: any[]; restore: () => void } {
  const calls: any[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init?: any) => {
    calls.push(JSON.parse(String(init?.body ?? "{}")));
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.TEST" }] }) } as any;
  }) as any;
  return { calls, restore: () => (globalThis.fetch = orig) };
}

const adapter = () =>
  new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });

describe("banner survei — mode Flow (header pesan)", () => {
  it("bannerUrl → header bertipe image", async () => {
    const cap = captureBody();
    try {
      await adapter().sendFlow({
        to: "628",
        flowId: "F1",
        flowToken: "resp_1",
        cta: "Isi Survei",
        bodyText: "Survei Nasional",
        headerImageUrl: "https://wa.populicenter.com/uploads/banner.png",
      });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0].interactive.header).toEqual({
      type: "image",
      image: { link: "https://wa.populicenter.com/uploads/banner.png" },
    });
  });

  it("tanpa banner → tetap header teks bila ada", async () => {
    const cap = captureBody();
    try {
      await adapter().sendFlow({
        to: "628",
        flowId: "F1",
        flowToken: "resp_1",
        cta: "Isi",
        bodyText: "B",
        headerText: "Judul",
      });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0].interactive.header).toEqual({ type: "text", text: "Judul" });
  });

  it("banner + headerText → banner menang (WhatsApp hanya menerima satu header)", async () => {
    const cap = captureBody();
    try {
      await adapter().sendFlow({
        to: "628",
        flowId: "F1",
        flowToken: "resp_1",
        cta: "Isi",
        bodyText: "B",
        headerText: "Judul",
        headerImageUrl: "https://x.id/b.png",
      });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0].interactive.header.type).toBe("image");
  });

  it("tanpa header sama sekali → properti header tidak dikirim", async () => {
    const cap = captureBody();
    try {
      await adapter().sendFlow({ to: "628", flowId: "F1", flowToken: "resp_1", cta: "Isi", bodyText: "B" });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0].interactive.header).toBeUndefined();
  });
});

describe("banner survei — mode Chat (gambar ber-caption)", () => {
  it("sendImage mengirim link + caption dalam SATU pesan", async () => {
    const cap = captureBody();
    try {
      await adapter().sendImage({ to: "628", link: "https://x.id/b.png", caption: "Pertanyaan 1" });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0]).toMatchObject({
      type: "image",
      image: { link: "https://x.id/b.png", caption: "Pertanyaan 1" },
    });
  });

  it("tanpa caption → properti caption tidak dikirim", async () => {
    const cap = captureBody();
    try {
      await adapter().sendImage({ to: "628", link: "https://x.id/b.png" });
    } finally {
      cap.restore();
    }
    expect(cap.calls[0].image.caption).toBeUndefined();
  });
});
