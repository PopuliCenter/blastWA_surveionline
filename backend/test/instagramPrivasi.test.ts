import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";

// Callback privasi Meta (penghapusan data & deauthorize). Basis data ditiru dengan larik log.
const log = vi.hoisted(() => [] as { event: string; status: string; note?: string; createdAt: Date }[]);
vi.mock("../src/db.js", () => ({
  prisma: {
    webhookLog: {
      create: async ({ data }: { data: { event: string; status: string; note?: string } }) => {
        log.push({ ...data, createdAt: new Date("2026-11-06T01:02:03Z") });
      },
      findFirst: async ({ where }: { where: { event: string; status: string; note: string } }) =>
        log.find((l) => l.event === where.event && l.status === where.status && l.note === where.note) ?? null,
    },
  },
}));

const RAHASIA = "rahasia-ig";
vi.mock("../src/providers/registry.js", async () => {
  const { InstagramAdapter } = await import("../src/providers/instagram.js");
  const ig = new InstagramAdapter({ accessToken: "t", appSecret: RAHASIA, graphVersion: "v25.0" });
  return { getProvider: () => ig };
});

const { instagramPrivasiRoutes } = await import("../src/routes/instagramPrivasi.js");

const signed = (isi: unknown, kunci = RAHASIA) => {
  const b = Buffer.from(JSON.stringify(isi)).toString("base64url");
  return `${createHmac("sha256", kunci).update(b).digest("base64url")}.${b}`;
};
const form = (sr: string) => ({
  headers: { "content-type": "application/x-www-form-urlencoded" },
  payload: `signed_request=${encodeURIComponent(sr)}`,
});

describe("callback privasi Instagram", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    await app.register(instagramPrivasiRoutes);
    await app.ready();
  });
  afterAll(() => app.close());

  it("hapus data: signed_request sah → url status + kode, dan halaman status mengenalinya", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhook/instagram/hapus-data",
      ...form(signed({ algorithm: "HMAC-SHA256", user_id: "999", issued_at: 1 })),
    });
    expect(res.statusCode).toBe(200);
    const { url, confirmation_code } = res.json() as { url: string; confirmation_code: string };
    expect(confirmation_code).toMatch(/^[0-9a-f]{16}$/);
    expect(url).toMatch(new RegExp(`/webhook/instagram/hapus-data/${confirmation_code}$`));

    const status = await app.inject({ url: `/webhook/instagram/hapus-data/${confirmation_code}` });
    expect(status.statusCode).toBe(200);
    expect(status.headers["content-type"]).toContain("text/plain");
    expect(status.body).toContain(confirmation_code);

    expect((await app.inject({ url: "/webhook/instagram/hapus-data/0000000000000000" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/webhook/instagram/hapus-data/bukan-kode" })).statusCode).toBe(404);
  });

  it("hapus data: tanda tangan salah → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhook/instagram/hapus-data",
      ...form(signed({ user_id: "999" }, "kunci-lain")),
    });
    expect(res.statusCode).toBe(400);
  });

  it("deauthorize: sah → 200 dan tercatat; salah → 400", async () => {
    const ok = await app.inject({ method: "POST", url: "/webhook/instagram/deauthorize", ...form(signed({ user_id: "999" })) });
    expect(ok.statusCode).toBe(200);
    expect(log.some((l) => l.event === "deauthorize" && l.status === "success")).toBe(true);
    const salah = await app.inject({ method: "POST", url: "/webhook/instagram/deauthorize", ...form("a.b") });
    expect(salah.statusCode).toBe(400);
  });
});
