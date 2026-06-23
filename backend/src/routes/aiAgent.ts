import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { encryptJson } from "../lib/crypto.js";
import { env } from "../env.js";

const DEFAULTS = {
  enabled: false,
  model: "claude-haiku-4-5-20251001",
  systemPrompt: "Anda asisten layanan pelanggan via WhatsApp. Jawab singkat, ramah, dan jelas dalam Bahasa Indonesia.",
};

export async function aiAgentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  // Ambil konfigurasi (TANPA membocorkan API key)
  app.get("/api/ai-agent", async () => {
    const cfg = await prisma.aiConfig.findUnique({ where: { id: "default" } });
    return {
      enabled: cfg?.enabled ?? DEFAULTS.enabled,
      model: cfg?.model ?? DEFAULTS.model,
      systemPrompt: cfg?.systemPrompt ?? DEFAULTS.systemPrompt,
      hasApiKey: Boolean(cfg?.apiKey) || Boolean(env.ANTHROPIC_API_KEY),
    };
  });

  app.put("/api/ai-agent", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        model: z.string().optional(),
        systemPrompt: z.string().optional(),
        apiKey: z.string().optional(), // bila diisi, simpan terenkripsi
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const data: Record<string, unknown> = {};
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
    if (parsed.data.model) data.model = parsed.data.model;
    if (parsed.data.systemPrompt !== undefined) data.systemPrompt = parsed.data.systemPrompt;
    if (parsed.data.apiKey) data.apiKey = encryptJson(parsed.data.apiKey);

    await prisma.aiConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...DEFAULTS, ...data },
    });
    return { ok: true };
  });
}
