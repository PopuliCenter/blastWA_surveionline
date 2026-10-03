import { describe, it, expect } from "vitest";
import { MetaCloudAdapter, deliveryErrorText } from "../src/providers/meta.js";
import { MESSAGE_ALLOWED_FROM } from "../src/lib/deliveryStatus.js";

// Insiden 3 Oktober 2026: pengiriman diblokir Meta karena tagihan belum dibayar. Meta
// tetap MENERIMA panggilan API dan mengembalikan ID pesan, jadi aplikasi mencatat
// "terkirim"; kegagalan antarnya baru dilaporkan belakangan lewat webhook status yang
// waktu itu hanya dipakai untuk blast — dan dibuang untuk pesan lain. Selama berjam-jam
// tidak ada satu pun layar yang bisa menunjukkan pesan tidak sampai ke responden.

const adapter = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });

function webhook(value: unknown) {
  return { rawBody: "", body: { entry: [{ changes: [{ value }] }] }, headers: {}, query: {} };
}

describe("deliveryErrorText", () => {
  it("mendahulukan error_data.details karena di situ sebab spesifiknya ditulis", () => {
    expect(
      deliveryErrorText([
        {
          code: 131049,
          title: "Message failed to send",
          message: "Message failed to send",
          error_data: { details: "This message was not delivered to maintain healthy ecosystem engagement." },
        },
      ]),
    ).toBe("(#131049) This message was not delivered to maintain healthy ecosystem engagement.");
  });

  it("jatuh ke message lalu title bila details tidak ada", () => {
    expect(deliveryErrorText([{ code: 131042, message: "Business eligibility payment issue" }])).toBe(
      "(#131042) Business eligibility payment issue",
    );
    expect(deliveryErrorText([{ title: "Tanpa kode" }])).toBe("Tanpa kode");
  });

  it("mengembalikan undefined bila tak ada galat sama sekali", () => {
    expect(deliveryErrorText(undefined)).toBeUndefined();
    expect(deliveryErrorText([])).toBeUndefined();
    expect(deliveryErrorText([{ code: 1 }])).toBeUndefined();
  });
});

describe("parseInbound — status antar membawa alasan gagal", () => {
  it("menyertakan deliveryError pada status failed", () => {
    const out = adapter.parseInbound(
      webhook({
        statuses: [
          {
            id: "wamid.keluar1",
            status: "failed",
            timestamp: "1759464000",
            errors: [
              {
                code: 131042,
                title: "Business eligibility payment issue",
                error_data: { details: "There was an error related to your payment method." },
              },
            ],
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("status");
    expect(out[0]?.deliveryStatus).toBe("failed");
    expect(out[0]?.deliveryError).toBe("(#131042) There was an error related to your payment method.");
    expect(out[0]?.refMessageId).toBe("wamid.keluar1");
  });

  it("status sukses tetap diparse tanpa alasan gagal", () => {
    const out = adapter.parseInbound(
      webhook({ statuses: [{ id: "wamid.keluar2", status: "delivered", timestamp: "1759464000" }] }),
    );
    expect(out[0]?.deliveryStatus).toBe("delivered");
    expect(out[0]?.deliveryError).toBeUndefined();
  });
});

describe("MESSAGE_ALLOWED_FROM", () => {
  it("tidak pernah memundurkan status yang sudah lebih maju", () => {
    // Callback Meta datang at-least-once dan bisa telat; 'sent' yang menyusul tidak
    // boleh menimpa 'read' yang sudah tercatat.
    expect(MESSAGE_ALLOWED_FROM.sent).not.toContain("read");
    expect(MESSAGE_ALLOWED_FROM.sent).not.toContain("delivered");
    expect(MESSAGE_ALLOWED_FROM.delivered).not.toContain("read");
  });

  it("mengizinkan alur maju yang wajar, termasuk gagal setelah terkirim", () => {
    expect(MESSAGE_ALLOWED_FROM.delivered).toContain("sent");
    expect(MESSAGE_ALLOWED_FROM.read).toContain("delivered");
    expect(MESSAGE_ALLOWED_FROM.failed).toContain("sent");
  });

  it("tidak memuat status yang sama dengan tujuannya — itu tanda callback kembar", () => {
    for (const [tujuan, asal] of Object.entries(MESSAGE_ALLOWED_FROM)) expect(asal).not.toContain(tujuan);
  });
});
