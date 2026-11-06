import { createHash, timingSafeEqual } from "node:crypto";

// Bandingkan dua rahasia (mis. Verify Token webhook) dalam waktu konstan. Keduanya di-hash
// dulu supaya panjangnya sama — timingSafeEqual menolak panjang berbeda, dan memeriksa
// panjangnya sendiri membocorkan panjang rahasia. Nilai kosong tidak pernah cocok, jadi
// token yang belum diatur tidak bisa "cocok" dengan permintaan yang juga tidak membawanya.
export function rahasiaCocok(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
