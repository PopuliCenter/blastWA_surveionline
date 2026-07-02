import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { normalizePhone } from "../lib/phone.js";

// Upsert kontak (gabung nama + atribut) lalu link ke segmen. Lewati duplikat & yang sudah ada.
async function addContactsToSegment(
  segmentId: string,
  items: { phone: string; name?: string; attributes?: Record<string, unknown> }[],
): Promise<{ added: number; skipped: number; phones: string[] }> {
  const seen = new Set<string>();
  const phones: string[] = [];
  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const phone = normalizePhone(item.phone);
    if (!phone || phone.length < 8 || seen.has(phone)) {
      skipped++;
      continue;
    }
    seen.add(phone);
    const hasAttrs = item.attributes && Object.keys(item.attributes).length > 0;
    const existing = await prisma.contact.findUnique({ where: { phone } });
    let contactId: string;
    if (existing) {
      const data: Record<string, unknown> = {};
      if (item.name && item.name !== existing.name) data.name = item.name;
      if (hasAttrs)
        data.attributes = {
          ...((existing.attributes as Record<string, unknown> | null) ?? {}),
          ...item.attributes,
        } as object;
      if (Object.keys(data).length) await prisma.contact.update({ where: { phone }, data });
      contactId = existing.id;
    } else {
      const c = await prisma.contact.create({
        data: {
          phone,
          name: item.name,
          attributes: hasAttrs ? (item.attributes as object) : undefined,
          consentSource: "import",
          consentAt: new Date(),
        },
      });
      contactId = c.id;
    }
    // Link bila belum ada (hindari duplikat di segmen)
    const link = await prisma.segmentContact
      .findUnique({ where: { segmentId_contactId: { segmentId, contactId } } })
      .catch(() => null);
    if (link) {
      skipped++;
      continue;
    }
    await prisma.segmentContact.create({ data: { segmentId, contactId } });
    added++;
    phones.push(phone);
  }
  return { added, skipped, phones };
}

const contactItemSchema = z.union([
  z.string(),
  z.object({ phone: z.string(), name: z.string().optional(), attributes: z.record(z.any()).optional() }),
]);
const toItems = (arr: (string | { phone: string; name?: string; attributes?: Record<string, unknown> })[]) =>
  arr.map((c) => (typeof c === "string" ? { phone: c } : c));

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
    const parsed = z
      .object({ name: z.string().min(1), contacts: z.array(contactItemSchema).default([]) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const segment = await prisma.segment.create({ data: { name: parsed.data.name } });
    const { phones } = await addContactsToSegment(segment.id, toItems(parsed.data.contacts));
    return reply.code(201).send({ id: segment.id, name: segment.name, contacts: phones });
  });

  // Ganti nama segmen
  app.put("/api/segments/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "nama tidak valid" });
    const s = await prisma.segment.update({ where: { id }, data: { name: parsed.data.name } });
    return { id: s.id, name: s.name };
  });

  // Tambah kontak ke segmen yang sudah ada (tidak menduplikasi yang sudah tergabung)
  app.post("/api/segments/:id/contacts", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ contacts: z.array(contactItemSchema).min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const segment = await prisma.segment.findUnique({ where: { id } });
    if (!segment) return reply.code(404).send({ error: "segmen tidak ditemukan" });
    const { added, skipped } = await addContactsToSegment(id, toItems(parsed.data.contacts));
    const total = await prisma.segmentContact.count({ where: { segmentId: id } });
    return { ok: true, added, skipped, total };
  });

  // Daftar anggota segmen (detail kontak) — untuk kelola di dalam segmen
  app.get("/api/segments/:id/contacts", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const segment = await prisma.segment.findUnique({
      where: { id },
      include: { contacts: { include: { contact: true }, orderBy: { contact: { createdAt: "desc" } } } },
    });
    if (!segment) return reply.code(404).send({ error: "segmen tidak ditemukan" });
    return {
      id: segment.id,
      name: segment.name,
      contacts: segment.contacts.map((sc) => ({
        id: sc.contact.id,
        phone: sc.contact.phone,
        name: sc.contact.name,
        subscribed: sc.contact.subscribed,
        optOutAt: sc.contact.optOutAt,
        attributes: sc.contact.attributes,
      })),
    };
  });

  // Keluarkan 1 kontak dari segmen (kontaknya TIDAK dihapus, hanya lepas dari segmen ini)
  app.delete("/api/segments/:id/contacts/:contactId", async (req, reply) => {
    const { id, contactId } = req.params as { id: string; contactId: string };
    await prisma.segmentContact.delete({ where: { segmentId_contactId: { segmentId: id, contactId } } }).catch(() => {
      return reply.code(404).send({ error: "kontak tidak ada di segmen ini" });
    });
    const total = await prisma.segmentContact.count({ where: { segmentId: id } });
    return { ok: true, total };
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
