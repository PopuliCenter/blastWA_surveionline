import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { env } from "../env.js";

// Upload file untuk header media template (gambar/dokumen/video).
// File disimpan dengan nama acak (UUID) + ekstensi dari MIME — nama file asli TIDAK
// dipakai sama sekali → aman dari path traversal. Disajikan publik di /uploads/<nama>
// (lihat server.ts) karena Meta harus bisa mengunduh URL-nya saat kirim template.

// Whitelist ketat MIME → ekstensi. Di luar daftar ini ditolak.
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
};

// 10MB — di bawah client_max_body_size 12m di nginx (frontend & edge).
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1 } });
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter); // viewer = hanya-baca

  // Terima 1 file → simpan → balas path publiknya. Frontend menyusun URL absolut
  // dengan apiBase (prod: https://<domain>/uploads/<nama> — bisa diunduh Meta).
  app.post("/api/uploads", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Tidak ada file yang dikirim." });

    const ext = MIME_EXT[file.mimetype];
    if (!ext)
      return reply
        .code(400)
        .send({ error: `Tipe file ${file.mimetype} tidak didukung. Gunakan JPG/PNG/WebP, PDF/Office, atau MP4.` });

    const dir = path.resolve(env.UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    const dest = path.join(dir, name);
    await pipeline(file.file, createWriteStream(dest));

    // Melebihi batas → stream dipotong multipart; buang file parsialnya.
    if (file.file.truncated) {
      await rm(dest, { force: true });
      return reply.code(413).send({ error: "File melebihi batas 10MB." });
    }

    return { path: `/uploads/${name}`, mime: file.mimetype };
  });
}
