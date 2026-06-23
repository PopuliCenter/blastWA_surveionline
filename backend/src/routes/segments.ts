import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { normalizePhone } from "../lib/phone.js";

export async function segmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/segments", async () => {
    const segments = await prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
      include: { contacts: { include: { contact: true } } },
    });
    return segments.map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      contacts: s.contacts.map((sc) => sc.contact.phone),
    }));
  });

  app.post("/api/segments", async (req, reply) => {
    const parsed = z
      .object({ name: z.string().min(1), contacts: z.array(z.string()).default([]) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const phones = [...new Set(parsed.data.contacts.map((p) => normalizePhone(p)).filter(Boolean))];

    const segment = await prisma.segment.create({ data: { name: parsed.data.name } });

    // Upsert kontak + link ke segmen
    for (const phone of phones) {
      const contact = await prisma.contact.upsert({ where: { phone }, update: {}, create: { phone } });
      await prisma.segmentContact.create({ data: { segmentId: segment.id, contactId: contact.id } });
    }

    return reply.code(201).send({ id: segment.id, name: segment.name, contacts: phones });
  });

  app.delete("/api/segments/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.segment.delete({ where: { id } });
    return { ok: true };
  });
}
