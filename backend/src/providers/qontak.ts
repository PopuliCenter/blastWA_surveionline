import { createHmac, timingSafeEqual } from "node:crypto";
import type { MessagingProvider, NormalizedInbound, SendResult, SendTemplateInput, WebhookRequest } from "./types.js";

// ⚠️ SUMBER KEBENARAN: Postman collection Qontak Anda
//    https://www.postman.com/winter-satellite-337817/
//    Field body & format webhook bisa berbeda antar versi API — sesuaikan di sini.

export type QontakConfig = {
  baseUrl: string;
  accessToken?: string;
  channelIntegrationId?: string;
  webhookSecret?: string;
};

export class QontakAdapter implements MessagingProvider {
  readonly name = "qontak";
  constructor(private cfg: QontakConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.accessToken && this.cfg.channelIntegrationId);
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    // POST {base}/broadcasts/whatsapp/direct
    const params = (input.bodyParams ?? []).map((value, i) => ({
      key: String(i + 1),
      value,
      value_text: value,
    }));

    const res = await fetch(`${this.cfg.baseUrl}/broadcasts/whatsapp/direct`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cfg.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to_number: input.to,
        to_name: input.to,
        message_template_id: input.templateName, // di Qontak ini adalah Template ID
        channel_integration_id: this.cfg.channelIntegrationId,
        language: { code: input.languageCode },
        parameters: { body: params },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { vendorMessageId: "", status: "failed", raw: json };
    const id = json?.data?.id ?? json?.id ?? "";
    return { vendorMessageId: String(id), status: "sent", raw: json };
  }

  // Cek koneksi: panggil endpoint daftar template WhatsApp (butuh token valid).
  // Dipakai tombol "Cek Koneksi" di UI. Transparan: laporkan status apa adanya.
  async checkConnection(): Promise<Record<string, unknown>> {
    if (!this.cfg.accessToken) return { ok: false, error: "Access Token Qontak belum diisi." };
    if (!this.cfg.channelIntegrationId) return { ok: false, error: "Channel Integration ID belum diisi." };
    const url = `${this.cfg.baseUrl}/templates/whatsapp`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.cfg.accessToken}` } });
      const json = (await res.json().catch(() => ({}))) as any;
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          error: "Token tidak valid / kedaluwarsa. Ambil ulang access_token Qontak (OAuth).",
        };
      }
      if (res.ok) {
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        return {
          ok: true,
          status: res.status,
          templates: list.length,
          channelIntegrationId: this.cfg.channelIntegrationId,
        };
      }
      // 404 dll: token mungkin sampai ke Qontak tapi path beda versi API.
      return {
        ok: false,
        status: res.status,
        error:
          json?.error?.messages?.[0] ?? json?.message ?? `Qontak membalas HTTP ${res.status}. Cek base URL/versi API.`,
        raw: json,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Qontak (cek base URL/jaringan)." };
    }
  }

  async sendText(input: { to: string; text: string }): Promise<SendResult> {
    // Pesan teks bebas (dalam 24h window) di Qontak lewat API conversation/room.
    // Endpoint persis tergantung setup Anda — verifikasi di Postman collection.
    // Untuk MVP, kembalikan failed dengan catatan agar tidak diam-diam gagal.
    return {
      vendorMessageId: "",
      status: "failed",
      raw: { note: "sendText Qontak belum diimplementasikan — cek endpoint conversation di Postman", to: input.to },
    };
  }

  verifyWebhook(req: WebhookRequest): boolean {
    // Fail-CLOSED bila secret belum diset (aman default di produksi). Dev/tes: ALLOW_UNSIGNED_WEBHOOKS=true.
    if (!this.cfg.webhookSecret) return process.env.ALLOW_UNSIGNED_WEBHOOKS === "true";
    // Qontak dapat mengirim secret via header signature/authorization — sesuaikan nama header.
    const header = req.headers["x-qontak-signature"] ?? req.headers["x-signature"] ?? req.headers["authorization"];
    const provided = (Array.isArray(header) ? header[0] : header) ?? "";
    // Mode 1: HMAC-SHA256 body dengan secret
    const expected = createHmac("sha256", this.cfg.webhookSecret).update(req.rawBody, "utf8").digest("hex");
    if (safeEqual(provided.replace(/^sha256=/, ""), expected)) return true;
    // Mode 2: secret dikirim apa adanya
    return safeEqual(provided.replace(/^Bearer\s+/i, ""), this.cfg.webhookSecret);
  }

  parseInbound(req: WebhookRequest): NormalizedInbound[] {
    const body = req.body as any;
    // Defensif: dukung beberapa bentuk payload umum Qontak.
    const items: any[] = Array.isArray(body) ? body : body?.data ? [body.data] : [body];
    const out: NormalizedInbound[] = [];

    for (const it of items) {
      if (!it || typeof it !== "object") continue;

      // Update status (sent/delivered/read/failed)
      const statusRaw = it.status ?? it.message_status ?? it.delivery_status;
      if (statusRaw && (it.id || it.message_id)) {
        out.push({
          vendor: this.name,
          kind: "status",
          refMessageId: String(it.id ?? it.message_id),
          deliveryStatus: mapQontakStatus(statusRaw),
          timestamp: it.updated_at ?? it.timestamp ?? new Date().toISOString(),
          raw: it,
        });
        continue;
      }

      // Pesan masuk
      const from = it.from ?? it.sender_id ?? it.phone ?? it.account_uniq_id ?? it.contact?.phone;
      const text = it.text?.body ?? it.text ?? it.message ?? it.data_message?.text ?? it.body;
      if (from || text) {
        out.push({
          vendor: this.name,
          kind: "message",
          from: from ? String(from) : undefined,
          text: typeof text === "string" ? text : undefined,
          messageId: it.id ? String(it.id) : undefined,
          timestamp: it.created_at ?? it.timestamp ?? new Date().toISOString(),
          raw: it,
        });
      }
    }
    return out;
  }
}

function mapQontakStatus(s: unknown): NormalizedInbound["deliveryStatus"] {
  const v = String(s).toLowerCase();
  if (v.includes("read")) return "read";
  if (v.includes("deliver")) return "delivered";
  if (v.includes("sent")) return "sent";
  if (v.includes("fail")) return "failed";
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
