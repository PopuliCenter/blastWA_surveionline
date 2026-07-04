import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { registerAuth } from "./plugins/authPlugin.js";
import { loadProviders } from "./providers/registry.js";
import { authRoutes } from "./routes/auth.js";
import { surveyRoutes } from "./routes/surveys.js";
import { segmentRoutes } from "./routes/segments.js";
import { blastRoutes } from "./routes/blasts.js";
import { vendorRoutes } from "./routes/vendors.js";
import { reportRoutes } from "./routes/reports.js";
import { userRoutes } from "./routes/users.js";
import { contactRoutes } from "./routes/contacts.js";
import { autoReplyRoutes } from "./routes/autoReply.js";
import { aiAgentRoutes } from "./routes/aiAgent.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { sendingRoutes } from "./routes/sending.js";
import { templateRoutes } from "./routes/templates.js";
import { baileysRoutes } from "./routes/baileys.js";
import { baileysGateway } from "./providers/baileys.js";
import { handleInboundEvents } from "./services/surveyEngine.js";
import { logError, logErrorSync, installProcessErrorHandlers } from "./lib/errorLog.js";
import { prisma } from "./db.js";

async function main() {
  // Catat error tingkat proses (unhandledRejection / uncaughtException) ke file log.
  installProcessErrorHandlers("backend");

  // trustProxy: di belakang Cloudflare + edge nginx → req.ip = IP klien asli (untuk rate-limit).
  const app = Fastify({ logger: true, trustProxy: true });

  // Catat hanya error server (5xx) ke file log — abaikan error klien (400/401/429) agar tidak berisik.
  app.addHook("onError", async (req, _reply, err) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) logError("backend", err, { method: req.method, url: req.url, ip: req.ip });
  });

  // Simpan body mentah (rawBody) untuk verifikasi signature webhook.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as unknown as { rawBody?: string }).rawBody = body as string;
    try {
      done(null, (body as string).length ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error);
    }
  });

  await app.register(cors, { origin: env.FRONTEND_ORIGIN, credentials: true });
  // Security headers. CSP dimatikan (backend hanya sajikan JSON; CSP diatur di edge/nginx frontend).
  await app.register(helmet, { contentSecurityPolicy: false });
  // Rate limit global (anti brute-force / abuse). Login dibatasi lebih ketat via config per-route.
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  await registerAuth(app);

  // Muat kredensial vendor dari DB (timpa env)
  await loadProviders();

  app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(authRoutes);
  await app.register(surveyRoutes);
  await app.register(segmentRoutes);
  await app.register(blastRoutes);
  await app.register(vendorRoutes);
  await app.register(reportRoutes);
  await app.register(userRoutes);
  await app.register(contactRoutes);
  await app.register(autoReplyRoutes);
  await app.register(aiAgentRoutes);
  await app.register(webhookRoutes);
  await app.register(sendingRoutes);
  await app.register(templateRoutes);
  await app.register(baileysRoutes);

  // Baileys: proses backend = pemilik socket. Pasang handler pesan masuk (survei/auto-reply)
  // & auto-start bila ada sesi tersimpan (tak perlu scan ulang setelah restart).
  baileysGateway.claimOwnership();
  baileysGateway.setInboundHandler(handleInboundEvents);
  if (baileysGateway.hasSession()) {
    baileysGateway.start().catch((e) => app.log.error({ err: e }, "Baileys auto-start gagal"));
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Populi WA backend siap di :${env.PORT}`);

  // Graceful shutdown: pada deploy/restart, tuntaskan request in-flight lalu tutup koneksi
  // (hindari pemutusan mid-write & korupsi state; socket Baileys ditutup rapi saat proses keluar).
  const shutdown = async (sig: string) => {
    app.log.info(`${sig} diterima — mematikan dengan rapi…`);
    try {
      await app.close(); // stop terima koneksi baru, selesaikan yang sedang berjalan
      await prisma.$disconnect();
    } catch (e) {
      app.log.error({ err: e }, "Gagal shutdown rapi");
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Server gagal start:", err);
  logErrorSync("backend", err, { kind: "startupFailure" });
  process.exit(1);
});
