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
  await prisma.webhookLog
    .create({ data: { vendor, event, status, payload: payload as object, note } })
    .catch(() => {});
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // --- Meta: verifikasi GET (hub.challenge) ---
  app.get("/webhook/meta", async (req, reply) => {
    const provider = getProvider("meta");
    const result = provider.verifyWebhook(toWebhookRequest(req));
    if (typeof result === "string") return reply.code(200).send(result); // echo challenge
    return reply.code(403).send("forbidden");
  });

  // --- Meta: pesan & status ---
  app.post("/webhook/meta", async (req, reply) => {
    await receive("meta", req, reply);
  });

  // --- Qontak: pesan & status ---
  app.post("/webhook/qontak", async (req, reply) => {
    await receive("qontak", req, reply);
  });

  // --- Pola umum BSP lain ---
  app.post("/webhook/:vendor", async (req, reply) => {
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
