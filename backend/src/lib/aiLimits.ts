// ===== Pembatas Agen AI =====
// Dipisah dari pemanggilan API agar keputusannya bisa diuji tanpa jaringan.

export const AI_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

// Pesan yang dikirim SEKALI saat kuota kontak habis, supaya responden tidak dibiarkan
// menggantung tanpa jawaban. Pesan berikutnya didiamkan agar tidak jadi balasan berulang.
export const AI_QUOTA_REACHED_REPLY =
  "Terima kasih atas pertanyaannya. 🙏 Untuk hal ini tim kami akan menjawab langsung pada jam kerja.";

export type AiDecision =
  | { action: "answer" } // panggil AI seperti biasa
  | { action: "handoff" } // kuota tepat habis → kirim pesan alih ke tim, sekali saja
  | { action: "silent" }; // kuota sudah terlampaui → jangan balas apa pun

/**
 * Putuskan apa yang dilakukan Agen AI untuk satu kontak.
 *
 * @param used  jumlah balasan AI ke kontak ini dalam 24 jam terakhir
 * @param quota kuota per kontak per 24 jam; 0 atau kurang = tanpa batas
 *
 * Pesan alih-tangan ikut tercatat sebagai balasan AI, sehingga `used` bertambah dan
 * pesan sesudahnya jatuh ke "silent". Jadi responden menerimanya tepat satu kali.
 */
export function decideAiReply(used: number, quota: number): AiDecision {
  if (quota <= 0) return { action: "answer" };
  if (used < quota) return { action: "answer" };
  if (used === quota) return { action: "handoff" };
  return { action: "silent" };
}

// Jaga nilai pengaturan tetap masuk akal walau diisi sembarangan lewat API.
export function clampAiSettings(input: { maxTokens?: number; historyLimit?: number; maxRepliesPerDay?: number }): {
  maxTokens: number;
  historyLimit: number;
  maxRepliesPerDay: number;
} {
  const n = (v: number | undefined, fallback: number, min: number, max: number): number => {
    const x = Math.trunc(Number(v));
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
  };
  return {
    maxTokens: n(input.maxTokens, 300, 50, 2000),
    historyLimit: n(input.historyLimit, 6, 0, 30),
    maxRepliesPerDay: n(input.maxRepliesPerDay, 5, 0, 100),
  };
}
