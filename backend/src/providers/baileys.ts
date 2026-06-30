// Provider "baileys" — gateway WhatsApp TIDAK RESMI (login scan QR, seperti WhatsApp Web).
// ⚠️ Melanggar ToS WhatsApp → ADA RISIKO NOMOR DIBANNED. Pakai untuk nomor uji/non-kritis.
//
// Arsitektur:
//  - Socket Baileys HANYA hidup di SATU proses = BACKEND (server.ts memanggil claimOwnership()+start()).
//  - QR, status, kirim balasan survei/auto-reply → semua jalan di proses backend (socket lokal).
//  - WORKER (pengirim blast) TIDAK punya socket → adapter-nya MENERUSKAN kirim ke backend
//    via endpoint internal POST /internal/baileys/send (lihat routes/baileys.ts).
import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import P from "pino";
import qrcode from "qrcode";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessageContent,
} from "@whiskeysockets/baileys";
import { env } from "../env.js";
import type {
  MessagingProvider,
  NormalizedInbound,
  SendResult,
  SendTemplateInput,
  WebhookRequest,
} from "./types.js";

type GwStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out";
type InboundHandler = (events: NormalizedInbound[]) => Promise<void>;

function extractText(msg: WAMessageContent | null | undefined): string | undefined {
  if (!msg) return undefined;
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.buttonsResponseMessage?.selectedDisplayText ??
    msg.listResponseMessage?.title ??
    msg.templateButtonReplyMessage?.selectedDisplayText ??
    undefined
  );
}

class BaileysGateway {
  private sock: WASocket | null = null;
  private status: GwStatus = "disconnected";
  private qrDataUrl: string | null = null;
  private me: { id: string; name?: string } | null = null;
  private starting = false;
  private owner = false; // true hanya di proses backend (pemilik socket)
  private onInbound: InboundHandler | null = null;
  private readonly authDir = env.BAILEYS_AUTH_DIR;

  /** Tandai proses ini sebagai pemilik socket (dipanggil di server.ts, BUKAN di worker). */
  claimOwnership(): void {
    this.owner = true;
  }
  get isOwner(): boolean {
    return this.owner;
  }
  setInboundHandler(fn: InboundHandler): void {
    this.onInbound = fn;
  }

  /** Ada sesi tersimpan? (untuk auto-start saat boot tanpa scan ulang) */
  hasSession(): boolean {
    try {
      return existsSync(join(this.authDir, "creds.json"));
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.status === "connected" && this.sock != null;
  }

  getState(): { status: GwStatus; qr: string | null; me: { id: string; name?: string } | null; connected: boolean } {
    return { status: this.status, qr: this.qrDataUrl, me: this.me, connected: this.isConnected() };
  }

  async start({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (this.starting) return;
    if (this.sock && !force && (this.status === "connected" || this.status === "connecting" || this.status === "qr")) return;
    this.starting = true;
    try {
      mkdirSync(this.authDir, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const version = await fetchLatestBaileysVersion()
        .then((r) => r.version)
        .catch(() => undefined);

      this.status = "connecting";
      this.qrDataUrl = null;

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: "silent" }) as unknown as Parameters<typeof makeWASocket>[0]["logger"],
        ...(version ? { version } : {}),
        browser: ["Populi WA", "Chrome", "1.0.0"],
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) {
          this.status = "qr";
          this.qrDataUrl = await qrcode.toDataURL(qr).catch(() => null);
        }
        if (connection === "open") {
          this.status = "connected";
          this.qrDataUrl = null;
          this.me = { id: sock.user?.id ?? "", name: sock.user?.name ?? sock.user?.verifiedName ?? undefined };
        }
        if (connection === "close") {
          const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
          this.sock = null;
          if (code === DisconnectReason.loggedOut) {
            this.status = "logged_out";
            this.qrDataUrl = null;
            this.me = null;
            await this.clearAuth(); // sesi tak valid → hapus agar connect berikutnya munculkan QR baru
          } else {
            this.status = "disconnected";
            // Reconnect otomatis (kecuali sengaja logout). Jeda kecil agar tidak rapat.
            setTimeout(() => {
              this.start().catch((e) => console.error("Baileys reconnect gagal:", e));
            }, 2500);
          }
        }
      });

      sock.ev.on("messages.upsert", async (up) => {
        if (up.type !== "notify") return;
        const events: NormalizedInbound[] = [];
        for (const m of up.messages) {
          if (m.key.fromMe) continue;
          const jid = m.key.remoteJid ?? "";
          if (!jid.endsWith("@s.whatsapp.net")) continue; // abaikan grup/broadcast/status
          const text = extractText(m.message);
          if (!text) continue; // v1: hanya pesan teks
          const from = jid.split("@")[0] ?? "";
          const tsNum = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
          events.push({
            vendor: this.name,
            kind: "message",
            from,
            text,
            messageId: m.key.id ?? undefined,
            timestamp: new Date(tsNum * 1000).toISOString(),
            raw: m,
          });
        }
        if (events.length && this.onInbound) {
          await this.onInbound(events).catch((e) => console.error("Baileys inbound gagal:", e));
        }
      });

      // Status pengiriman pesan keluar (untuk laporan blast): 2=sent 3=delivered 4=read 5=played.
      sock.ev.on("messages.update", async (updates) => {
        const events: NormalizedInbound[] = [];
        for (const u of updates) {
          if (!u.key?.fromMe || !u.key?.id) continue;
          const code = Number(u.update?.status);
          const deliveryStatus = code >= 5 ? "read" : code === 4 ? "read" : code === 3 ? "delivered" : code === 2 ? "sent" : undefined;
          if (!deliveryStatus) continue;
          events.push({ vendor: this.name, kind: "status", refMessageId: u.key.id, deliveryStatus, timestamp: new Date().toISOString(), raw: u });
        }
        if (events.length && this.onInbound) {
          await this.onInbound(events).catch((e) => console.error("Baileys status gagal:", e));
        }
      });
    } finally {
      this.starting = false;
    }
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    if (!this.sock || this.status !== "connected") {
      return { vendorMessageId: "", status: "failed", raw: { error: "WhatsApp belum terhubung — scan QR dulu di menu Akun WhatsApp." } };
    }
    const jid = `${to.replace(/\D/g, "")}@s.whatsapp.net`;
    try {
      const sent = await this.sock.sendMessage(jid, { text });
      const id = sent?.key?.id ?? "";
      return { vendorMessageId: id, status: "sent", raw: { id } };
    } catch (e) {
      return { vendorMessageId: "", status: "failed", raw: { error: e instanceof Error ? e.message : "gagal kirim" } };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      /* abaikan */
    }
    this.sock = null;
    this.status = "logged_out";
    this.qrDataUrl = null;
    this.me = null;
    await this.clearAuth();
  }

  private async clearAuth(): Promise<void> {
    await rm(this.authDir, { recursive: true, force: true }).catch(() => {});
  }

  readonly name = "baileys";
}

export const baileysGateway = new BaileysGateway();

/**
 * Adapter MessagingProvider untuk Baileys.
 * - Di proses BACKEND (pemilik): kirim langsung via socket lokal.
 * - Di proses WORKER: teruskan ke backend lewat endpoint internal HTTP.
 */
export class BaileysAdapter implements MessagingProvider {
  readonly name = "baileys";
  readonly templateless = true; // tak ada template Meta — kirim teks apa adanya

  isConfigured(): boolean {
    // Pemilik: terkonfigurasi bila socket sudah connect. Non-pemilik (worker): anggap siap
    // bila ada sesi tersimpan (backend yang akan benar-benar mengirim).
    return baileysGateway.isOwner ? baileysGateway.isConnected() : baileysGateway.hasSession();
  }

  async sendText(input: { to: string; text: string }): Promise<SendResult> {
    if (baileysGateway.isOwner) return baileysGateway.sendText(input.to, input.text);
    return this.forward(input.to, input.text);
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    // Baileys tak punya template tersetujui → kirim teks (sudah dirender di blastService).
    const text = input.bodyParams?.length ? input.bodyParams.join(" ") : input.templateName;
    return this.sendText({ to: input.to, text });
  }

  private async forward(to: string, text: string): Promise<SendResult> {
    const url = `${env.INTERNAL_API_URL}/internal/baileys/send`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.BAILEYS_INTERNAL_TOKEN ? { "x-internal-token": env.BAILEYS_INTERNAL_TOKEN } : {}),
        },
        body: JSON.stringify({ to, text }),
      });
      const json = (await res.json().catch(() => ({}))) as SendResult;
      if (!res.ok) return { vendorMessageId: "", status: "failed", raw: json };
      return json;
    } catch (e) {
      return { vendorMessageId: "", status: "failed", raw: { error: e instanceof Error ? e.message : "forward ke backend gagal" } };
    }
  }

  // Baileys tidak memakai webhook HTTP (pesan masuk via event socket).
  verifyWebhook(_req: WebhookRequest): boolean {
    return true;
  }
  parseInbound(_req: WebhookRequest): NormalizedInbound[] {
    return [];
  }
}
