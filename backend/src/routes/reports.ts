import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/webhook-logs", async (req, reply) => {
    // Payload webhook memuat PII (nomor + isi pesan) → hanya admin/superadmin.
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return reply.code(403).send({ error: "forbidden" });
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 100), 500);
    const logs = await prisma.webhookLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return logs.map((l) => ({
      id: l.id,
      vendor: l.vendor,
      event: l.event,
      webhookName: l.vendor,
      status: l.status,
      note: l.note,
      payload: l.payload,
      createdAt: l.createdAt,
    }));
  });

  app.get("/api/stats", async () => {
    const [surveys, activeSurveys, responses, responsesCompleted, contacts, segments, blastAgg] = await Promise.all([
      prisma.survey.count(),
      prisma.survey.count({ where: { status: "active" } }),
      prisma.surveyResponse.count(),
      prisma.surveyResponse.count({ where: { completedAt: { not: null } } }),
      prisma.contact.count(),
      prisma.segment.count(),
      prisma.blast.aggregate({
        _sum: { sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
      }),
    ]);
    return {
      surveys,
      activeSurveys,
      responses,
      responsesCompleted,
      contacts,
      segments,
      sent: blastAgg._sum.sentCount ?? 0,
      delivered: blastAgg._sum.deliveredCount ?? 0,
      opened: blastAgg._sum.readCount ?? 0,
      failed: blastAgg._sum.failedCount ?? 0,
    };
  });
}
