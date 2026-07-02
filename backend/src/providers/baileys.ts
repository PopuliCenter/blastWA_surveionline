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
import type { MessagingProvider, NormalizedInbound, SendResult, SendTemplateInput, WebhookRequest } from "./types.js";

type GwStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out";
type InboundHandler = (events: NormalizedInbound[]) => Promise<void>;

// Buka pembungkus umum (disappearing/ephemeral, view-once, edited, dokumen+caption).
function unwrapMessage(msg: WAMessageContent | null | undefined): WAMessageContent | null | undefined {
  let m: any = msg;
  for (let i = 0; i < 4 && m; i++) {
    const inner =
      m.ephemeralMessage?.message ??
      m.viewOnceMessage?.message ??
      m.viewOnceMessageV2?.message ??
      m.viewOnceMessageV2Extension?.message ??
      m.documentWithCaptionMessage?.message ??
      m.editedMessage?.message ??
      m.deviceSentMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function extractText(raw: WAMessageContent | null | undefined): string | undefined {
  const msg: any = unwrapMessage(raw);
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
  private typing = new Map<string, number>(); // phone → kapan status "mengetik" kedaluwarsa (ms)
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
    if (this.sock && !force && (this.status === "connected" || this.status === "connecting" || this.status === "qr"))
      return;
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
        console.log(`[baileys] messages.upsert type=${up.type} jumlah=${up.messages.length}`);
        if (up.type !== "notify") return;
        const events: NormalizedInbound[] = [];
        for (const m of up.messages) {
          const key = m.key as {
            remoteJid?: string | null;
            fromMe?: boolean | null;
            id?: string | null;
            senderPn?: string | null;
            participantPn?: string | null;
          };
          const jid = key.remoteJid ?? "";
          if (key.fromMe) {
            console.log(`[baileys] lewati fromMe (${jid})`);
            continue;
          }
          // Abaikan grup / status / channel — terima chat pribadi (@s.whatsapp.net) & LID (@lid)
          if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) {
            console.log(`[baileys] lewati grup/status (${jid})`);
            continue;
          }
          const text = extractText(m.message);
          if (!text) {
            console.log(`[baileys] lewati tanpa-teks dari ${jid}, tipe=${Object.keys(m.message ?? {}).join(",")}`);
            continue;
          }
          // WhatsApp kini sering pakai LID (@lid) demi privasi → nomor asli ada di senderPn,
          // participantPn, atau peta LID→PN milik socket.
          let phoneJid = "";
          if (jid.endsWith("@s.whatsapp.net")) phoneJid = jid;
          else if (jid.endsWith("@lid")) {
            phoneJid = key.senderPn || key.participantPn || "";
            if (!phoneJid) {
              try {
                phoneJid =
                  (
                    sock as unknown as {
                      signalRepository?: { lidMapping?: { getPNForLID?: (j: string) => string | undefined } };
                    }
                  ).signalRepository?.lidMapping?.getPNForLID?.(jid) || "";
              } catch {
                /* abaikan */
              }
            }
          } else phoneJid = jid;
          const from = ((phoneJid || jid).split("@")[0] ?? "").replace(/\D/g, "");
          console.log(
            `[baileys] masuk jid=${jid} senderPn=${key.senderPn ?? "-"} → nomor=${from || "(tak terdeteksi)"}`,
          );
          if (!from) {
            console.log("[baileys] lewati: nomor tak terdeteksi");
            continue;
          }
          const tsNum = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
          events.push({
            vendor: this.name,
            kind: "message",
            from,
            text,
            messageId: key.id ?? undefined,
            timestamp: new Date(tsNum * 1000).toISOString(),
            raw: m,
          });
        }
        if (events.length)
          console.log(`[baileys] ${events.length} pesan masuk diproses → ${events.map((e) => e.from).join(", ")}`);
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
          const deliveryStatus =
            code >= 5 ? "read" : code === 4 ? "read" : code === 3 ? "delivered" : code === 2 ? "sent" : undefined;
          if (!deliveryStatus) continue;
          events.push({
            vendor: this.name,
            kind: "status",
            refMessageId: u.key.id,
            deliveryStatus,
            timestamp: new Date().toISOString(),
            raw: u,
          });
        }
        if (events.length && this.onInbound) {
          await this.onInbound(events).catch((e) => console.error("Baileys status gagal:", e));
        }
      });

      // Presence (sedang mengetik). Perlu presenceSubscribe(jid) dulu agar event diterima.
      sock.ev.on("presence.update", ({ id, presences }) => {
        const phone = (id?.split("@")[0] ?? "").replace(/\D/g, "");
        if (!phone) return;
        const states = Object.values(presences ?? {}).map((p) => p?.lastKnownPresence);
        const isTyping = states.some((s) => s === "composing" || s === "recording");
        if (isTyping) this.typing.set(phone, Date.now() + 12000);
        else this.typing.delete(phone);
      });
    } finally {
      this.starting = false;
    }
  }

  /** Langganan presence kontak (panggil saat membuka percakapan) agar menerima status mengetik. */
  subscribePresence(phone: string): void {
    const jid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    try {
      this.sock?.presenceSubscribe(jid);
    } catch {
      /* abaikan */
    }
  }

  /** True bila kontak sedang mengetik (dalam 12 detik terakhir). */
  isTyping(phone: string): boolean {
    const exp = this.typing.get(phone.replace(/\D/g, ""));
    return exp != null && exp > Date.now();
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    if (!this.sock || this.status !== "connected") {
      return {
        vendorMessageId: "",
        status: "failed",
        raw: { error: "WhatsApp belum terhubung — scan QR dulu di menu Akun WhatsApp." },
      };
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

  // Cek apakah tiap nomor terdaftar di WhatsApp (pakai onWhatsApp). Jeda kecil anti-banned.
  async checkNumbers(phones: string[]): Promise<{ phone: string; onWhatsApp: boolean }[]> {
    if (!this.sock || this.status !== "connected") {
      throw new Error("WhatsApp Langsung belum terhubung — scan QR dulu.");
    }
    const sock = this.sock;
    const out: { phone: string; onWhatsApp: boolean }[] = [];
    for (const raw of phones) {
      const phone = raw.replace(/\D/g, "");
      if (!phone) continue;
      try {
        const res = await sock.onWhatsApp(phone);
        const first = Array.isArray(res) ? res[0] : undefined;
        out.push({ phone, onWhatsApp: first?.exists === true });
      } catch {
        out.push({ phone, onWhatsApp: false });
      }
      // jeda acak 300–700ms agar pola query tidak rapat (mengurangi risiko diblokir)
      await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 400)));
    }
    return out;
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
      return {
        vendorMessageId: "",
        status: "failed",
        raw: { error: e instanceof Error ? e.message : "forward ke backend gagal" },
      };
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
