// Abstraksi vendor. Lihat docs/ARCHITECTURE.md §3.
// Semua kode aplikasi memanggil interface ini, TIDAK PERNAH API vendor langsung.

export type SendResult = {
  vendorMessageId: string;
  status: "queued" | "sent" | "failed";
  raw?: unknown;
};

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export type NormalizedInbound = {
  vendor: string;
  kind: "message" | "status";
  from?: string; // E.164 (tanpa +)
  text?: string;
  mediaType?: "image" | "audio" | "video" | "document" | "sticker";
  mediaId?: string;
  messageId?: string;
  refMessageId?: string; // id pesan outbound yang statusnya diupdate
  deliveryStatus?: DeliveryStatus;
  interactiveType?: string; // mis. "nfm_reply" (balasan WhatsApp Flow)
  flowResponse?: Record<string, unknown>; // isi response_json flow (sudah diparse)
  timestamp: string; // ISO 8601
  raw: unknown;
};

export type WebhookRequest = {
  rawBody: string; // body mentah, untuk verifikasi signature
  body: unknown; // body terparse
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
};

export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
  flowToken?: string; // bila template punya tombol Flow → korelasi balasan (broadcast Flow)
}

export interface SendFlowInput {
  to: string;
  flowId: string;
  flowToken: string; // dikembalikan di response_json untuk korelasi
  cta: string; // label tombol pembuka flow
  bodyText: string;
  headerText?: string;
  screen?: string; // id layar awal (default "SURVEY")
}

export interface MessagingProvider {
  readonly name: string;

  /** True jika konfigurasi cukup untuk mengirim pesan. */
  isConfigured(): boolean;

  sendTemplate(input: SendTemplateInput): Promise<SendResult>;
  sendText(input: { to: string; text: string }): Promise<SendResult>;
  /** Kirim pesan interaktif WhatsApp Flow (opsional; hanya vendor yang mendukung). */
  sendFlow?(input: SendFlowInput): Promise<SendResult>;

  /**
   * Verifikasi webhook.
   * - Untuk GET challenge (Meta): kembalikan string challenge bila valid, false bila tidak.
   * - Untuk POST (signature): kembalikan true/false.
   */
  verifyWebhook(req: WebhookRequest): boolean | string;

  parseInbound(req: WebhookRequest): NormalizedInbound[];
}
