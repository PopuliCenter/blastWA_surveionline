import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { getProvider, loadProviders } from "../providers/registry.js";

async function usedTodayCount(): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [sent, msgs] = await Promise.all([
    prisma.blastRecipient.count({ where: { status: "sent", updatedAt: { gte: start } } }),
    prisma.message.count({ where: { direction: "out", createdAt: { gte: start } } }),
  ]);
  return sent + msgs;
}

export async function sendingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  // Kebijakan pengiriman (warm-up / batas harian + jitter)
  app.get("/api/sending-policy", async () => {
    const p = await prisma.sendingPolicy.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    return { ...p, usedToday: await usedTodayCount() };
  });

  app.put("/api/sending-policy", async (req, reply) => {
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        dailyLimit: z.number().int().min(1).max(100000).optional(),
        jitterMinMs: z.number().int().min(0).max(60000).optional(),
        jitterMaxMs: z.number().int().min(0).max(120000).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const p = await prisma.sendingPolicy.upsert({ where: { id: "default" }, update: parsed.data, create: { id: "default", ...parsed.data } });
    return { ...p, usedToday: await usedTodayCount() };
  });

  // Status kualitas & tier nomor WhatsApp (Meta Cloud API)
  app.get("/api/wa/quality", async () => {
    await loadProviders();
    const meta = getProvider("meta") as unknown as { getPhoneQuality?: () => Promise<Record<string, unknown>> };
    if (typeof meta.getPhoneQuality !== "function") return { error: "Tidak didukung vendor ini" };
    return meta.getPhoneQuality();
  });

  // Cek koneksi Qontak (validitas token + reachability API)
  app.get("/api/qontak/check", async () => {
    await loadProviders();
    const qontak = getProvider("qontak") as unknown as { checkConnection?: () => Promise<Record<string, unknown>> };
    if (typeof qontak.checkConnection !== "function") return { ok: false, error: "Tidak didukung vendor ini" };
    return qontak.checkConnection();
  });

  // Ringkasan opt-out / consent kontak (untuk dashboard pengaman)
  app.get("/api/contacts-consent-summary", async () => {
    const [total, subscribed, optedOut, bySource] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { subscribed: true } }),
      prisma.contact.count({ where: { subscribed: false } }),
      prisma.contact.groupBy({ by: ["consentSource"], _count: true }),
    ]);
    return { total, subscribed, optedOut, bySource: bySource.map((b) => ({ source: b.consentSource ?? "(tidak diketahui)", count: b._count })) };
  });
}
