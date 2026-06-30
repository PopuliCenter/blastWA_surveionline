import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_SECRET: z.string().min(16),
  // 32 byte = 64 karakter hex
  CREDENTIALS_ENC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "CREDENTIALS_ENC_KEY harus 64 karakter hex (32 byte)"),

  SEED_ADMIN_USERNAME: z.string().default("populi"),
  SEED_ADMIN_PASSWORD: z.string().default("populi13!"),
  SEED_ADMIN_EMAIL: z.string().default("admin@populi.id"),

  // Meta
  META_BUSINESS_PORTFOLIO_ID: z.string().optional(),
  META_WABA_ID: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v21.0"),

  // Qontak
  QONTAK_BASE_URL: z.string().default("https://service-chat.qontak.com/api/open/v1"),
  QONTAK_ACCESS_TOKEN: z.string().optional(),
  QONTAK_CHANNEL_INTEGRATION_ID: z.string().optional(),
  QONTAK_WEBHOOK_SECRET: z.string().optional(),

  DEFAULT_VENDOR: z.enum(["meta", "qontak", "baileys"]).default("qontak"),

  // Baileys (gateway WhatsApp tidak resmi via scan QR)
  BAILEYS_AUTH_DIR: z.string().default("./.baileys-auth"), // folder sesi (mount ke volume di prod)
  // Worker meneruskan kirim ke backend (pemilik socket) lewat URL internal ini.
  INTERNAL_API_URL: z.string().default("http://localhost:3000"),
  BAILEYS_INTERNAL_TOKEN: z.string().optional(), // opsional: amankan endpoint internal worker→backend

  // Agen AI (opsional; bisa juga diisi via UI, tersimpan terenkripsi)
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Konfigurasi environment tidak valid:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
