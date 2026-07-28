import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { registerAuth } from "../src/plugins/authPlugin.js";
import { uploadRoutes } from "../src/routes/uploads.js";
import { env } from "../src/env.js";

// Upload header media: auth wajib, viewer ditolak, MIME di-whitelist, nama file acak,
// dan file yang terunggah bisa diambil kembali lewat /uploads/* (round-trip).

async function build(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerAuth(app);
  await app.register(uploadRoutes);
  // Penyajian statis publik — meniru registrasi di server.ts.
  const root = path.resolve(env.UPLOAD_DIR);
  await mkdir(root, { recursive: true });
  await app.register(fastifyStatic, { root, prefix: "/uploads/", decorateReply: false });
  await app.ready();
  return app;
}

const bearer = (app: FastifyInstance, role: string) => ({
  authorization: `Bearer ${app.jwt.sign({ sub: "u1", role, name: "T" })}`,
});

// Susun body multipart manual untuk inject (tanpa browser/FormData).
function multipartBody(filename: string, mime: string, content: Buffer) {
  const boundary = "----vitestboundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("POST /api/uploads", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await build();
  });
  afterAll(async () => {
    await rm(env.UPLOAD_DIR, { recursive: true, force: true });
  });

  it("tanpa token → 401", async () => {
    const { payload, headers } = multipartBody("a.png", "image/png", Buffer.from([0x89, 0x50]));
    const r = await app.inject({ method: "POST", url: "/api/uploads", headers, payload });
    expect(r.statusCode).toBe(401);
  });

  it("viewer → 403 (hanya-baca)", async () => {
    const { payload, headers } = multipartBody("a.png", "image/png", Buffer.from([0x89, 0x50]));
    const r = await app.inject({
      method: "POST",
      url: "/api/uploads",
      headers: { ...headers, ...bearer(app, "viewer") },
      payload,
    });
    expect(r.statusCode).toBe(403);
  });

  it("MIME di luar whitelist → 400", async () => {
    const { payload, headers } = multipartBody("a.exe", "application/x-msdownload", Buffer.from("MZ"));
    const r = await app.inject({
      method: "POST",
      url: "/api/uploads",
      headers: { ...headers, ...bearer(app, "admin") },
      payload,
    });
    expect(r.statusCode).toBe(400);
  });

  it("PNG valid → 200, path acak /uploads/<uuid>.png (nama asli tak dipakai)", async () => {
    const { payload, headers } = multipartBody("../../jahat.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const r = await app.inject({
      method: "POST",
      url: "/api/uploads",
      headers: { ...headers, ...bearer(app, "admin") },
      payload,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { path: string; mime: string };
    expect(body.path).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(body.mime).toBe("image/png");

    // Round-trip: file bisa diambil kembali PUBLIK (tanpa auth) — dibutuhkan Meta saat kirim.
    const got = await app.inject({ method: "GET", url: body.path });
    expect(got.statusCode).toBe(200);
    expect(got.rawPayload).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});
