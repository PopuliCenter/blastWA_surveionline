import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const questionSchema = z.object({
  text: z.string().min(1),
  type: z.string().default("text"),
  options: z.any().optional(),
});

const surveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
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
        questions: { create: questions.map((q, i) => ({ text: q.text, type: q.type, order: i, options: q.options })) },
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

    // Ganti pertanyaan bila dikirim
    if (questions) {
      await prisma.question.deleteMany({ where: { surveyId: id } });
      await prisma.question.createMany({
        data: questions.map((q, i) => ({ surveyId: id, text: q.text, type: q.type, order: i, options: q.options })),
      });
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
}
