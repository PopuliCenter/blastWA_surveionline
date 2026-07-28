import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { webhookRoutes } from "../src/routes/webhooks.js";
import { loadProviders } from "../src/providers/registry.js";

// Saat blast, Meta mengirim burst callback (sent/delivered/read) + pesan responden dari
// sedikit IP — bisa >300/menit. Route webhook memakai plafon longgar (3000/menit) yang
// menimpa limit global 300/menit; tanpa override itu, hit ke-301 dari IP yang sama kena
// 429 dan statistik/balasan bot tertunda. Test memakai route webhook ASLI (bukan replika).
async function build(): Promise<FastifyInstance> {
  await loadProviders(); // tanpa DB: query VendorConfig .catch(()=>[]) → fallback provider dari env
  const app = Fastify();
  // Meniru registrasi di server.ts: limiter global 300/menit.
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  await app.register(webhookRoutes);
  app.get("/ctl", async () => ({ ok: true })); // kontrol: route biasa tetap kena limit global
  await app.ready();
  return app;
}

describe("rate limit webhook (plafon longgar 3000/menit)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await build();
  });

  it("310 hit /webhook/meta semenit → tak ada 429 (semua 403: unsigned fail-closed)", async () => {
    // GET tanpa hub.challenge & tanpa App Secret → verifyWebhook false → 403, tanpa sentuh DB.
    const codes = new Set<number>();
    for (let i = 0; i < 310; i++) {
      codes.add((await app.inject({ method: "GET", url: "/webhook/meta" })).statusCode);
    }
    expect(codes).toEqual(new Set([403]));
  });

  it("kontrol: route biasa tetap 429 setelah 300 hit (limiter global aktif)", async () => {
    let limited = false;
    for (let i = 0; i < 310 && !limited; i++) {
      limited = (await app.inject({ method: "GET", url: "/ctl" })).statusCode === 429;
    }
    expect(limited).toBe(true);
  });
});
