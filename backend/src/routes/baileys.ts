import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { baileysGateway } from "../providers/baileys.js";

export async function baileysRoutes(app: FastifyInstance): Promise<void> {
  // --- Endpoint INTERNAL (worker → backend) untuk mengirim via socket pemilik. ---
  // TIDAK di-proxy nginx publik (hanya path /api, /webhook, /health yang diproxy),
  // jadi hanya terjangkau dari jaringan internal Docker. Opsional diamankan token.
  app.post("/internal/baileys/send", async (req, reply) => {
    if (env.BAILEYS_INTERNAL_TOKEN) {
      const t = req.headers["x-internal-token"];
      if (t !== env.BAILEYS_INTERNAL_TOKEN) return reply.code(401).send({ error: "unauthorized" });
    }
    const body = (req.body ?? {}) as { to?: string; text?: string };
    if (!body.to) return reply.code(400).send({ error: "field 'to' wajib" });
    return baileysGateway.sendText(body.to, body.text ?? "");
  });

  // --- Endpoint UI (butuh login admin). ---
  await app.register(async (r) => {
    r.addHook("onRequest", app.authenticate);

    // Status koneksi + QR (data URL) bila sedang menunggu scan.
    r.get("/api/baileys/status", async () => baileysGateway.getState());

    // Mulai koneksi (memunculkan QR bila belum ada sesi). Frontend polling status setelahnya.
    r.post("/api/baileys/connect", async (req, reply) => {
      if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
      await baileysGateway.start({ force: false });
      return baileysGateway.getState();
    });

    // Putuskan & hapus sesi (logout dari WhatsApp).
    r.post("/api/baileys/logout", async (req, reply) => {
      if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
      await baileysGateway.logout();
      return baileysGateway.getState();
    });

    // Status "sedang mengetik" kontak (jalur Baileys). Sekaligus langganan presence.
    r.get("/api/baileys/typing/:phone", async (req) => {
      const phone = (req.params as { phone: string }).phone;
      if (!baileysGateway.isConnected()) return { typing: false };
      baileysGateway.subscribePresence(phone); // idempotent — agar event mengetik diterima
      return { typing: baileysGateway.isTyping(phone) };
    });

    // Cek apakah daftar nomor terdaftar di WhatsApp (butuh Baileys terhubung).
    r.post("/api/baileys/check-numbers", async (req, reply) => {
      const parsed = z.object({ phones: z.array(z.string()).min(1).max(1000) }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "daftar nomor tidak valid (maks 1000)" });
      if (!baileysGateway.isConnected())
        return reply
          .code(409)
          .send({ error: "WhatsApp Langsung belum terhubung. Scan QR dulu di kartu WhatsApp Langsung." });
      try {
        return await baileysGateway.checkNumbers(parsed.data.phones);
      } catch (e) {
        return reply.code(502).send({ error: e instanceof Error ? e.message : "gagal cek nomor" });
      }
    });
  });
}
