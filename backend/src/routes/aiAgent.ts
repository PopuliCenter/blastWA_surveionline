import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { encryptJson } from "../lib/crypto.js";
import { env } from "../env.js";

const DEFAULTS = {
  enabled: false,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  baseUrl: null as string | null,
  systemPrompt: "Anda asisten layanan pelanggan via WhatsApp. Jawab singkat, ramah, dan jelas dalam Bahasa Indonesia.",
};

// Cegah SSRF: base URL provider "custom" wajib https & bukan host internal/loopback/privat.
function isSafeBaseUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (["localhost", "0.0.0.0", "::1"].includes(host)) return false;
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^(fc00:|fd00:|fe80:)/.test(host)) return false;
  return true;
}

export async function aiAgentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter); // viewer = hanya-baca

  // Ambil konfigurasi (TANPA membocorkan API key)
  app.get("/api/ai-agent", async () => {
    const cfg = await prisma.aiConfig.findUnique({ where: { id: "default" } });
    return {
      enabled: cfg?.enabled ?? DEFAULTS.enabled,
      provider: cfg?.provider ?? DEFAULTS.provider,
      model: cfg?.model ?? DEFAULTS.model,
      baseUrl: cfg?.baseUrl ?? "",
      systemPrompt: cfg?.systemPrompt ?? DEFAULTS.systemPrompt,
      hasApiKey: Boolean(cfg?.apiKey) || Boolean(env.ANTHROPIC_API_KEY),
    };
  });

  app.put("/api/ai-agent", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        provider: z.enum(["anthropic", "openai", "gemini", "custom"]).optional(),
        model: z.string().optional(),
        baseUrl: z.string().optional(),
        systemPrompt: z.string().optional(),
        apiKey: z.string().optional(), // bila diisi, simpan terenkripsi
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // Validasi base URL custom (anti-SSRF) bila diisi.
    const bu = parsed.data.baseUrl?.trim();
    if (bu && !isSafeBaseUrl(bu))
      return reply.code(400).send({ error: "Base URL harus https dan bukan alamat internal/privat." });

    const data: Record<string, unknown> = {};
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
    if (parsed.data.provider) data.provider = parsed.data.provider;
    if (parsed.data.model) data.model = parsed.data.model;
    if (parsed.data.baseUrl !== undefined) data.baseUrl = parsed.data.baseUrl || null;
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
