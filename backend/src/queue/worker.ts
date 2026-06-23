import { Worker, type ConnectionOptions } from "bullmq";
import { connection } from "../redis.js";

const bullConnection = connection as unknown as ConnectionOptions;
import { prisma } from "../db.js";
import { loadProviders, getProvider } from "../providers/registry.js";
import { BLAST_QUEUE, type BlastJob } from "./blastQueue.js";

// Worker pengirim blast. Jalankan terpisah: `npm run dev:worker`.
// Rate limit melindungi dari limit/ban Meta — sesuaikan sesuai tier Anda.

async function main() {
  await loadProviders();

  const worker = new Worker<BlastJob>(
    BLAST_QUEUE,
    async (job) => {
      const { recipientId, blastId, vendor, to, templateName, templateLang, bodyParams } = job.data;
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

      // Tandai blast selesai bila semua penerima sudah keluar dari antrian
      const remaining = await prisma.blastRecipient.count({
        where: { blastId, status: "queued" },
      });
      if (remaining === 0) {
        await prisma.blast.update({ where: { id: blastId }, data: { status: "completed" } });
      }

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
