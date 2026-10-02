import { describe, it, expect } from "vitest";
import { MetaCloudAdapter } from "../src/providers/meta.js";

// Reaksi emoji tiba sebagai pesan biasa di value.messages[], tapi tanpa `text` dan tanpa
// media. Kalau diteruskan, mesin survei membacanya sebagai balasan kosong: dulu itu bisa
// tercatat sebagai jawaban, sekarang memicu pertanyaan diulang. Dua-duanya salah — reaksi
// bukan jawaban. Karena itu disaring sejak di adapter.

const adapter = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });

function webhook(value: unknown) {
  return { rawBody: "", body: { entry: [{ changes: [{ value }] }] }, headers: {}, query: {} };
}

describe("parseInbound — reaksi emoji diabaikan", () => {
  it("tidak menghasilkan event untuk pesan bertipe reaction", () => {
    const out = adapter.parseInbound(
      webhook({
        messages: [
          {
            from: "628111",
            id: "wamid.react1",
            timestamp: "1753900000",
            type: "reaction",
            reaction: { message_id: "wamid.asli", emoji: "👍" },
          },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });

  it("menyaring reaksi tapi meneruskan pesan teks di payload yang sama", () => {
    const out = adapter.parseInbound(
      webhook({
        contacts: [{ wa_id: "628222", profile: { name: "Budi" } }],
        messages: [
          { from: "628222", id: "wamid.r", timestamp: "1753900000", type: "reaction", reaction: { emoji: "❤️" } },
          { from: "628222", id: "wamid.t", timestamp: "1753900001", type: "text", text: { body: "2" } },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("2");
    expect(out[0]?.senderName).toBe("Budi");
  });

  it("tetap meneruskan pesan teks biasa", () => {
    const out = adapter.parseInbound(
      webhook({
        messages: [{ from: "628333", id: "wamid.x", timestamp: "1753900000", type: "text", text: { body: "halo" } }],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("halo");
  });
});
