import { Queue, type ConnectionOptions } from "bullmq";
import { connection } from "../redis.js";
import { logError } from "../lib/errorLog.js";

// Antrean pendorong respons survei → Google Sheets. Dipisah dari antrean blast
// supaya kegagalan Google (kuota/jaringan) tidak pernah menyandera pengiriman pesan.

const bullConnection = connection as unknown as ConnectionOptions;

export type SheetJob = { responseId: string };

export const SHEET_QUEUE = "sheets";

export const sheetQueue = new Queue<SheetJob, string, string>(SHEET_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    // Backoff mulai 30 detik: kegagalan di sini biasanya kuota per-menit Google atau
    // spreadsheet belum di-share — dua-duanya tidak sembuh dalam hitungan detik.
    attempts: 5,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Panggil di titik respons survei SELESAI. Sengaja tidak pernah melempar: penulisan
// sheet itu turunan — kegagalan antre (mis. Redis sesaat putus) tidak boleh
// menggagalkan alur survei. Barisnya tetap bisa disusulkan lewat backfill.
//
// jobId deterministik → job ganda untuk respons yang sama luruh sendiri; ditambah
// penjaga sheetSyncedAt di worker, satu respons tidak mungkin jadi dua baris.
export async function enqueueSheetSync(responseId: string): Promise<void> {
  try {
    const jobId = `sheet_${responseId}`;
    // BullMQ MENGABAIKAN add() diam-diam bila jobId-nya masih diduduki job lama di
    // daftar completed/failed (removeOnComplete/Fail menyimpannya ribuan). Kejadian
    // nyata: survei selesai SEBELUM integrasi dikonfigurasi → job jalan → "skip-
    // nonaktif" → completed; backfill sesudahnya mengantre ulang dengan id sama dan
    // dibuang tanpa suara — Tertunda macet di angka yang sama selamanya. Singkirkan
    // dulu bangkainya supaya add() benar-benar mengantre. Yang masih menunggu/aktif
    // dibiarkan — justru itulah gunanya dedupe.
    const existing = await sheetQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== "completed" && state !== "failed") return; // masih antre/aktif
      await existing.remove();
    }
    await sheetQueue.add("sync", { responseId }, { jobId });
  } catch (err) {
    logError("backend", err, { scope: "sheetQueue", responseId });
  }
}
