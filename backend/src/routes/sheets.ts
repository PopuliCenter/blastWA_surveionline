import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { encryptJson, decryptJson } from "../lib/crypto.js";
import { parseServiceAccount, type ServiceAccount } from "../lib/googleAuth.js";
import { extractSpreadsheetId } from "../lib/sheetRows.js";
import { readSpreadsheetMeta } from "../services/sheetPush.js";
import { enqueueSheetSync } from "../queue/sheetQueue.js";

// Integrasi Google Sheets — konfigurasi singleton (id "default"), kunci service
// account terenkripsi AES-GCM seperti kredensial vendor. Penulisan barisnya sendiri
// dikerjakan worker antrean "sheets", bukan di sini.

export async function sheetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  // Konfigurasi operasional — viewer tidak boleh baca maupun tulis (halamannya juga
  // disembunyikan di UI; ini penjaga sisi server-nya).
  app.addHook("onRequest", app.requireOperator);

  // Status ringkas. Kunci tidak pernah dibocorkan; email service account justru
  // DITAMPILKAN karena user membutuhkannya — spreadsheet harus di-share ke email itu.
  app.get("/api/sheets", async () => {
    const cfg = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
    let serviceAccountEmail: string | null = null;
    if (cfg?.serviceAccountJson) {
      try {
        serviceAccountEmail = parseServiceAccount(decryptJson<string>(cfg.serviceAccountJson)).client_email;
      } catch {
        /* kunci tersimpan tak terbaca → biarkan endpoint test yang melaporkannya */
      }
    }
    const [synced, pending] = await Promise.all([
      prisma.surveyResponse.count({ where: { sheetSyncedAt: { not: null } } }),
      prisma.surveyResponse.count({ where: { completedAt: { not: null }, sheetSyncedAt: null } }),
    ]);
    return {
      enabled: cfg?.enabled ?? false,
      spreadsheetId: cfg?.spreadsheetId ?? "",
      hasKey: Boolean(cfg?.serviceAccountJson),
      serviceAccountEmail,
      synced,
      pending,
    };
  });

  app.put("/api/sheets", async (req, reply) => {
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        spreadsheetId: z.string().max(300).optional(),
        serviceAccountJson: z.string().max(20000).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });

    const data: { enabled?: boolean; spreadsheetId?: string; serviceAccountJson?: string } = {};
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
    // Terima URL lengkap ataupun ID telanjang — user hampir selalu menyalin URL.
    if (parsed.data.spreadsheetId !== undefined) data.spreadsheetId = extractSpreadsheetId(parsed.data.spreadsheetId);
    // Field kosong ≠ hapus (pola kredensial vendor): kunci lama dipertahankan.
    if (parsed.data.serviceAccountJson) {
      try {
        parseServiceAccount(parsed.data.serviceAccountJson); // validasi SEBELUM dienkripsi
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "kunci tidak valid" });
      }
      data.serviceAccountJson = encryptJson(parsed.data.serviceAccountJson);
    }

    const cfg = await prisma.sheetConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });
    return { ok: true, enabled: cfg.enabled };
  });

  // Tes memakai pengaturan TERSIMPAN, dan ikut melaporkan saklar enabled — pelajaran
  // dari tombol Tes Agen AI yang berbunyi "Berhasil" pada agen yang sebenarnya mati.
  app.post("/api/sheets/test", async () => {
    const cfg = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
    const enabled = cfg?.enabled ?? false;
    if (!cfg?.serviceAccountJson) return { ok: false, enabled, error: "Kunci service account belum diisi." };
    if (!cfg.spreadsheetId) return { ok: false, enabled, error: "ID spreadsheet belum diisi." };

    let sa: ServiceAccount;
    try {
      sa = parseServiceAccount(decryptJson<string>(cfg.serviceAccountJson));
    } catch {
      return { ok: false, enabled, error: "Kunci tersimpan tidak bisa dibaca. Tempel ulang lalu simpan." };
    }

    const started = Date.now();
    try {
      const meta = await readSpreadsheetMeta(sa, cfg.spreadsheetId);
      return {
        ok: true,
        enabled,
        ms: Date.now() - started,
        title: meta.title,
        tabs: meta.tabs,
        email: sa.client_email,
      };
    } catch (err) {
      // Pesan Google diteruskan utuh: 403 = belum di-share ke email service account,
      // 404 = ID spreadsheet salah. Itulah dua kegagalan tersering di sini.
      return { ok: false, enabled, email: sa.client_email, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Dorong respons lama yang belum tertulis (fitur baru dinyalakan setelah survei
  // berjalan, atau enqueue sempat gagal). Idempoten — penjaga sheetSyncedAt di worker
  // menjamin satu respons tak pernah jadi dua baris, jadi aman dipencet berulang.
  app.post("/api/sheets/backfill", async (_req, reply) => {
    const cfg = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
    if (!cfg?.enabled || !cfg.spreadsheetId || !cfg.serviceAccountJson) {
      return reply.code(400).send({ error: "Aktifkan integrasi, isi ID spreadsheet, dan kunci service account dulu." });
    }
    const rows = await prisma.surveyResponse.findMany({
      where: { completedAt: { not: null }, sheetSyncedAt: null },
      orderBy: { completedAt: "asc" }, // urutan baris di sheet jadi kronologis
      select: { id: true },
    });
    for (const r of rows) await enqueueSheetSync(r.id);
    return { ok: true, queued: rows.length };
  });
}
