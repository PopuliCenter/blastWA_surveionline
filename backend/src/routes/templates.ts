import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const buttonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
  text: z.string().min(1),
  url: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
  language: z.string().default("id"),
  headerType: z.enum(["none", "text", "image", "document", "video"]).default("none"),
  headerText: z.string().optional().nullable(),
  headerMediaUrl: z.string().optional().nullable(),
  bodyText: z.string().min(1),
  footerText: z.string().optional().nullable(),
  buttons: z.array(buttonSchema).optional(),
  sampleParams: z.array(z.string()).optional(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).default("draft"),
  useCase: z.string().optional().nullable(),
});

// Normalisasi nama template ke format yang diterima Meta: huruf kecil, angka, underscore.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 512) || "template";
}

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/templates", async () => {
    return prisma.messageTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  });

  app.post("/api/templates", async (req, reply) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const tpl = await prisma.messageTemplate.create({
      data: {
        name: normalizeName(d.name),
        category: d.category,
        language: d.language,
        headerType: d.headerType,
        headerText: d.headerText ?? null,
        headerMediaUrl: d.headerMediaUrl ?? null,
        bodyText: d.bodyText,
        footerText: d.footerText ?? null,
        buttons: (d.buttons ?? []) as object,
        sampleParams: d.sampleParams ?? [],
        status: d.status,
        useCase: d.useCase ?? null,
      },
    });
    return reply.code(201).send(tpl);
  });

  app.put("/api/templates/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const tpl = await prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: normalizeName(d.name) } : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.language !== undefined ? { language: d.language } : {}),
        ...(d.headerType !== undefined ? { headerType: d.headerType } : {}),
        ...(d.headerText !== undefined ? { headerText: d.headerText ?? null } : {}),
        ...(d.headerMediaUrl !== undefined ? { headerMediaUrl: d.headerMediaUrl ?? null } : {}),
        ...(d.bodyText !== undefined ? { bodyText: d.bodyText } : {}),
        ...(d.footerText !== undefined ? { footerText: d.footerText ?? null } : {}),
        ...(d.buttons !== undefined ? { buttons: d.buttons as object } : {}),
        ...(d.sampleParams !== undefined ? { sampleParams: d.sampleParams } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.useCase !== undefined ? { useCase: d.useCase ?? null } : {}),
      },
    });
    return tpl;
  });

  app.delete("/api/templates/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  });
}
