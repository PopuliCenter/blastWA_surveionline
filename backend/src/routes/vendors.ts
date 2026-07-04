import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { encryptJson, decryptJson } from "../lib/crypto.js";
import { listProviders, loadProviders, vendorsWithDecryptError } from "../providers/registry.js";

export async function vendorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter); // viewer = hanya-baca

  // Status semua vendor (terkonfigurasi atau belum) — TANPA membocorkan kredensial
  app.get("/api/vendors", async () => {
    const configs = await prisma.vendorConfig.findMany();
    const byVendor = new Map(configs.map((c) => [c.vendor, c]));
    const decryptFailed = new Set(vendorsWithDecryptError());
    return listProviders().map((p) => ({
      ...p,
      active: byVendor.get(p.name)?.active ?? true,
      hasStoredCredentials: Boolean(byVendor.get(p.name)?.credentials),
      // true = kredensial tersimpan tapi tak bisa didekripsi (CREDENTIALS_ENC_KEY berubah) → minta input ulang.
      decryptError: decryptFailed.has(p.name),
    }));
  });

  // Simpan/timpa kredensial vendor (terenkripsi). Hanya admin/superadmin.
  app.put("/api/vendors/:vendor/credentials", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const vendor = (req.params as { vendor: string }).vendor;
    if (!["meta", "qontak"].includes(vendor)) return reply.code(400).send({ error: "vendor tidak dikenal" });

    const parsed = z.record(z.string(), z.string()).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "credentials harus object string->string" });

    // Gabung dengan kredensial lama: field yang TIDAK dikirim (kosong) tetap dipertahankan,
    // supaya menyimpan sebagian (mis. hanya Verify Token) tidak menghapus Access Token/Phone Number ID.
    const existing = await prisma.vendorConfig.findUnique({ where: { vendor } });
    let merged: Record<string, string> = parsed.data;
    if (existing?.credentials) {
      try {
        const old = decryptJson<Record<string, string>>(existing.credentials);
        merged = { ...old, ...parsed.data };
      } catch {
        // kredensial lama tak bisa didekripsi (mis. CREDENTIALS_ENC_KEY berubah) → pakai yang baru saja
      }
    }

    await prisma.vendorConfig.upsert({
      where: { vendor },
      update: { credentials: encryptJson(merged) },
      create: { vendor, credentials: encryptJson(merged) },
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
