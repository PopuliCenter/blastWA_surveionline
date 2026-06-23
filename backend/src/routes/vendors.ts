import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { encryptJson } from "../lib/crypto.js";
import { listProviders, loadProviders } from "../providers/registry.js";

export async function vendorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  // Status semua vendor (terkonfigurasi atau belum) — TANPA membocorkan kredensial
  app.get("/api/vendors", async () => {
    const configs = await prisma.vendorConfig.findMany();
    const byVendor = new Map(configs.map((c) => [c.vendor, c]));
    return listProviders().map((p) => ({
      ...p,
      active: byVendor.get(p.name)?.active ?? true,
      hasStoredCredentials: Boolean(byVendor.get(p.name)?.credentials),
    }));
  });

  // Simpan/timpa kredensial vendor (terenkripsi). Hanya admin/superadmin.
  app.put("/api/vendors/:vendor/credentials", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const vendor = (req.params as { vendor: string }).vendor;
    if (!["meta", "qontak"].includes(vendor)) return reply.code(400).send({ error: "vendor tidak dikenal" });

    const parsed = z.record(z.string(), z.string()).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "credentials harus object string->string" });

    await prisma.vendorConfig.upsert({
      where: { vendor },
      update: { credentials: encryptJson(parsed.data) },
      create: { vendor, credentials: encryptJson(parsed.data) },
    });
    await loadProviders(); // segarkan adapter dengan kredensial baru
    return { ok: true };
  });

  app.put("/api/vendors/:vendor/active", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const vendor = (req.params as { vendor: string }).vendor;
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    await prisma.vendorConfig.upsert({
      where: { vendor },
      update: { active: parsed.data.active },
      create: { vendor, active: parsed.data.active },
    });
    await loadProviders();
    return { ok: true };
  });
}
