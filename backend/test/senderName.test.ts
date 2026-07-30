import { describe, it, expect } from "vitest";
import { MetaCloudAdapter } from "../src/providers/meta.js";

// Nama profil pengirim datang di value.contacts[], TERPISAH dari value.messages[], dan
// dijodohkan lewat wa_id ↔ msg.from. Kalau penjodohan ini salah, tidak ada galat apa pun —
// namanya cuma hilang diam-diam. Karena itu dites langsung dari payload webhook.

const adapter = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });

function webhook(value: unknown) {
  return { rawBody: "", body: { entry: [{ changes: [{ value }] }] }, headers: {}, query: {} };
}

const pesan = (from: string, extra: Record<string, unknown> = {}) => ({
  from,
  id: `wamid.${from}`,
  timestamp: "1753900000",
  text: { body: "isi survei" },
  ...extra,
});

describe("parseInbound — nama profil pengirim", () => {
  it("menjodohkan nama ke pesan lewat wa_id", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628111", profile: { name: "Ani Suryani" } }],
        messages: [pesan("628111")],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.senderName).toBe("Ani Suryani");
  });

  it("menjodohkan per nomor bila satu webhook memuat beberapa pengirim", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [
          { wa_id: "628111", profile: { name: "Ani" } },
          { wa_id: "628222", profile: { name: "Budi" } },
        ],
        messages: [pesan("628222"), pesan("628111")],
      }),
    );
    // Urutan contacts sengaja dibalik dari urutan messages.
    expect(out.map((e) => [e.from, e.senderName])).toEqual([
      ["628222", "Budi"],
      ["628111", "Ani"],
    ]);
  });

  it("wa_id tidak sepadan → tanpa nama, bukan nama orang lain", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628999", profile: { name: "Bukan Dia" } }],
        messages: [pesan("628111")],
      }),
    );
    expect(out[0]?.senderName).toBeUndefined();
  });

  it("tanpa blok contacts → tanpa nama", () => {
    const out = adapter.parseInbound(webhook({ messages: [pesan("628111")] }));
    expect(out).toHaveLength(1);
    expect(out[0]?.senderName).toBeUndefined();
  });

  it("nama profil sampah disaring", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628111", profile: { name: "." } }],
        messages: [pesan("628111")],
      }),
    );
    expect(out[0]?.senderName).toBeUndefined();
  });

  it("balasan WhatsApp Flow juga membawa nama", () => {
    // Jalur nfm_reply keluar lebih awal (continue), jadi mudah terlewat saat menambah field.
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628111", profile: { name: "Ani Suryani" } }],
        messages: [
          pesan("628111", {
            interactive: { type: "nfm_reply", nfm_reply: { response_json: '{"q1":"A"}' } },
          }),
        ],
      }),
    );
    expect(out[0]?.interactiveType).toBe("nfm_reply");
    expect(out[0]?.senderName).toBe("Ani Suryani");
  });

  it("contacts berbentuk aneh tidak menjatuhkan parser", () => {
    const out = adapter.parseInbound(webhook({ contacts: { wa_id: "628111" }, messages: [pesan("628111")] }));
    expect(out).toHaveLength(1);
    expect(out[0]?.senderName).toBeUndefined();
  });

  it("callback status tidak membawa nama", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628111", profile: { name: "Ani" } }],
        statuses: [{ id: "wamid.X", status: "delivered", timestamp: "1753900000" }],
      }),
    );
    expect(out[0]?.kind).toBe("status");
    expect(out[0]?.senderName).toBeUndefined();
  });
});
