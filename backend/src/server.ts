import Fastify from "fastify";
import cors from "@fastify/cors";
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

async function main() {
  const app = Fastify({ logger: true });

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
}

main().catch((err) => {
  console.error("Server gagal start:", err);
  process.exit(1);
});
