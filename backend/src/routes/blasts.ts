import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { createBlast } from "../services/blastService.js";

export async function blastRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/blasts", async () => {
    const blasts = await prisma.blast.findMany({
      orderBy: { createdAt: "desc" },
      include: { survey: { select: { title: true } }, segment: { select: { name: true } } },
    });
    return blasts.map((b) => ({
      id: b.id,
      surveyId: b.surveyId,
      surveyTitle: b.survey?.title ?? "-",
      segmentId: b.segmentId,
      segmentName: b.segment?.name ?? "-",
      vendor: b.vendor,
      status: b.status,
      sentAt: b.scheduledAt ?? b.createdAt,
      sent: b.sentCount,
      delivered: b.deliveredCount,
      opened: b.readCount,
      failed: b.failedCount,
      message: b.messageText,
    }));
  });

  app.post("/api/blasts", async (req, reply) => {
    const parsed = z
      .object({
        surveyId: z.string().optional(),
        segmentId: z.string(),
        vendor: z.enum(["meta", "qontak", "baileys"]).optional(),
        templateName: z.string().optional(), // wajib untuk meta/qontak; tidak dipakai baileys
        templateLang: z.string().optional(),
        messageText: z.string().optional(), // teks langsung (wajib untuk baileys)
        bodyParams: z.array(z.string()).optional(),
        scheduledAt: z.string().optional(),
      })
      // Baileys (templateless) butuh messageText; vendor resmi butuh templateName.
      .refine((d) => (d.vendor === "baileys" ? Boolean(d.messageText && d.messageText.trim()) : Boolean(d.templateName && d.templateName.trim())), {
        message: "Vendor resmi wajib 'templateName'; WhatsApp Langsung (baileys) wajib 'messageText'.",
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const blast = await createBlast(parsed.data);
      return reply.code(201).send(blast);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Gagal membuat blast" });
    }
  });

  app.delete("/api/blasts/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.blast.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/api/blasts/bulk-delete", async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.string()).min(1).max(1000) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const r = await prisma.blast.deleteMany({ where: { id: { in: parsed.data.ids } } });
    return { ok: true, deleted: r.count };
  });
}
