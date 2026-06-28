import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  MessagingProvider,
  NormalizedInbound,
  SendFlowInput,
  SendResult,
  SendTemplateInput,
  WebhookRequest,
} from "./types.js";

export type MetaConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  appSecret?: string;
  verifyToken?: string;
  graphVersion: string;
};

export class MetaCloudAdapter implements MessagingProvider {
  readonly name = "meta";
  constructor(private cfg: MetaConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.accessToken && this.cfg.phoneNumberId);
  }

  private endpoint(): string {
    return `https://graph.facebook.com/${this.cfg.graphVersion}/${this.cfg.phoneNumberId}/messages`;
  }

  private async post(body: unknown): Promise<SendResult> {
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cfg.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return { vendorMessageId: "", status: "failed", raw: json };
    }
    const id = json?.messages?.[0]?.id ?? "";
    return { vendorMessageId: id, status: "sent", raw: json };
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const components: unknown[] = [];
    if (input.bodyParams && input.bodyParams.length) {
      components.push({ type: "body", parameters: input.bodyParams.map((text) => ({ type: "text", text })) });
    }
    // Template ber-tombol Flow (broadcast Flow): sisipkan flow_token untuk korelasi balasan.
    if (input.flowToken) {
      components.push({ type: "button", sub_type: "flow", index: "0", parameters: [{ type: "action", action: { flow_token: input.flowToken } }] });
    }

    return this.post({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(components.length ? { components } : {}),
      },
    });
  }

  // Ambil status kualitas & tier nomor dari Graph API (untuk monitoring anti-banned).
  async getPhoneQuality(): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) return { error: "Nomor Meta belum dikonfigurasi" };
    const fields = "quality_rating,name_status,code_verification_status,display_phone_number,verified_name,throughput,platform_type,messaging_limit_tier";
    const url = `https://graph.facebook.com/${this.cfg.graphVersion}/${this.cfg.phoneNumberId}?fields=${fields}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.cfg.accessToken}` } });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return { error: json?.error?.message ?? "Gagal mengambil status nomor", raw: json };
      return json;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Gagal menghubungi Graph API" };
    }
  }

  async sendText(input: { to: string; text: string }): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { body: input.text },
    });
  }

  // Kirim pesan interaktif WhatsApp Flow (formulir native). Hanya valid dalam sesi 24 jam.
  async sendFlow(input: SendFlowInput): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: input.to,
      type: "interactive",
      interactive: {
        type: "flow",
        ...(input.headerText ? { header: { type: "text", text: input.headerText } } : {}),
        body: { text: input.bodyText },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: input.flowToken,
            flow_id: input.flowId,
            flow_cta: input.cta,
            flow_action: "navigate",
            flow_action_payload: { screen: input.screen || "SURVEY" },
          },
        },
      },
    });
  }

  verifyWebhook(req: WebhookRequest): boolean | string {
    // GET challenge dari Meta
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && typeof challenge === "string") {
      return token === this.cfg.verifyToken ? challenge : false;
    }

    // POST: verifikasi X-Hub-Signature-256 = sha256=<hmac>
    if (!this.cfg.appSecret) return true; // bila app secret belum diset, jangan blokir dev (log saja)
    const header = req.headers["x-hub-signature-256"];
    const sig = Array.isArray(header) ? header[0] : header;
    if (!sig || !sig.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", this.cfg.appSecret).update(req.rawBody, "utf8").digest("hex");
    const provided = sig.slice("sha256=".length);
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(provided, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseInbound(req: WebhookRequest): NormalizedInbound[] {
    const out: NormalizedInbound[] = [];
    const body = req.body as any;
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};

        for (const msg of value?.messages ?? []) {
          // Balasan WhatsApp Flow (form terkirim) → parse response_json
          const nfm = msg?.interactive?.type === "nfm_reply" ? msg.interactive.nfm_reply : null;
          let flowResponse: Record<string, unknown> | undefined;
          if (nfm?.response_json) {
            try { flowResponse = JSON.parse(nfm.response_json); } catch { flowResponse = undefined; }
          }
          if (flowResponse) {
            out.push({
              vendor: this.name,
              kind: "message",
              from: msg?.from,
              interactiveType: "nfm_reply",
              flowResponse,
              messageId: msg?.id,
              timestamp: tsFromUnix(msg?.timestamp),
              raw: msg,
            });
            continue;
          }

          const media =
            msg?.image ?? msg?.audio ?? msg?.video ?? msg?.document ?? msg?.sticker;
          const mediaType = msg?.image
            ? "image"
            : msg?.audio
              ? "audio"
              : msg?.video
                ? "video"
                : msg?.document
                  ? "document"
                  : msg?.sticker
                    ? "sticker"
                    : undefined;
          out.push({
            vendor: this.name,
            kind: "message",
            from: msg?.from,
            text:
              msg?.text?.body ??
              msg?.button?.text ??
              msg?.interactive?.list_reply?.title ??
              msg?.interactive?.button_reply?.title ??
              media?.caption,
            mediaType: mediaType as NormalizedInbound["mediaType"],
            mediaId: media?.id,
            messageId: msg?.id,
            timestamp: tsFromUnix(msg?.timestamp),
            raw: msg,
          });
        }

        for (const st of value?.statuses ?? []) {
          out.push({
            vendor: this.name,
            kind: "status",
            refMessageId: st?.id,
            deliveryStatus: mapStatus(st?.status),
            timestamp: tsFromUnix(st?.timestamp),
            raw: st,
          });
        }
      }
    }
    return out;
  }
}

function tsFromUnix(ts: unknown): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  return new Date().toISOString();
}

function mapStatus(s: unknown): NormalizedInbound["deliveryStatus"] {
  switch (s) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return undefined;
  }
}
