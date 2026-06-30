import { env } from "../env.js";
import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { MetaCloudAdapter, type MetaConfig } from "./meta.js";
import { QontakAdapter, type QontakConfig } from "./qontak.js";
import { BaileysAdapter } from "./baileys.js";
import type { MessagingProvider } from "./types.js";

let providers: Record<string, MessagingProvider> = {};

function buildFromEnv(): Record<string, MessagingProvider> {
  return {
    meta: new MetaCloudAdapter({
      accessToken: env.META_ACCESS_TOKEN,
      phoneNumberId: env.META_PHONE_NUMBER_ID,
      appSecret: env.META_APP_SECRET,
      verifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
      graphVersion: env.META_GRAPH_VERSION,
    }),
    qontak: new QontakAdapter({
      baseUrl: env.QONTAK_BASE_URL,
      accessToken: env.QONTAK_ACCESS_TOKEN,
      channelIntegrationId: env.QONTAK_CHANNEL_INTEGRATION_ID,
      webhookSecret: env.QONTAK_WEBHOOK_SECRET,
    }),
    // Gateway tidak resmi (scan QR). Tak punya kredensial DB — status dari socket/sesi.
    baileys: new BaileysAdapter(),
  };
}

/**
 * Bangun provider dari ENV, lalu timpa dengan kredensial dari DB (VendorConfig)
 * bila ada. Kredensial DB terenkripsi (AES-256-GCM).
 */
export async function loadProviders(): Promise<void> {
  providers = buildFromEnv();

  const configs = await prisma.vendorConfig.findMany({ where: { active: true } }).catch(() => []);
  for (const c of configs) {
    if (!c.credentials) continue;
    try {
      const creds = decryptJson<Record<string, string>>(c.credentials);
      if (c.vendor === "meta") {
        providers.meta = new MetaCloudAdapter({
          accessToken: creds.accessToken ?? env.META_ACCESS_TOKEN,
          phoneNumberId: creds.phoneNumberId ?? env.META_PHONE_NUMBER_ID,
          appSecret: creds.appSecret ?? env.META_APP_SECRET,
          verifyToken: creds.verifyToken ?? env.META_WEBHOOK_VERIFY_TOKEN,
          graphVersion: creds.graphVersion ?? env.META_GRAPH_VERSION,
        } satisfies MetaConfig);
      } else if (c.vendor === "qontak") {
        providers.qontak = new QontakAdapter({
          baseUrl: creds.baseUrl ?? env.QONTAK_BASE_URL,
          accessToken: creds.accessToken ?? env.QONTAK_ACCESS_TOKEN,
          channelIntegrationId: creds.channelIntegrationId ?? env.QONTAK_CHANNEL_INTEGRATION_ID,
          webhookSecret: creds.webhookSecret ?? env.QONTAK_WEBHOOK_SECRET,
        } satisfies QontakConfig);
      }
    } catch (err) {
      console.error(`Gagal memuat kredensial vendor ${c.vendor}:`, err);
    }
  }
}

export function getProvider(name: string): MessagingProvider {
  const p = providers[name];
  if (!p) throw new Error(`Vendor tidak dikenal: ${name}`);
  return p;
}

export function listProviders(): { name: string; configured: boolean; isDefault: boolean }[] {
  return Object.values(providers).map((p) => ({
    name: p.name,
    configured: p.isConfigured(),
    isDefault: p.name === env.DEFAULT_VENDOR,
  }));
}

// Inisialisasi awal dari env (sinkron) supaya getProvider tersedia sebelum loadProviders().
providers = buildFromEnv();
