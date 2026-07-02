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
      .refine(
        (d) =>
          d.vendor === "baileys"
            ? Boolean(d.messageText && d.messageText.trim())
            : Boolean(d.templateName && d.templateName.trim()),
        {
          message: "Vendor resmi wajib 'templateName'; WhatsApp Langsung (baileys) wajib 'messageText'.",
        },
      )
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const blast = await createBlast(parsed.data);
      return reply.code(201).send(blast);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Gagal membuat blast" });
    }
  });

  // Laporan rinci 1 blast: total penerima, rincian per status, daftar nomor gagal + alasan.
  app.get("/api/blasts/:id/report", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const blast = await prisma.blast.findUnique({
      where: { id },
      include: { survey: { select: { title: true } }, segment: { select: { name: true } } },
    });
    if (!blast) return reply.code(404).send({ error: "blast tidak ditemukan" });

    const grouped = await prisma.blastRecipient.groupBy({ by: ["status"], where: { blastId: id }, _count: true });
    const byStatus: Record<string, number> = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const g of grouped) byStatus[g.status] = g._count;
    const recipients = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const failedRows = await prisma.blastRecipient.findMany({
      where: { blastId: id, status: "failed" },
      include: { contact: { select: { phone: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });

    return {
      id: blast.id,
      surveyTitle: blast.survey?.title ?? null,
      segmentName: blast.segment?.name ?? null,
      vendor: blast.vendor,
      status: blast.status,
      messageText: blast.messageText,
      createdAt: blast.createdAt,
      scheduledAt: blast.scheduledAt,
      totals: {
        recipients,
        queued: byStatus.queued,
        sent: byStatus.sent,
        delivered: byStatus.delivered,
        read: byStatus.read,
        failed: byStatus.failed,
      },
      failed: failedRows.map((r) => ({
        phone: r.contact?.phone ?? "-",
        name: r.contact?.name ?? null,
        error: r.error ?? "(tanpa keterangan)",
        updatedAt: r.updatedAt,
      })),
    };
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
