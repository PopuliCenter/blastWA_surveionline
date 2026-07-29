import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import { handleInboundEvents } from "../services/surveyEngine.js";
import type { WebhookRequest } from "../providers/types.js";

function toWebhookRequest(req: FastifyRequest): WebhookRequest {
  return {
    rawBody: (req as unknown as { rawBody?: string }).rawBody ?? "",
    body: req.body,
    headers: req.headers,
    query: req.query as Record<string, unknown>,
  };
}

async function log(vendor: string, event: string, status: string, payload: unknown, note?: string) {
  await prisma.webhookLog.create({ data: { vendor, event, status, payload: payload as object, note } }).catch(() => {});
}

// Plafon rate-limit longgar khusus webhook — menimpa limit global 300/menit/IP.
// Saat blast, Meta mengirim burst callback status (sent/delivered/read) + pesan responden
// dari sedikit IP; 300/menit bisa men-throttle (429) sehingga statistik & balasan bot
// tertunda (Meta me-retry, tapi telat). Sengaja BUKAN pengecualian total: plafon tetap
// ada sebagai pagar banjir karena endpoint ini publik — signature fail-closed, tapi tiap
// percobaan yang gagal pun menulis baris WebhookLog.
//
// 6000/menit (100/detik). Perhitungannya: worker mengirim maksimal 20 pesan/detik
// (queue/worker.ts), dan tiap pesan memicu callback sent lalu delivered yang datang
// bertumpuk → puncak ±40/detik. Plafon lama 3000/menit (50/detik) hanya menyisakan
// margin ~20% pada blast besar; 100/detik memberi ruang 2,5× tanpa melepas pagarnya.
const WEBHOOK_RATE_LIMIT = { config: { rateLimit: { max: 6000, timeWindow: "1 minute" } } };

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // --- Meta: verifikasi GET (hub.challenge) ---
  app.get("/webhook/meta", WEBHOOK_RATE_LIMIT, async (req, reply) => {
    const provider = getProvider("meta");
    const result = provider.verifyWebhook(toWebhookRequest(req));
    if (typeof result === "string") return reply.code(200).send(result); // echo challenge
    return reply.code(403).send("forbidden");
  });

  // --- Meta: pesan & status ---
  app.post("/webhook/meta", WEBHOOK_RATE_LIMIT, async (req, reply) => {
    await receive("meta", req, reply);
  });

  // --- Qontak: pesan & status ---
  app.post("/webhook/qontak", WEBHOOK_RATE_LIMIT, async (req, reply) => {
    await receive("qontak", req, reply);
  });

  // --- Pola umum BSP lain ---
  app.post("/webhook/:vendor", WEBHOOK_RATE_LIMIT, async (req, reply) => {
    const vendor = (req.params as { vendor: string }).vendor;
    if (["meta", "qontak"].includes(vendor)) return; // sudah ditangani di atas
    await receive(vendor, req, reply);
  });

  async function receive(vendor: string, req: FastifyRequest, reply: import("fastify").FastifyReply) {
    let provider;
    try {
      provider = getProvider(vendor);
    } catch {
      await log(vendor, "unknown", "ignored", req.body, "vendor tidak dikenal");
      return reply.code(404).send({ error: "vendor tidak dikenal" });
    }

    const wr = toWebhookRequest(req);
    const valid = provider.verifyWebhook(wr);
    if (valid === false) {
      await log(vendor, "signature", "failed", req.body, "verifikasi signature gagal");
      return reply.code(401).send({ error: "invalid signature" });
    }

    // Balas cepat 200 agar vendor tidak retry, lalu proses async.
    reply.code(200).send({ received: true });

    try {
      const events = provider.parseInbound(wr);
      await log(vendor, events[0]?.kind ?? "empty", "success", req.body, `${events.length} event`);
      await handleInboundEvents(events);
    } catch (err) {
      await log(vendor, "process", "failed", req.body, err instanceof Error ? err.message : "error");
    }
  }
}
