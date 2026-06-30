import { Queue, type ConnectionOptions } from "bullmq";
import { connection } from "../redis.js";

// BullMQ membundel ioredis-nya sendiri → cast untuk menghindari bentrok tipe instance.
const bullConnection = connection as unknown as ConnectionOptions;

export type BlastJob = {
  recipientId: string;
  blastId: string;
  vendor: string;
  to: string;
  templateName: string;
  templateLang: string;
  bodyParams: string[];
  text?: string; // teks final (dipakai vendor templateless mis. Baileys)
  flowToken?: string; // broadcast Flow: korelasi balasan flow ke survei
};

export const BLAST_QUEUE = "blast";

export const blastQueue = new Queue<BlastJob, string, string>(BLAST_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
