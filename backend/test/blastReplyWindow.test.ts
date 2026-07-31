import { describe, it, expect } from "vitest";
import { shouldStartSurveyFromBlast, BLAST_REPLY_WINDOW_MS } from "../src/lib/surveyLogic.js";

const NOW = new Date("2026-07-29T18:30:00Z");
const jamLalu = (h: number): Date => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe("shouldStartSurveyFromBlast", () => {
  it("TIDAK memulai survei bila kontak sudah menyelesaikannya", () => {
    // Ini bug yang dilaporkan: kontak selesai mengisi, lalu setiap sapaan berikutnya
    // dijawab "jawaban Anda sudah kami terima" dan tak pernah sampai ke Auto Reply.
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(1), alreadyCompleted: true, now: NOW })).toBe(false);
  });

  it("memulai survei bila blast masih baru dan belum diisi", () => {
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(1), alreadyCompleted: false, now: NOW })).toBe(true);
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(23), alreadyCompleted: false, now: NOW })).toBe(true);
  });

  it("berhenti berlaku setelah jendela 24 jam lewat", () => {
    // Di luar jendela sesi WhatsApp, balasan bebas memang tak bisa dikirim — dan
    // blast lama tidak boleh membajak percakapan berbulan-bulan kemudian.
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(25), alreadyCompleted: false, now: NOW })).toBe(false);
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(24 * 30), alreadyCompleted: false, now: NOW })).toBe(
      false,
    );
  });

  it("menerima tepat di batas 24 jam", () => {
    const tepat = new Date(NOW.getTime() - BLAST_REPLY_WINDOW_MS);
    expect(shouldStartSurveyFromBlast({ blastSentAt: tepat, alreadyCompleted: false, now: NOW })).toBe(true);
    const lewatSedetik = new Date(NOW.getTime() - BLAST_REPLY_WINDOW_MS - 1000);
    expect(shouldStartSurveyFromBlast({ blastSentAt: lewatSedetik, alreadyCompleted: false, now: NOW })).toBe(false);
  });

  it("sudah selesai tetap menang walau blast baru saja dikirim", () => {
    expect(shouldStartSurveyFromBlast({ blastSentAt: NOW, alreadyCompleted: true, now: NOW })).toBe(false);
  });

  it("pertanyaan sesudah blast TIDAK memulai survei", () => {
    // Laporan lapangan: "Apakah ada survei" dijawab dengan melempar formulir/pertanyaan 1,
    // sehingga pertanyaannya sendiri tak pernah dijawab. Harus jatuh ke Auto Reply / AI.
    const tanya = (t: string) =>
      shouldStartSurveyFromBlast({ blastSentAt: jamLalu(1), alreadyCompleted: false, text: t, now: NOW });
    expect(tanya("Apakah ada survei")).toBe(false);
    expect(tanya("gimana")).toBe(false);
    expect(tanya("ini survei resmi?")).toBe(false);
    expect(tanya("cara isi survei")).toBe(false);
  });

  it("kesediaan dan sapaan tetap memulai survei", () => {
    const balas = (t: string) =>
      shouldStartSurveyFromBlast({ blastSentAt: jamLalu(1), alreadyCompleted: false, text: t, now: NOW });
    expect(balas("ya")).toBe(true);
    expect(balas("mau")).toBe(true);
    expect(balas("oke, lanjut")).toBe(true);
    expect(balas("assalamualaikum")).toBe(true);
  });

  it("tanpa text (pemanggil lama / media) berperilaku seperti sebelumnya", () => {
    expect(shouldStartSurveyFromBlast({ blastSentAt: jamLalu(1), alreadyCompleted: false, now: NOW })).toBe(true);
  });
});
