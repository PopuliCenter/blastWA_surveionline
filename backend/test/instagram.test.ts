import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  InstagramAdapter,
  bacaSignedRequest,
  bersihkanMarkup,
  pecahTeks,
  BATAS_BYTE_IG,
} from "../src/providers/instagram.js";
import { alamatInstagram, apakahInstagram, idInstagram, saluranDari } from "../src/lib/saluranKontak.js";
import { iklanDariReferralInstagram } from "../src/lib/jalurRespons.js";
import type { WebhookRequest } from "../src/providers/types.js";

const AKUN = "17841400000000000";
const ORANG = "17841400000000001";
const RAHASIA = "rahasia-uji";

const adaptor = (cfg: Partial<ConstructorParameters<typeof InstagramAdapter>[0]> = {}) =>
  new InstagramAdapter({ accessToken: "tok", appSecret: RAHASIA, verifyToken: "vt", graphVersion: "v25.0", ...cfg });

const req = (body: unknown, extra: Partial<WebhookRequest> = {}): WebhookRequest => ({
  rawBody: JSON.stringify(body),
  body,
  headers: {},
  query: {},
  ...extra,
});

const webhook = (...messaging: unknown[]) => ({ object: "instagram", entry: [{ id: AKUN, time: 1, messaging }] });
const pesan = (message: Record<string, unknown>, lain: Record<string, unknown> = {}) => ({
  sender: { id: ORANG },
  recipient: { id: AKUN },
  timestamp: 1730000000000,
  message: { mid: "mid.1", ...message },
  ...lain,
});

describe("saluranKontak", () => {
  it("alamat ig: tidak pernah tertukar dengan nomor HP", () => {
    expect(alamatInstagram(ORANG)).toBe(`ig:${ORANG}`);
    expect(alamatInstagram(`ig:${ORANG}`)).toBe(`ig:${ORANG}`); // tidak berawalan ganda
    expect(apakahInstagram(`ig:${ORANG}`)).toBe(true);
    expect(apakahInstagram("6281234567890")).toBe(false);
    expect(apakahInstagram(null)).toBe(false);
    expect(idInstagram(`ig:${ORANG}`)).toBe(ORANG);
    expect(idInstagram(ORANG)).toBe(ORANG);
    expect(saluranDari(`ig:${ORANG}`)).toBe("instagram");
    expect(saluranDari("6281234567890")).toBe("whatsapp");
  });

  it("awalan dikenali tanpa peduli huruf besar dan spasi, lalu ditulis kanonik", () => {
    for (const v of [`IG:${ORANG}`, ` ig:${ORANG}`, `Ig:${ORANG}`]) {
      expect(apakahInstagram(v)).toBe(true);
      expect(idInstagram(v)).toBe(ORANG);
      expect(alamatInstagram(v)).toBe(`ig:${ORANG}`);
    }
  });
});

describe("parseInbound Instagram", () => {
  it("pesan teks → IGSID polos, mid, waktu dari milidetik", () => {
    const [ev, ...lain] = adaptor().parseInbound(req(webhook(pesan({ text: "isi survei" }))));
    expect(lain).toHaveLength(0);
    expect(ev).toMatchObject({
      vendor: "instagram",
      kind: "message",
      from: ORANG,
      text: "isi survei",
      messageId: "mid.1",
      timestamp: new Date(1730000000000).toISOString(),
    });
    expect(ev!.location).toBeUndefined();
  });

  it("echo (pesan kita sendiri) dan pengirim = akun kita dilewati", () => {
    const echo = pesan({ text: "Pertanyaan 1", is_echo: true });
    const dariAkun = { ...pesan({ text: "x" }), sender: { id: AKUN } };
    expect(adaptor().parseInbound(req(webhook(echo, dariAkun)))).toEqual([]);
  });

  it("reaksi, tanda dibaca, pesan dihapus, dan jenis tak didukung dilewati", () => {
    const evs = adaptor().parseInbound(
      req(
        webhook(
          { sender: { id: ORANG }, reaction: { mid: "m", action: "react", reaction: "love" } },
          { sender: { id: ORANG }, read: { mid: "m" } },
          pesan({ is_deleted: true }),
          pesan({ is_unsupported: true }),
        ),
      ),
    );
    expect(evs).toEqual([]);
  });

  it("quick reply tanpa teks → payload; postback → judul", () => {
    const evs = adaptor().parseInbound(
      req(
        webhook(pesan({ quick_reply: { payload: "2" } }), {
          sender: { id: ORANG },
          timestamp: 1,
          postback: { mid: "mid.pb", title: "Mulai survei", payload: "MULAI" },
        }),
      ),
    );
    expect(evs.map((e) => e.text)).toEqual(["2", "Mulai survei"]);
    expect(evs[1]!.messageId).toBe("mid.pb");
  });

  it("iklan Click-to-Direct di message.referral maupun messaging.referral", () => {
    const iklan = { source: "ADS", type: "OPEN_THREAD", ad_id: "6045", ads_context_data: { ad_title: "Ikut survei" } };
    const [a] = adaptor().parseInbound(req(webhook(pesan({ text: "halo", referral: iklan }))));
    expect(a!.iklan).toEqual({ id: "6045", judul: "Ikut survei" });
    // Referral tanpa pesan (orang yang sudah pernah mengobrol) tetap membawa iklannya.
    const [b] = adaptor().parseInbound(req(webhook({ sender: { id: ORANG }, timestamp: 1, referral: iklan })));
    expect(b).toMatchObject({ from: ORANG, iklan: { id: "6045" } });
    expect(b!.text).toBeUndefined();
  });

  it("referral yang bukan iklan tidak dihitung iklan", () => {
    expect(iklanDariReferralInstagram({ source: "SHORTLINK", ref: "qr1" })).toBeNull();
    expect(iklanDariReferralInstagram({ source: "ADS" })).toBeNull();
    expect(iklanDariReferralInstagram({ source: "ADS", ad_id: "x".repeat(80) })!.id).toHaveLength(64);
    expect(iklanDariReferralInstagram({ source: "ADS", ad_id: 77 })).toEqual({ id: "77", judul: null });
    // referral ig.me tanpa pesan tidak memicu apa pun
    expect(adaptor().parseInbound(req(webhook({ sender: { id: ORANG }, referral: { source: "SHORTLINK" } })))).toEqual(
      [],
    );
  });

  it("lampiran → mediaType; tidak pernah lokasi", () => {
    const evs = adaptor().parseInbound(
      req(
        webhook(
          pesan({ mid: "a", attachments: [{ type: "image", payload: { url: "https://x" } }] }),
          pesan({ mid: "b", attachments: [{ type: "audio", payload: { url: "https://x" } }] }),
          pesan({ mid: "c", attachments: [{ type: "video", payload: { url: "https://x" } }] }),
        ),
      ),
    );
    expect(evs.map((e) => e.mediaType)).toEqual(["image", "audio", "video"]);
    expect(evs.every((e) => e.location === undefined && e.text === undefined)).toBe(true);
  });

  it("body yang bukan Instagram diabaikan", () => {
    expect(adaptor().parseInbound(req({ object: "whatsapp_business_account", entry: [] }))).toEqual([]);
  });
});

describe("parseInbound Instagram — akun dan foto", () => {
  it("event untuk akun IG lain di aplikasi yang sama dilewati", () => {
    const lain = { object: "instagram", entry: [{ id: "999", time: 1, messaging: [pesan({ text: "x" })] }] };
    expect(adaptor({ igUserId: AKUN }).parseInbound(req(lain))).toEqual([]);
    expect(adaptor({ igUserId: AKUN }).parseInbound(req(webhook(pesan({ text: "x" }))))).toHaveLength(1);
  });

  it("foto membawa mediaId berawalan ig:, supaya pertanyaan Gambar bisa dijawab", () => {
    const [ev] = adaptor().parseInbound(
      req(webhook(pesan({ attachments: [{ type: "image", payload: { url: "https://x" } }] }))),
    );
    expect(ev).toMatchObject({ mediaType: "image", mediaId: "ig:mid.1" });
  });
});

describe("verifyWebhook Instagram", () => {
  const tanda = (body: string, kunci = RAHASIA) =>
    `sha256=${createHmac("sha256", kunci).update(body, "utf8").digest("hex")}`;

  it("GET challenge: verify token cocok → challenge, salah → false", () => {
    const q = { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "12345" };
    expect(adaptor().verifyWebhook(req({}, { query: q }))).toBe("12345");
    expect(adaptor().verifyWebhook(req({}, { query: { ...q, "hub.verify_token": "lain" } }))).toBe(false);
    // Verify token belum diisi tidak boleh cocok dengan token kosong.
    expect(
      adaptor({ verifyToken: undefined }).verifyWebhook(req({}, { query: { ...q, "hub.verify_token": undefined } })),
    ).toBe(false);
  });

  it("signature benar diterima, salah ditolak", () => {
    const body = webhook(pesan({ text: "x" }));
    const raw = JSON.stringify(body);
    expect(adaptor().verifyWebhook(req(body, { headers: { "x-hub-signature-256": tanda(raw) } }))).toBe(true);
    expect(adaptor().verifyWebhook(req(body, { headers: { "x-hub-signature-256": tanda(raw, "kunci-lain") } }))).toBe(
      false,
    );
    expect(adaptor().verifyWebhook(req(body, { headers: { "x-hub-signature-256": "sha256=abc" } }))).toBe(false);
    expect(adaptor().verifyWebhook(req(body))).toBe(false);
  });

  it("POST yang menyelipkan hub.* di URL tetap wajib bertanda tangan", () => {
    const q = { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "1" };
    const body = webhook(pesan({ text: "x" }));
    expect(adaptor().verifyWebhook(req(body, { method: "POST", query: q }))).toBe(false);
    expect(adaptor().verifyWebhook(req(body, { method: "GET", query: q }))).toBe("1");
  });

  it("App Secret kosong → gagal tertutup", () => {
    const body = webhook(pesan({ text: "x" }));
    const raw = JSON.stringify(body);
    const prev = process.env.ALLOW_UNSIGNED_WEBHOOKS;
    delete process.env.ALLOW_UNSIGNED_WEBHOOKS;
    try {
      expect(
        adaptor({ appSecret: undefined }).verifyWebhook(req(body, { headers: { "x-hub-signature-256": tanda(raw) } })),
      ).toBe(false);
    } finally {
      if (prev !== undefined) process.env.ALLOW_UNSIGNED_WEBHOOKS = prev;
    }
  });
});

describe("signed_request (penghapusan data / deauthorize)", () => {
  const buat = (isi: unknown, kunci = RAHASIA) => {
    const b = Buffer.from(JSON.stringify(isi)).toString("base64url");
    const s = createHmac("sha256", kunci).update(b).digest("base64url");
    return `${s}.${b}`;
  };

  it("tanda tangan benar → isinya; salah, rusak, atau App Secret kosong → null", () => {
    const isi = { algorithm: "HMAC-SHA256", user_id: "123", issued_at: 1 };
    expect(bacaSignedRequest(buat(isi), RAHASIA)).toEqual(isi);
    expect(bacaSignedRequest(buat(isi, "lain"), RAHASIA)).toBeNull();
    expect(bacaSignedRequest(buat(isi), undefined)).toBeNull();
    expect(bacaSignedRequest("bukan-signed-request", RAHASIA)).toBeNull();
    expect(bacaSignedRequest(buat({ ...isi, algorithm: "MD5" }), RAHASIA)).toBeNull();
    expect(adaptor().bacaSignedRequest(buat(isi))).toEqual(isi);
  });
});

describe("pecahTeks & bersihkanMarkup", () => {
  it("markup WhatsApp dibuang, tapi garis bawah di tautan dan perkalian tetap", () => {
    expect(bersihkanMarkup("*Pertanyaan 1*\n_pilih satu_ ~salah~")).toBe("Pertanyaan 1\npilih satu salah");
    expect(bersihkanMarkup("```kode```")).toBe("kode");
    expect(bersihkanMarkup("https://x.id/nama_berkas_baru")).toBe("https://x.id/nama_berkas_baru");
    expect(bersihkanMarkup("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(bersihkanMarkup("Balas *1*, *2*, atau *3*.")).toBe("Balas 1, 2, atau 3.");
  });

  it("teks pendek tidak dipecah", () => {
    expect(pecahTeks("halo")).toEqual(["halo"]);
  });

  it("dipecah per BYTE (bukan karakter), di batas baris/kata, tanpa merusak emoji", () => {
    const baris = Array.from({ length: 40 }, (_, i) => `${i + 1}. Pilihan jawaban nomor ${i + 1} 😀`);
    const teks = baris.join("\n");
    expect(Buffer.byteLength(teks)).toBeGreaterThan(BATAS_BYTE_IG);
    const potongan = pecahTeks(teks);
    expect(potongan.length).toBeGreaterThan(1);
    for (const p of potongan) {
      expect(Buffer.byteLength(p)).toBeLessThanOrEqual(BATAS_BYTE_IG);
      expect(p).not.toContain("�");
    }
    // Tidak ada baris yang terbelah: gabungan potongan = teks asli.
    expect(potongan.join("\n")).toBe(teks);
  });

  it("satu kata raksasa dipotong di tengah, tetap ≤ batas", () => {
    const potongan = pecahTeks("é".repeat(1500)); // 2 byte per karakter
    expect(potongan.map((p) => Buffer.byteLength(p))).toEqual([1000, 1000, 1000]);
  });
});

describe("sendText Instagram", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("kirim ke /me/messages dengan Bearer, alamat ig: dibuang, markup dibersihkan", async () => {
    const panggilan: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        panggilan.push({ url, init });
        return new Response(JSON.stringify({ recipient_id: ORANG, message_id: "mid.kirim" }), { status: 200 });
      }),
    );
    const r = await adaptor().sendText({ to: `ig:${ORANG}`, text: "*Pertanyaan 1*" });
    expect(r).toMatchObject({ status: "sent", vendorMessageId: "mid.kirim" });
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]!.url).toBe("https://graph.instagram.com/v25.0/me/messages");
    expect((panggilan[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(String(panggilan[0]!.init.body))).toEqual({
      recipient: { id: ORANG },
      message: { text: "Pertanyaan 1" },
    });
  });

  it("lewat Halaman Facebook: graph.facebook.com/{PAGE_ID}/messages, profil di host yang sama", async () => {
    const url: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        url.push(u);
        return new Response(JSON.stringify({ message_id: "m", name: "Siti", username: "siti" }), { status: 200 });
      }),
    );
    const a = adaptor({ pageId: "1122", igUserId: AKUN });
    expect(a.lewatHalaman()).toBe(true);
    await a.sendText({ to: `ig:${ORANG}`, text: "halo" });
    await a.ambilProfil(ORANG);
    expect(url).toEqual([
      "https://graph.facebook.com/v25.0/1122/messages",
      `https://graph.facebook.com/v25.0/${ORANG}?fields=name,username`,
    ]);
  });

  it("teks panjang dikirim berurutan; vendorMessageId = potongan terakhir", async () => {
    let n = 0;
    const isi: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        isi.push(JSON.parse(String(init.body)).message.text);
        return new Response(JSON.stringify({ message_id: `mid.${++n}` }), { status: 200 });
      }),
    );
    const teks = Array.from({ length: 60 }, (_, i) => `Baris ke-${i + 1} dari pertanyaan panjang`).join("\n");
    const r = await adaptor({ igUserId: AKUN }).sendText({ to: ORANG, text: teks });
    expect(isi.length).toBeGreaterThan(1);
    expect(isi.join("\n")).toBe(teks);
    expect(r).toMatchObject({ status: "sent", vendorMessageId: `mid.${isi.length}` });
  });

  it("galat HTTP → failed, tidak dilempar; potongan sisanya tidak dikirim", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "token" } }), { status: 400 }));
    vi.stubGlobal("fetch", f);
    const r = await adaptor().sendText({ to: ORANG, text: "a ".repeat(800) });
    expect(r.status).toBe("failed");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("galat jaringan → failed; token kosong → failed tanpa memanggil API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    expect((await adaptor().sendText({ to: ORANG, text: "x" })).status).toBe("failed");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await adaptor({ accessToken: undefined }).sendText({ to: ORANG, text: "x" })).status).toBe("failed");
    expect(f).not.toHaveBeenCalled();
  });

  it("sendTemplate selalu gagal: Instagram tidak punya templat", async () => {
    const r = await adaptor().sendTemplate({ to: ORANG, templateName: "x", languageCode: "id" });
    expect(r.status).toBe("failed");
    expect(JSON.stringify(r.raw)).toContain("Instagram tidak mendukung templat/broadcast");
  });

  it("adaptor tidak punya Flow maupun permintaan lokasi", () => {
    const a = adaptor() as unknown as Record<string, unknown>;
    expect(a.sendFlow).toBeUndefined();
    expect(a.sendLocationRequest).toBeUndefined();
    expect(adaptor().isConfigured()).toBe(true);
    expect(adaptor({ accessToken: "" }).isConfigured()).toBe(false);
  });
});

describe("ambilProfil Instagram", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("nama & username; gagal → null", async () => {
    const f = vi.fn(async (url: string) => {
      expect(url).toBe(`https://graph.instagram.com/v25.0/${ORANG}?fields=name,username`);
      return new Response(JSON.stringify({ name: "Siti", username: "siti.r" }), { status: 200 });
    });
    vi.stubGlobal("fetch", f);
    expect(await adaptor().ambilProfil(`ig:${ORANG}`)).toEqual({ name: "Siti", username: "siti.r" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );
    expect(await adaptor().ambilProfil(ORANG)).toBeNull();
    expect(await adaptor().ambilProfil("bukan-angka")).toBeNull();
  });
});

describe("verifyWebhook Meta — tantangan hanya lewat GET", () => {
  it("POST dengan hub.* di URL tetap wajib bertanda tangan; token kosong tidak pernah cocok", async () => {
    const { MetaCloudAdapter } = await import("../src/providers/meta.js");
    const meta = (verifyToken?: string) =>
      new MetaCloudAdapter({
        accessToken: "t",
        phoneNumberId: "1",
        appSecret: RAHASIA,
        verifyToken,
        graphVersion: "v23.0",
      } as never);
    const q = { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "1" };
    expect(meta("vt").verifyWebhook(req({}, { method: "POST", query: q }))).toBe(false);
    expect(meta("vt").verifyWebhook(req({}, { method: "GET", query: q }))).toBe("1");
    expect(
      meta(undefined).verifyWebhook(req({}, { method: "GET", query: { ...q, "hub.verify_token": undefined } })),
    ).toBe(false);
  });
});
