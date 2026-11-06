import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanProfileName } from "../lib/profileName.js";
import { iklanDariReferralInstagram } from "../lib/jalurRespons.js";
import { idInstagram } from "../lib/saluranKontak.js";
import { rahasiaCocok } from "../lib/rahasia.js";
import type { MessagingProvider, NormalizedInbound, SendResult, SendTemplateInput, WebhookRequest } from "./types.js";

// Penyambung DM Instagram. Dua cara sambung, dipilih dari ada-tidaknya `pageId`:
//  - Facebook Login (pageId terisi): akun IG terhubung ke Halaman Facebook; kirim lewat
//    graph.facebook.com/{PAGE_ID}/messages dengan token Halaman. Inilah cara yang tersedia
//    untuk aplikasi Meta baru — menu "API setup with Instagram login" sudah tidak muncul.
//  - Instagram Login (pageId kosong): graph.instagram.com dengan token akun IG (60 hari).
// Bentuk webhook dan User Profile API sama untuk keduanya. Lihat docs/RENCANA-INSTAGRAM.md.
//
// Yang SENGAJA tidak ada: sendFlow (Flow hanya ada di WhatsApp — karena metode inilah yang
// tidak ada, mesin survei otomatis memakai mode chatbot untuk Instagram), sendLocationRequest
// (Instagram tidak mengirim lokasi ke webhook), sendTemplate yang sungguhan (Instagram tidak
// punya templat maupun broadcast; bisnis tidak bisa memulai percakapan), sendImage,
// downloadMedia, dan markRead (belum dibutuhkan untuk MVP).

export type InstagramConfig = {
  accessToken?: string;
  // ID akun Instagram profesional. Boleh kosong: token Instagram Login milik akun itu
  // sendiri, jadi "me" menunjuk akun yang sama.
  igUserId?: string;
  // ID Halaman Facebook yang terhubung ke akun IG. Terisi = cara Facebook Login.
  pageId?: string;
  appSecret?: string;
  verifyToken?: string;
  graphVersion: string;
};

// Batas teks satu pesan Instagram: 1.000 BYTE UTF-8, bukan karakter. Kalimat ber-emoji atau
// beraksara non-Latin sudah melewatinya jauh sebelum 1.000 karakter.
export const BATAS_BYTE_IG = 1000;

export class InstagramAdapter implements MessagingProvider {
  readonly name = "instagram";
  constructor(private cfg: InstagramConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.accessToken);
  }

  // Siap menerima DM: tanpa App Secret setiap POST webhook ditolak (gagal tertutup), dan
  // tanpa Verify Token pendaftaran URL callback di Meta ditolak. Token saja belum cukup —
  // halaman Akun Instagram memakai ini supaya tidak menyatakan "terhubung" terlalu dini.
  siapWebhook(): boolean {
    return Boolean(this.cfg.appSecret && this.cfg.verifyToken);
  }

  // Lewat Halaman Facebook? Token Halaman ditolak graph.instagram.com, dan sebaliknya.
  lewatHalaman(): boolean {
    return Boolean(this.cfg.pageId);
  }

  private base(): string {
    const host = this.lewatHalaman() ? "graph.facebook.com" : "graph.instagram.com";
    return `https://${host}/${this.cfg.graphVersion}`;
  }

  private jalurKirim(): string {
    return this.lewatHalaman() ? `/${this.cfg.pageId}/messages` : `/${this.cfg.igUserId || "me"}/messages`;
  }

  private async kirimSatu(to: string, text: string): Promise<SendResult> {
    try {
      const res = await fetch(`${this.base()}${this.jalurKirim()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cfg.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: to }, message: { text } }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return { vendorMessageId: "", status: "failed", raw: json };
      return { vendorMessageId: String(json?.message_id ?? ""), status: "sent", raw: json };
    } catch (e) {
      // Galat jaringan dilaporkan sebagai kiriman gagal, bukan dilempar — pola yang sama
      // dengan vendor lain, supaya pemanggil cukup memeriksa status.
      return { vendorMessageId: "", status: "failed", raw: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  // Teks panjang dipecah dan dikirim berurutan. vendorMessageId = id potongan TERAKHIR:
  // tanda "dilihat" Instagram menunjuk pesan terakhir yang terbaca, jadi id terakhir
  // berarti seluruh potongan sudah terbaca — id pertama hanya membuktikan awal teksnya.
  // Satu potongan gagal → sisanya tidak dikirim (urutan teks yang bolong lebih
  // membingungkan daripada teks yang terputus) dan hasilnya dilaporkan gagal.
  async sendText(input: { to: string; text: string }): Promise<SendResult> {
    if (!this.isConfigured())
      return { vendorMessageId: "", status: "failed", raw: { error: "Access Token Instagram belum diisi." } };
    const penerima = idInstagram(input.to);
    const potongan = pecahTeks(bersihkanMarkup(input.text));
    const hasil: SendResult[] = [];
    for (const teks of potongan) {
      const r = await this.kirimSatu(penerima, teks);
      hasil.push(r);
      if (r.status === "failed") {
        const terkirim = hasil.filter((h) => h.status !== "failed").map((h) => h.vendorMessageId);
        return {
          vendorMessageId: terkirim.at(-1) ?? "",
          status: "failed",
          raw: { potongan: potongan.length, terkirim: terkirim.length, galat: r.raw },
        };
      }
    }
    const akhir = hasil.at(-1);
    return {
      vendorMessageId: akhir?.vendorMessageId ?? "",
      status: akhir ? "sent" : "failed",
      raw: hasil.length === 1 ? akhir?.raw : { potongan: hasil.map((h) => h.raw) },
    };
  }

  async sendTemplate(_input: SendTemplateInput): Promise<SendResult> {
    return {
      vendorMessageId: "",
      status: "failed",
      raw: { error: "Instagram tidak mendukung templat/broadcast" },
    };
  }

  // Nama & username dari User Profile API. Hanya untuk ditampilkan: username bisa diganti
  // kapan saja, jadi identitas tetap IGSID. Gagal (izin belum disetujui, pengguna menutup
  // akses) → null; pemanggil memperlakukannya sebagai "tanpa nama", bukan galat.
  async ambilProfil(igsid: string): Promise<{ name?: string; username?: string } | null> {
    const id = idInstagram(igsid);
    if (!this.isConfigured() || !/^\d{1,32}$/.test(id)) return null;
    try {
      const res = await fetch(`${this.base()}/${id}?fields=name,username`, {
        headers: { Authorization: `Bearer ${this.cfg.accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json().catch(() => ({}))) as { name?: unknown; username?: unknown };
      const name = cleanProfileName(json.name);
      const username =
        typeof json.username === "string" && /^[\w.]{1,30}$/.test(json.username) ? json.username : undefined;
      return name || username ? { ...(name ? { name } : {}), ...(username ? { username } : {}) } : null;
    } catch {
      return null;
    }
  }

  // signed_request dari callback penghapusan data / deauthorize, diverifikasi dengan App
  // Secret akun ini. null = tidak sah (atau App Secret belum diisi — gagal tertutup).
  bacaSignedRequest(signed: unknown): Record<string, unknown> | null {
    return bacaSignedRequest(signed, this.cfg.appSecret);
  }

  verifyWebhook(req: WebhookRequest): boolean | string {
    // GET challenge saat URL callback didaftarkan di dasbor aplikasi
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (req.method !== "POST" && mode === "subscribe" && typeof challenge === "string") {
      return rahasiaCocok(token, this.cfg.verifyToken) ? challenge : false;
    }

    // POST: X-Hub-Signature-256 = sha256=<hmac App Secret Instagram atas body mentah>.
    // Fail-CLOSED bila App Secret belum diisi, sama seperti Meta (ALLOW_UNSIGNED_WEBHOOKS
    // hanya untuk dev/tes).
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
    if (body?.object !== "instagram") return out;
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const akunKita = entry?.id != null ? String(entry.id) : "";
      // Tanda tangan hanya membuktikan event datang dari APLIKASI Meta kita, bukan dari akun
      // IG yang disambungkan. Bila aplikasi yang sama berlangganan untuk akun lain (akun
      // penguji, misalnya), DM ke akun itu tidak boleh memulai survei di sini — balasannya pun
      // tak bisa dikirim, karena IGSID berlaku per akun.
      if (this.cfg.igUserId && akunKita && akunKita !== String(this.cfg.igUserId)) continue;
      const items = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const m of items) {
        const pengirim = m?.sender?.id != null ? String(m.sender.id) : "";
        if (!pengirim) continue;
        // Pesan KITA sendiri. Instagram mengirim salinan (echo) tiap pesan yang dikirim
        // akun bisnis; tanpa penyaring ini bot menjawab dirinya sendiri tanpa henti.
        if (m?.message?.is_echo || (akunKita && pengirim === akunKita)) continue;
        // Reaksi, tanda dibaca, pesan dihapus, dan jenis yang tak didukung API bukan jawaban.
        // Diteruskan, mereka masuk mesin survei sebagai balasan kosong dan pertanyaannya
        // diulang — gejala yang sama dengan reaksi di WhatsApp (lihat meta.ts).
        if (m?.reaction || m?.read || m?.message?.is_deleted || m?.message?.is_unsupported) continue;

        const msg = m?.message;
        const postback = m?.postback;
        if (!msg && !postback && !m?.referral) continue;

        // Iklan Click-to-Direct: referral ikut di pesan pertama (message.referral), atau
        // datang sendiri (messaging.referral) bila orangnya sudah pernah mengobrol.
        const iklan = iklanDariReferralInstagram(msg?.referral) ?? iklanDariReferralInstagram(m?.referral) ?? undefined;

        const lampiran = Array.isArray(msg?.attachments) ? msg.attachments[0] : undefined;
        const mediaType = jenisLampiran(lampiran?.type);
        const text: string | undefined =
          (typeof msg?.text === "string" ? msg.text : undefined) ??
          (typeof msg?.quick_reply?.payload === "string" ? msg.quick_reply.payload : undefined) ??
          (typeof postback?.title === "string" ? postback.title : undefined) ??
          (typeof postback?.payload === "string" ? postback.payload : undefined);

        // Tidak ada yang bisa ditindaklanjuti (mis. hanya menyebut akun kita di story, atau
        // referral tautan ig.me tanpa pesan): dilewati, bukan diteruskan sebagai pesan kosong.
        if (!text && !mediaType && !iklan) continue;

        out.push({
          vendor: this.name,
          kind: "message",
          from: pengirim,
          ...(text !== undefined ? { text } : {}),
          ...(mediaType ? { mediaType } : {}),
          // Instagram tidak memberi ID media yang bisa diunduh ulang, tetapi pertanyaan
          // bertipe Gambar mensyaratkan mediaId (surveyLogic.validateAnswer) — tanpa ini
          // responden IG terkunci di pertanyaan itu. Berawalan "ig:" supaya tidak pernah
          // dikira ID media Meta.
          ...(mediaType && typeof msg?.mid === "string" ? { mediaId: `ig:${msg.mid}` } : {}),
          ...(iklan ? { iklan } : {}),
          messageId:
            typeof msg?.mid === "string" ? msg.mid : typeof postback?.mid === "string" ? postback.mid : undefined,
          timestamp: tsDariMs(m?.timestamp),
          raw: m,
        });
      }
    }
    return out;
  }
}

// signed_request Meta = base64url(tanda tangan) "." base64url(JSON), tanda tangannya
// HMAC-SHA256 atas bagian JSON yang MASIH ter-base64url, dengan App Secret sebagai kunci.
// Dibandingkan dalam waktu konstan; App Secret kosong selalu ditolak, karena tanpa itu
// siapa pun bisa memalsukan permintaan atas nama Meta.
export function bacaSignedRequest(signed: unknown, appSecret: string | undefined): Record<string, unknown> | null {
  if (!appSecret || typeof signed !== "string") return null;
  const [sigB64, isiB64, ...lebih] = signed.trim().split(".");
  if (!sigB64 || !isiB64 || lebih.length) return null;
  const diharapkan = createHmac("sha256", appSecret).update(isiB64, "utf8").digest();
  const diberikan = Buffer.from(sigB64, "base64url");
  if (diharapkan.length !== diberikan.length || !timingSafeEqual(diharapkan, diberikan)) return null;
  try {
    const isi = JSON.parse(Buffer.from(isiB64, "base64url").toString("utf8")) as unknown;
    if (!isi || typeof isi !== "object" || Array.isArray(isi)) return null;
    const algo = (isi as { algorithm?: unknown }).algorithm;
    if (algo !== undefined && String(algo).toUpperCase() !== "HMAC-SHA256") return null;
    return isi as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jenisLampiran(t: unknown): NormalizedInbound["mediaType"] {
  switch (t) {
    case "image":
    case "animated_image_share":
      return "image";
    case "video":
    case "ig_reel":
    case "reel":
      return "video";
    case "audio":
      return "audio";
    case "file":
      return "document";
    default:
      return undefined;
  }
}

function tsDariMs(ts: unknown): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n).toISOString();
  return new Date().toISOString();
}

// Markup WhatsApp (*tebal*, _miring_, ~coret~, ```monospace```) tampil MENTAH di Instagram —
// pertanyaan survei yang ditulis untuk WhatsApp jadi penuh bintang dan garis bawah. Penanda
// hanya dibuang bila berpasangan dan menempel pada kata, seperti aturan WhatsApp sendiri,
// supaya garis bawah di tautan atau nama_berkas dan "2 * 3" tidak ikut hilang.
export function bersihkanMarkup(teks: string): string {
  let s = String(teks ?? "").replace(/```([\s\S]+?)```/g, "$1");
  for (const p of ["\\*", "_", "~"]) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}${p}])${p}(?=\\S)([^\\n]*?\\S)${p}(?![\\p{L}\\p{N}${p}])`, "gu");
    s = s.replace(re, "$1$2");
  }
  return s;
}

const panjangByte = (s: string) => Buffer.byteLength(s, "utf8");

// Pecah teks menjadi potongan ≤ maksByte BYTE UTF-8. Dipotong di akhir baris bila bisa,
// lalu di spasi, baru di tengah kata bila satu kata pun tak muat. Tidak pernah memotong di
// tengah satu karakter (emoji, aksara non-Latin) — potongan yang rusak ditolak Instagram.
export function pecahTeks(teks: string, maksByte = BATAS_BYTE_IG): string[] {
  const hasil: string[] = [];
  let sisa = String(teks ?? "");
  while (panjangByte(sisa) > maksByte) {
    // Indeks string terjauh yang potongan sebelumnya masih muat.
    let byte = 0;
    let batas = 0;
    for (const ch of sisa) {
      const b = panjangByte(ch);
      if (byte + b > maksByte) break;
      byte += b;
      batas += ch.length;
    }
    if (batas === 0) break; // maksByte lebih kecil dari satu karakter — tidak mungkin di 1.000
    const jendela = sisa.slice(0, batas);
    // Akhir baris hanya dipakai bila jatuh di paruh belakang jendela: baris pendek di awal
    // yang disusul paragraf panjang tidak boleh melahirkan satu pesan berisi satu baris.
    const baris = jendela.lastIndexOf("\n");
    const spasi = jendela.lastIndexOf(" ");
    let potong = baris > batas / 2 ? baris : Math.max(baris, spasi);
    if (potong <= 0) potong = batas;
    const bagian = sisa.slice(0, potong).trimEnd();
    if (bagian) hasil.push(bagian);
    sisa = sisa.slice(potong).replace(/^\s+/, "");
  }
  if (sisa.trim()) hasil.push(sisa);
  return hasil;
}
