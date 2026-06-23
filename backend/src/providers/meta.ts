import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  MessagingProvider,
  NormalizedInbound,
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
    const components =
      input.bodyParams && input.bodyParams.length
        ? [
            {
              type: "body",
              parameters: input.bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : undefined;

    return this.post({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(components ? { components } : {}),
      },
    });
  }

  async sendText(input: { to: string; text: string }): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { body: input.text },
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
