import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { adaSurveiBerjalan, bacaModeBot, simpanModeBot } from "../services/modeBot.js";

const ruleSchema = z.object({
  name: z.string().min(1),
  matchType: z.enum(["contains", "exact", "starts"]).default("contains"),
  keyword: z.string().min(1),
  response: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
});

export async function autoReplyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter); // viewer = hanya-baca

  app.get("/api/auto-replies", async () => {
    return prisma.autoReplyRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
  });

  app.post("/api/auto-replies", async (req, reply) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const rule = await prisma.autoReplyRule.create({ data: parsed.data });
    return reply.code(201).send(rule);
  });

  app.put("/api/auto-replies/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const rule = await prisma.autoReplyRule.update({ where: { id }, data: parsed.data });
    return rule;
  });

  app.delete("/api/auto-replies/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.autoReplyRule.delete({ where: { id } });
    return { ok: true };
  });

  // Mode bot (lihat services/modeBot.ts). adaSurveiBerjalan ikut dikirim supaya layar bisa
  // mengatakan apakah bot SAAT INI sedang diam, bukan hanya apa pengaturannya.
  const keadaanModeBot = async () => ({ ...(await bacaModeBot()), adaSurveiBerjalan: await adaSurveiBerjalan() });

  app.get("/api/mode-bot", keadaanModeBot);

  app.put("/api/mode-bot", async (req, reply) => {
    const parsed = z.object({ diamTanpaSurveiAktif: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await simpanModeBot(parsed.data);
    return keadaanModeBot();
  });
}
