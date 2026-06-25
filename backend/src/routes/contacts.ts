import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { normalizePhone } from "../lib/phone.js";
import { getProvider } from "../providers/registry.js";
import { env } from "../env.js";

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  // Daftar kontak (+ pencarian)
  app.get("/api/contacts", async (req) => {
    const q = (req.query as { search?: string }).search?.trim();
    const contacts = await prisma.contact.findMany({
      where: q ? { OR: [{ phone: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return contacts.map((c) => ({ id: c.id, phone: c.phone, name: c.name, attributes: c.attributes, createdAt: c.createdAt }));
  });

  app.post("/api/contacts", async (req, reply) => {
    const parsed = z.object({ phone: z.string().min(5), name: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const phone = normalizePhone(parsed.data.phone);
    const existing = await prisma.contact.findUnique({ where: { phone } });
    if (existing) return reply.code(409).send({ error: "nomor sudah ada" });
    const c = await prisma.contact.create({ data: { phone, name: parsed.data.name } });
    return reply.code(201).send(c);
  });

  // Impor massal: array {phone, name?}. Nomor dinormalisasi & di-upsert (lewati yang sudah ada).
  app.post("/api/contacts/bulk", async (req, reply) => {
    const parsed = z
      .object({ contacts: z.array(z.object({ phone: z.string().min(5), name: z.string().optional() })).min(1).max(5000) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "format tidak valid" });

    let created = 0, updated = 0, skipped = 0;
    const seen = new Set<string>();
    for (const item of parsed.data.contacts) {
      const phone = normalizePhone(item.phone);
      if (!phone || phone.length < 8 || seen.has(phone)) { skipped++; continue; }
      seen.add(phone);
      const existing = await prisma.contact.findUnique({ where: { phone } });
      if (existing) {
        if (item.name && item.name !== existing.name) { await prisma.contact.update({ where: { phone }, data: { name: item.name } }); updated++; }
        else skipped++;
      } else {
        await prisma.contact.create({ data: { phone, name: item.name } });
        created++;
      }
    }
    return reply.code(201).send({ created, updated, skipped, total: parsed.data.contacts.length });
  });

  app.put("/api/contacts/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ name: z.string().optional(), phone: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.phone) data.phone = normalizePhone(parsed.data.phone);
    const c = await prisma.contact.update({ where: { id }, data });
    return c;
  });

  app.delete("/api/contacts/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.contact.delete({ where: { id } });
    return { ok: true };
  });

  // === Chat / Inbox ===

  // Daftar percakapan (kontak yang punya pesan) + status sesi 24 jam, belum-dibalas, selesai
  const SESSION_MS = 24 * 60 * 60 * 1000;
  app.get("/api/conversations", async () => {
    const contacts = await prisma.contact.findMany({
      where: { messages: { some: {} } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 200,
    });
    const results = await Promise.all(
      contacts.map(async (c) => {
        const [lastInbound, lastOutbound] = await Promise.all([
          prisma.message.findFirst({ where: { contactId: c.id, direction: "in" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
          prisma.message.findFirst({ where: { contactId: c.id, direction: "out" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        ]);
        // "Belum dibalas" = pesan masuk yang lebih baru dari balasan terakhir kita
        const unread = await prisma.message.count({
          where: { contactId: c.id, direction: "in", ...(lastOutbound ? { createdAt: { gt: lastOutbound.createdAt } } : {}) },
        });
        const attrs = (c.attributes as Record<string, unknown> | null) ?? {};
        const sessionExpiresAt = lastInbound ? new Date(new Date(lastInbound.createdAt).getTime() + SESSION_MS) : null;
        return {
          id: c.id,
          phone: c.phone,
          name: c.name,
          lastMessage: c.messages[0]?.text ?? "",
          lastDirection: c.messages[0]?.direction ?? null,
          lastAt: c.messages[0]?.createdAt ?? c.createdAt,
          firstAt: c.createdAt,
          vendor: c.messages[0]?.vendor ?? null,
          lastInboundAt: lastInbound?.createdAt ?? null,
          sessionExpiresAt,
          unread,
          resolved: attrs.chatResolved === true,
        };
      })
    );
    return results.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  });

  // Tandai percakapan selesai / buka kembali (disimpan di attributes — tanpa migrasi)
  app.post("/api/contacts/:id/resolve", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ resolved: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return reply.code(404).send({ error: "kontak tidak ditemukan" });
    const attrs = (contact.attributes as Record<string, unknown> | null) ?? {};
    attrs.chatResolved = parsed.data.resolved;
    attrs.chatResolvedAt = parsed.data.resolved ? new Date().toISOString() : null;
    await prisma.contact.update({ where: { id }, data: { attributes: attrs as object } });
    return { ok: true, resolved: parsed.data.resolved };
  });

  // Catatan internal per percakapan (disimpan di attributes.notes)
  app.get("/api/contacts/:id/notes", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return reply.code(404).send({ error: "kontak tidak ditemukan" });
    const attrs = (contact.attributes as Record<string, unknown> | null) ?? {};
    return Array.isArray(attrs.notes) ? attrs.notes : [];
  });

  app.post("/api/contacts/:id/notes", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ text: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "catatan kosong" });
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return reply.code(404).send({ error: "kontak tidak ditemukan" });
    const attrs = (contact.attributes as Record<string, unknown> | null) ?? {};
    const notes = Array.isArray(attrs.notes) ? (attrs.notes as unknown[]) : [];
    const note = { text: parsed.data.text, at: new Date().toISOString() };
    notes.unshift(note);
    attrs.notes = notes.slice(0, 100);
    await prisma.contact.update({ where: { id }, data: { attributes: attrs as object } });
    return reply.code(201).send(note);
  });

  // Riwayat pesan satu kontak
  app.get("/api/contacts/:id/messages", async (req) => {
    const id = (req.params as { id: string }).id;
    const messages = await prisma.message.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return messages.map((m) => ({ id: m.id, direction: m.direction, text: m.text, vendor: m.vendor, createdAt: m.createdAt }));
  });

  // Kirim pesan teks ke kontak (hanya valid dalam jendela 24 jam sesi)
  app.post("/api/contacts/:id/messages", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "teks kosong" });

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return reply.code(404).send({ error: "kontak tidak ditemukan" });

    // Pilih vendor: vendor pesan terakhir kontak, fallback DEFAULT_VENDOR
    const last = await prisma.message.findFirst({ where: { contactId: id }, orderBy: { createdAt: "desc" } });
    const vendor = last?.vendor ?? env.DEFAULT_VENDOR;

    const result = await getProvider(vendor).sendText({ to: contact.phone, text: parsed.data.text });
    const msg = await prisma.message.create({
      data: {
        contactId: id,
        direction: "out",
        vendor,
        vendorMessageId: result.vendorMessageId || null,
        text: parsed.data.text,
        payload: result.raw as object,
      },
    });
    if (result.status === "failed") return reply.code(502).send({ error: "gagal kirim", detail: result.raw, message: msg });
    return reply.code(201).send(msg);
  });
}
