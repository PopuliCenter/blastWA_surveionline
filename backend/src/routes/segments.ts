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
    // contacts boleh berupa string nomor, ATAU objek {phone, name?, attributes?}
    // sehingga impor file pembobot (demografi) bisa langsung saat membuat segmen.
    const contactItem = z.union([
      z.string(),
      z.object({ phone: z.string(), name: z.string().optional(), attributes: z.record(z.any()).optional() }),
    ]);
    const parsed = z
      .object({ name: z.string().min(1), contacts: z.array(contactItem).default([]) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const items = parsed.data.contacts.map((c) => (typeof c === "string" ? { phone: c } : c));

    const segment = await prisma.segment.create({ data: { name: parsed.data.name } });

    // Upsert kontak (gabung nama + atribut pembobot) lalu link ke segmen
    const seen = new Set<string>();
    const phones: string[] = [];
    for (const item of items) {
      const phone = normalizePhone(item.phone);
      if (!phone || phone.length < 8 || seen.has(phone)) continue;
      seen.add(phone);
      const hasAttrs = item.attributes && Object.keys(item.attributes).length > 0;
      const existing = await prisma.contact.findUnique({ where: { phone } });
      let contactId: string;
      if (existing) {
        const data: Record<string, unknown> = {};
        if (item.name && item.name !== existing.name) data.name = item.name;
        if (hasAttrs) data.attributes = { ...((existing.attributes as Record<string, unknown> | null) ?? {}), ...item.attributes } as object;
        if (Object.keys(data).length) await prisma.contact.update({ where: { phone }, data });
        contactId = existing.id;
      } else {
        const c = await prisma.contact.create({ data: { phone, name: item.name, attributes: hasAttrs ? (item.attributes as object) : undefined, consentSource: "import", consentAt: new Date() } });
        contactId = c.id;
      }
      await prisma.segmentContact.create({ data: { segmentId: segment.id, contactId } });
      phones.push(phone);
    }

    return reply.code(201).send({ id: segment.id, name: segment.name, contacts: phones });
  });

  app.delete("/api/segments/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.segment.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/api/segments/bulk-delete", async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.string()).min(1).max(1000) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const r = await prisma.segment.deleteMany({ where: { id: { in: parsed.data.ids } } });
    return { ok: true, deleted: r.count };
  });
}
