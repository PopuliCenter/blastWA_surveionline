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
  wabaId?: string; // WhatsApp Business Account ID — untuk ambil daftar template
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
      components.push({
        type: "button",
        sub_type: "flow",
        index: "0",
        parameters: [{ type: "action", action: { flow_token: input.flowToken } }],
      });
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
    const fields =
      "quality_rating,name_status,code_verification_status,display_phone_number,verified_name,throughput,platform_type,messaging_limit_tier";
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

  // Ambil daftar template dari Meta (WABA) — untuk dipilih saat broadcast (hindari salah nama/bahasa).
  async listTemplates(): Promise<Record<string, unknown>> {
    if (!this.cfg.accessToken) return { error: "Access Token Meta belum diisi." };
    if (!this.cfg.wabaId) return { error: "WABA ID belum diisi — isi 'WhatsApp Business Account ID' di kartu Meta." };
    const url = `https://graph.facebook.com/${this.cfg.graphVersion}/${this.cfg.wabaId}/message_templates?fields=name,language,status,category&limit=250`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.cfg.accessToken}` } });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return { error: json?.error?.message ?? "Gagal mengambil template", raw: json };
      const data = Array.isArray(json?.data) ? json.data : [];
      return {
        templates: data.map((t: any) => ({
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category,
        })),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Gagal menghubungi Graph API" };
    }
  }

  // Ajukan template ke Meta untuk direview (POST message_templates). Header media belum didukung.
  async createTemplate(input: {
    name: string;
    language: string;
    category: string;
    headerType?: string;
    headerText?: string | null;
    bodyText: string;
    footerText?: string | null;
    buttons?: { type: string; text: string; url?: string | null; phone?: string | null }[];
    sampleParams?: string[];
  }): Promise<{ ok: boolean; id?: string; status?: string; error?: string; raw?: unknown }> {
    if (!this.cfg.accessToken) return { ok: false, error: "Access Token Meta belum diisi." };
    if (!this.cfg.wabaId) return { ok: false, error: "WABA ID belum diisi di kartu Meta." };
    if (input.headerType && ["image", "document", "video"].includes(input.headerType)) {
      return {
        ok: false,
        error:
          "Header media (gambar/dokumen/video) belum didukung untuk pengajuan otomatis. Pakai header Teks / None, atau ajukan manual di WhatsApp Manager.",
      };
    }

    const maxVar = (s: string) => {
      let m = 0;
      const re = /\{\{(\d+)\}\}/g;
      let x;
      while ((x = re.exec(s || ""))) m = Math.max(m, Number(x[1]) || 0);
      return m;
    };
    const sample = (i: number) => input.sampleParams?.[i] ?? `Contoh${i + 1}`;

    const components: unknown[] = [];
    if (input.headerType === "text" && input.headerText) {
      const comp: any = { type: "HEADER", format: "TEXT", text: input.headerText };
      if (maxVar(input.headerText) > 0) comp.example = { header_text: [sample(0)] };
      components.push(comp);
    }
    const body: any = { type: "BODY", text: input.bodyText };
    const bv = maxVar(input.bodyText);
    if (bv > 0) body.example = { body_text: [Array.from({ length: bv }, (_, i) => sample(i))] };
    components.push(body);
    if (input.footerText) components.push({ type: "FOOTER", text: input.footerText });
    if (input.buttons && input.buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons: input.buttons.map((b) => {
          if (b.type === "URL") return { type: "URL", text: b.text, url: b.url ?? "" };
          if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone ?? "" };
          return { type: "QUICK_REPLY", text: b.text };
        }),
      });
    }

    const url = `https://graph.facebook.com/${this.cfg.graphVersion}/${this.cfg.wabaId}/message_templates`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cfg.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.name, language: input.language, category: input.category, components }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok)
        return {
          ok: false,
          error: json?.error?.error_user_msg || json?.error?.message || "Gagal mengajukan template",
          raw: json,
        };
      return { ok: true, id: json?.id, status: json?.status };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Graph API" };
    }
  }

  // Tandai pesan masuk sebagai dibaca → pelanggan melihat centang biru.
  async markRead(messageId: string): Promise<void> {
    if (!this.isConfigured() || !messageId) return;
    try {
      await fetch(this.endpoint(), {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cfg.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
      });
    } catch {
      /* abaikan — read receipt bersifat best-effort */
    }
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
    // Fail-CLOSED bila App Secret belum diset (aman default di produksi, mis. saat kredensial
    // sesaat gagal didekripsi). Untuk dev/tes tanpa signature, set ALLOW_UNSIGNED_WEBHOOKS=true.
    if (!this.cfg.appSecret) return process.env.ALLOW_UNSIGNED_WEBHOOKS === "true";
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
            try {
              flowResponse = JSON.parse(nfm.response_json);
            } catch {
              flowResponse = undefined;
            }
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

          const media = msg?.image ?? msg?.audio ?? msg?.video ?? msg?.document ?? msg?.sticker;
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
