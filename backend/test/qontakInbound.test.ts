import { describe, it, expect } from "vitest";
import { QontakAdapter } from "../src/providers/qontak.js";

// Bentuk payload mengikuti dokumentasi resmi Qontak "Message Interaction Webhooks"
// (docs.qontak.com → omnichannel-hub/message-interaction-webhooks). Dulu field nama
// dan nomornya tebakan; tes ini mengunci letak yang terdokumentasi.

const adapter = new QontakAdapter({ baseUrl: "https://service-chat.qontak.com" });

const wrap = (body: unknown) => ({ rawBody: "", body, headers: {}, query: {} });

const pesanPelanggan = {
  id: "msg-uuid-1",
  type: "text",
  room_id: "room-1",
  sender_id: "cust-uuid-9",
  sender_type: "Models::Contact",
  text: "isi survei",
  created_at: "2026-08-01T21:00:00Z",
  room: { id: "room-1", name: "Ayu Lahilote", account_uniq_id: "6282299850928" },
  sender: { name: "Ayu Lahilote" },
  data_event: "receive_message_from_customer",
  webhook_event: "message_interaction",
};

describe("QontakAdapter.parseInbound — payload terdokumentasi", () => {
  it("nomor dari room.account_uniq_id, nama dari sender.name", () => {
    const out = adapter.parseInbound(wrap(pesanPelanggan));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "message",
      from: "6282299850928",
      senderName: "Ayu Lahilote",
      text: "isi survei",
      messageId: "msg-uuid-1",
    });
  });

  it("pesan AGEN sendiri dilewati — bukan pesan pelanggan", () => {
    // Tanpa penjaga ini bot membalas pesannya sendiri, dan UUID agen ikut
    // tersimpan sebagai "nomor telepon".
    const agen = {
      ...pesanPelanggan,
      sender_id: "agent-uuid-1",
      sender_type: "Models::User",
      text: "Terima kasih 🙏",
      data_event: "receive_message_from_agent",
    };
    expect(adapter.parseInbound(wrap(agen))).toHaveLength(0);
  });

  it("payload lama tanpa room/sender tetap terbaca (kandidat cadangan)", () => {
    const lama = { from: "628123", text: "halo", id: "m1", timestamp: "2026-08-01T21:00:00Z" };
    const out = adapter.parseInbound(wrap(lama));
    expect(out[0]).toMatchObject({ kind: "message", from: "628123", text: "halo" });
    expect(out[0]?.senderName).toBeUndefined();
  });

  it("status broadcast_log memakai whatsapp_message_id sebagai cadangan rujukan", () => {
    const log = {
      contact_phone_number: "628123",
      contact_full_name: "Ayu",
      status: "delivered",
      whatsapp_message_id: "wamid.XYZ",
      created_at: "2026-08-01T21:00:00Z",
      data_event: "broadcast_log_status",
    };
    const out = adapter.parseInbound(wrap(log));
    expect(out[0]).toMatchObject({ kind: "status", refMessageId: "wamid.XYZ", deliveryStatus: "delivered" });
  });

  it("nama sampah dari sender.name tetap tersaring", () => {
    const out = adapter.parseInbound(
      wrap({ ...pesanPelanggan, sender: { name: "🌹🌹" }, room: { ...pesanPelanggan.room, name: "🌹🌹" } }),
    );
    expect(out[0]?.senderName).toBeUndefined();
  });
});
