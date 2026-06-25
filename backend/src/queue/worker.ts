import { Worker, DelayedError, type ConnectionOptions } from "bullmq";
import { connection } from "../redis.js";

const bullConnection = connection as unknown as ConnectionOptions;
import { prisma } from "../db.js";
import { loadProviders, getProvider } from "../providers/registry.js";
import { BLAST_QUEUE, type BlastJob } from "./blastQueue.js";

// Worker pengirim blast. Jalankan terpisah: `npm run dev:worker`.
// Pengaman anti-banned: lewati kontak opt-out, batas harian + jitter (warm-up).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getPolicy() {
  return prisma.sendingPolicy.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}

// Total pesan keluar hari ini (blast terkirim + balasan chat/survei) untuk cek batas harian.
async function usedToday(): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [sent, msgs] = await Promise.all([
    prisma.blastRecipient.count({ where: { status: "sent", updatedAt: { gte: start } } }),
    prisma.message.count({ where: { direction: "out", createdAt: { gte: start } } }),
  ]);
  return sent + msgs;
}

// Tandai blast selesai bila tidak ada penerima tersisa di antrian.
async function maybeComplete(blastId: string): Promise<void> {
  const remaining = await prisma.blastRecipient.count({ where: { blastId, status: "queued" } });
  if (remaining === 0) await prisma.blast.update({ where: { id: blastId }, data: { status: "completed" } });
}

async function main() {
  await loadProviders();

  const worker = new Worker<BlastJob>(
    BLAST_QUEUE,
    async (job, token) => {
      const { recipientId, blastId, vendor, to, templateName, templateLang, bodyParams } = job.data;

      // 1) Lewati kontak yang sudah opt-out (penting untuk blast terjadwal)
      const recipient = await prisma.blastRecipient.findUnique({
        where: { id: recipientId },
        include: { contact: { select: { subscribed: true } } },
      });
      if (recipient && recipient.contact && !recipient.contact.subscribed) {
        await prisma.blastRecipient.update({ where: { id: recipientId }, data: { status: "failed", error: "dilewati: kontak opt-out" } });
        await maybeComplete(blastId);
        return "skip-optout";
      }

      // 2) Batas harian (warm-up) → tunda job ke besok bila kuota habis
      const policy = await getPolicy();
      if (policy.enabled && (await usedToday()) >= policy.dailyLimit) {
        const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0);
        await job.moveToDelayed(tomorrow.getTime() + 24 * 60 * 60 * 1000 + 60000, token);
        throw new DelayedError();
      }

      // 3) Jitter antar pesan agar pola kirim natural
      if (policy.enabled && policy.jitterMaxMs > 0) {
        const lo = Math.max(0, policy.jitterMinMs), hi = Math.max(lo, policy.jitterMaxMs);
        await sleep(lo + Math.floor(Math.random() * (hi - lo)));
      }

      const provider = getProvider(vendor);
      const result = await provider.sendTemplate({
        to,
        templateName,
        languageCode: templateLang,
        bodyParams,
      });

      if (result.status === "failed") {
        await prisma.blastRecipient.update({
          where: { id: recipientId },
          data: { status: "failed", error: JSON.stringify(result.raw).slice(0, 1000) },
        });
        await prisma.blast.update({ where: { id: blastId }, data: { failedCount: { increment: 1 } } });
        throw new Error(`Kirim gagal ke ${to}`); // biar BullMQ retry
      }

      await prisma.blastRecipient.update({
        where: { id: recipientId },
        data: { status: "sent", vendorMessageId: result.vendorMessageId || null, error: null },
      });
      await prisma.blast.update({ where: { id: blastId }, data: { sentCount: { increment: 1 } } });

      await maybeComplete(blastId);
      return result.vendorMessageId;
    },
    {
      connection: bullConnection,
      concurrency: 5,
      limiter: { max: 20, duration: 1000 }, // maks 20 pesan / detik
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} gagal:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`Job ${job.id} selesai → ${job.returnvalue}`);
  });

  console.log("✅ Blast worker berjalan, menunggu job...");
}

main().catch((err) => {
  console.error("Worker gagal start:", err);
  process.exit(1);
});
