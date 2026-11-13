// ===== Pertanyaan khusus saluran — aturan MURNI =====
//
// Sebagian pertanyaan hanya bermakna di satu saluran. Contoh yang memicu fitur ini: nomor
// HP / e-wallet untuk mengirim imbalan. Responden WhatsApp nomornya sudah diketahui dari
// percakapannya, jadi menanyakannya lagi hanya memperpanjang survei; responden Instagram
// tidak punya nomor sama sekali (alamatnya "ig:<IGSID>", lib/saluranKontak.ts).
//
// Disimpan di Question.options.saluran, tanpa kolom baru: "semua" (bawaan — juga bila
// kuncinya tidak ada, sehingga semua survei lama tetap berperilaku persis seperti dulu),
// "instagram", atau "whatsapp".
//
// Pertanyaan yang tidak berlaku bagi saluran responden DILEWATI, sama seperti pertanyaan
// yang dilompati percabangan: mesin chat tidak mengirimnya, dan formulir WhatsApp Flow
// tidak memuatnya (lib/flowJson.ts).

import type { Saluran } from "./saluranKontak.js";

export type SaluranPertanyaan = "semua" | Saluran;
export const SALURAN_PERTANYAAN = ["semua", "instagram", "whatsapp"] as const;

// Nilai tak dikenal dibaca "semua". Validasi saat menyimpan (routes/surveys.ts) sudah
// menolaknya; di sini hanya pagar untuk data lama atau yang ditulis lewat jalan lain —
// lebih aman menanyakan pertanyaan ke semua orang daripada diam-diam tidak ke siapa pun.
export function saluranPertanyaan(options: unknown): SaluranPertanyaan {
  const s = (options as { saluran?: unknown } | null | undefined)?.saluran;
  return s === "instagram" || s === "whatsapp" ? s : "semua";
}

export function pertanyaanBerlaku(q: { options?: unknown }, saluran: Saluran): boolean {
  const s = saluranPertanyaan(q.options);
  return s === "semua" || s === saluran;
}

// Indeks pertanyaan BERLAKU pertama mulai `dari` (termasuk `dari` sendiri), atau
// questions.length bila tidak ada lagi — artinya survei selesai. Dipakai untuk pertanyaan
// pertama saat survei dimulai, dan setelah percabangan menentukan langkah berikutnya: cabang
// yang mendarat di pertanyaan tak berlaku diteruskan ke pertanyaan berlaku sesudahnya.
export function langkahBerlaku(questions: readonly { options?: unknown }[], dari: number, saluran: Saluran): number {
  let i = Math.max(0, dari);
  while (i < questions.length && !pertanyaanBerlaku(questions[i]!, saluran)) i++;
  return Math.min(i, questions.length);
}

// Apakah survei ini punya setidaknya satu pertanyaan untuk saluran tersebut. Survei yang
// semua pertanyaannya khusus saluran lain tidak boleh dimulai di sini: responden hanya
// akan menerima pembuka lalu langsung kata penutup.
export function adaPertanyaanBerlaku(questions: readonly { options?: unknown }[], saluran: Saluran): boolean {
  return langkahBerlaku(questions, 0, saluran) < questions.length;
}
