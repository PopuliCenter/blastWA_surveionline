import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuth } from "../src/plugins/authPlugin.js";

// Integrasi ringan: memastikan guard otorisasi bekerja (viewer = hanya-baca).
// Menutup celah P0: banyak route mutasi sebelumnya tanpa cek role.
async function build(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerAuth(app);
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter);
  app.get("/x", async () => ({ ok: true }));
  app.post("/x", async () => ({ ok: true }));
  app.delete("/x", async () => ({ ok: true }));
  await app.ready();
  return app;
}

const bearer = (app: FastifyInstance, role: string) => ({
  authorization: `Bearer ${app.jwt.sign({ sub: "u1", role, name: "T" })}`,
});

describe("requireWriter (guard otorisasi)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await build();
  });

  it("viewer: GET boleh, POST & DELETE ditolak 403", async () => {
    const headers = bearer(app, "viewer");
    expect((await app.inject({ method: "GET", url: "/x", headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/x", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: "/x", headers })).statusCode).toBe(403);
  });

  it("admin: semua metode boleh", async () => {
    const headers = bearer(app, "admin");
    expect((await app.inject({ method: "POST", url: "/x", headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/x", headers })).statusCode).toBe(200);
  });

  it("superadmin: mutasi boleh", async () => {
    const headers = bearer(app, "superadmin");
    expect((await app.inject({ method: "POST", url: "/x", headers })).statusCode).toBe(200);
  });

  it("tanpa token: 401 untuk semua", async () => {
    expect((await app.inject({ method: "GET", url: "/x" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/x" })).statusCode).toBe(401);
  });
});
