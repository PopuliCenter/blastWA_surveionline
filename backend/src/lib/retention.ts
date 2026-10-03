import { prisma } from "../db.js";
import { env } from "../env.js";
import { logError } from "./errorLog.js";

// Retensi WebhookLog.
//
// Tabel ini menyimpan SELURUH badan webhook apa adanya — termasuk nomor telepon, nama
// profil, dan isi pesan responden — dan sampai sekarang tidak pernah dibersihkan. Jadi ia
// menumpuk tanpa batas: data pribadi yang tidak lagi dipakai untuk apa pun, sekaligus
// tabel yang terus membesar diam-diam.
//
// Nilainya nyata tapi berumur pendek: menelusuri gangguan beberapa hari terakhir. Setelah
// itu ia hanya beban. Karena itu disimpan berdasarkan umur, bukan selamanya.

// Dipisah supaya bisa diuji tanpa database.
export function cutoffFor(days: number, now: Date = new Date()): Date {
  const hari = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  return new Date(now.getTime() - hari * 24 * 60 * 60 * 1000);
}

export async function purgeWebhookLogs(days: number = env.WEBHOOK_LOG_RETENTION_DAYS): Promise<number> {
  const batas = cutoffFor(days);
  const r = await prisma.webhookLog.deleteMany({ where: { createdAt: { lt: batas } } });
  return r.count;
}

// Dijalankan di worker: sekali saat start, lalu berkala. Sengaja TIDAK memakai job BullMQ
// berulang — pembersihan ini tidak perlu antrean, tidak perlu percobaan ulang, dan tidak
// apa-apa terlewat satu putaran saat container sedang restart.
const SETIAP_MS = 6 * 60 * 60 * 1000;

export function startRetentionSweeper(): NodeJS.Timeout {
  const jalankan = (): void => {
    purgeWebhookLogs()
      .then((n) => {
        if (n > 0) console.log(`[retensi] ${n} baris WebhookLog lebih tua dari ${env.WEBHOOK_LOG_RETENTION_DAYS} hari dihapus`);
      })
      .catch((e) => logError("worker", e, { kind: "retentionSweep" }));
  };
  jalankan();
  const t = setInterval(jalankan, SETIAP_MS);
  // unref: timer ini tidak boleh menahan proses tetap hidup saat shutdown.
  t.unref();
  return t;
}
