import type { RecipientStatus } from "@prisma/client";
import type { DeliveryStatus } from "../providers/types.js";

// ===== Transisi status pengiriman blast =====
//
// Meta dan Qontak mengirim webhook dengan jaminan "at least once": callback yang sama
// BISA datang lebih dari sekali, dan saat blast datangnya berbarengan dalam satu burst.
// Tanpa penjagaan, satu pesan yang statusnya "delivered" dikirim dua kali akan menaikkan
// deliveredCount dua kali — itulah sebabnya angka "Sampai" bisa melampaui "Terkirim".
//
// Daftar ini ditulis eksplisit, bukan dihitung dari peringkat angka, karena "failed"
// dan "sent" berperingkat sama: pesan yang sudah terkirim masih boleh jadi gagal,
// tapi pesan yang gagal tidak boleh tiba-tiba jadi terkirim.

export const ALLOWED_FROM: Record<DeliveryStatus, readonly RecipientStatus[]> = {
  sent: ["queued"],
  delivered: ["queued", "sent"],
  read: ["queued", "sent", "delivered"],
  failed: ["queued", "sent"],
};

// Boleh pindah dari status `from` ke `to`?
// Status yang sama persis selalu ditolak — itu tanda callback duplikat.
export function canTransition(from: string, to: DeliveryStatus): boolean {
  return ALLOWED_FROM[to]?.includes(from as RecipientStatus) ?? false;
}

// Kolom penghitung di tabel Blast yang dinaikkan saat status mencapai `to`.
// null berarti tidak ada yang dinaikkan (sentCount sudah diisi saat pengiriman).
export function counterField(to: DeliveryStatus): "deliveredCount" | "readCount" | "failedCount" | null {
  if (to === "delivered") return "deliveredCount";
  if (to === "read") return "readCount";
  if (to === "failed") return "failedCount";
  return null;
}

// Hitung ulang penghitung blast dari jumlah baris BlastRecipient per status.
// Baris penerima adalah sumber kebenaran: satu baris per nomor, berisi status terkini.
//
// Penghitungnya bersifat corong (kumulatif), bukan status saat ini: nomor yang sudah
// "read" pasti pernah "delivered", jadi ikut dihitung di deliveredCount.
//
// sentCount SENGAJA tidak dihitung ulang. Nilainya dinaikkan worker sekali per
// pengiriman yang berhasil dan tidak pernah disentuh webhook, jadi tidak pernah
// membengkak — sementara menghitungnya dari status akan salah untuk nomor yang
// sudah terkirim lalu dilaporkan gagal oleh Meta.
export function countersFromStatuses(byStatus: Record<string, number>): {
  deliveredCount: number;
  readCount: number;
  failedCount: number;
} {
  const n = (s: string): number => byStatus[s] ?? 0;
  return {
    deliveredCount: n("delivered") + n("read"),
    readCount: n("read"),
    failedCount: n("failed"),
  };
}
