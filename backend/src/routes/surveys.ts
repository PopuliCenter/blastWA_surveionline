import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const questionSchema = z.object({
  id: z.string().optional(), // id pertanyaan yang sudah ada (untuk edit non-destruktif)
  text: z.string().min(1),
  type: z.enum(["text", "rating", "number", "choice", "boolean", "image"]).default("text"),
  required: z.boolean().default(true),
  options: z.any().optional(), // rating {min,max} | choice {choices:[...]}
});

const surveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
  triggerEnabled: z.boolean().default(false),
  triggerKeywords: z.array(z.string().min(1)).max(50).default([]),
  questions: z.array(questionSchema).default([]),
});

export async function surveyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/surveys", async () => {
    const surveys = await prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      include: { questions: { orderBy: { order: "asc" } }, _count: { select: { responses: true } } },
    });
    return surveys.map((s) => ({ ...s, responses: s._count.responses }));
  });

  app.post("/api/surveys", async (req, reply) => {
    const parsed = surveySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { questions, ...data } = parsed.data;
    const survey = await prisma.survey.create({
      data: {
        ...data,
        questions: { create: questions.map((q, i) => ({ text: q.text, type: q.type, required: q.required, order: i, options: q.options ?? undefined })) },
      },
      include: { questions: true },
    });
    return reply.code(201).send(survey);
  });

  app.put("/api/surveys/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = surveySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { questions, ...data } = parsed.data;

    // Perbarui pertanyaan secara non-destruktif: pertanyaan lama di-update (id tetap →
    // jawaban responden tidak ikut terhapus), pertanyaan baru dibuat, yang dihapus saja yang dibuang.
    if (questions) {
      const existing = await prisma.question.findMany({ where: { surveyId: id }, select: { id: true } });
      const existingIds = new Set(existing.map((e) => e.id));
      const keepIds = new Set(questions.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id as string));

      const toDelete = [...existingIds].filter((eid) => !keepIds.has(eid));
      if (toDelete.length) await prisma.question.deleteMany({ where: { id: { in: toDelete } } });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const data = { text: q.text, type: q.type, required: q.required, order: i, options: q.options ?? null };
        if (q.id && existingIds.has(q.id)) await prisma.question.update({ where: { id: q.id }, data });
        else await prisma.question.create({ data: { surveyId: id, ...data } });
      }
    }
    const survey = await prisma.survey.update({
      where: { id },
      data,
      include: { questions: { orderBy: { order: "asc" } } },
    });
    return survey;
  });

  app.delete("/api/surveys/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.survey.delete({ where: { id } });
    return { ok: true };
  });

  // Ambil data jawaban survei (per responden).
  app.get("/api/surveys/:id/responses", async (req) => {
    const id = (req.params as { id: string }).id;
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id },
      orderBy: { startedAt: "desc" },
      include: {
        contact: { select: { phone: true, name: true, attributes: true } },
        answers: { include: { question: { select: { text: true, order: true } } } },
      },
    });
    return responses.map((r) => ({
      id: r.id,
      phone: r.contact.phone,
      name: r.contact.name,
      attributes: r.contact.attributes ?? {},
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      answers: r.answers
        .slice()
        .sort((a, b) => (a.question.order ?? 0) - (b.question.order ?? 0))
        .map((a) => ({ question: a.question.text, value: a.value })),
    }));
  });
}
