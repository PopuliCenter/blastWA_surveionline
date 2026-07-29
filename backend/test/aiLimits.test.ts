import { describe, it, expect } from "vitest";
import { decideAiReply, clampAiSettings } from "../src/lib/aiLimits.js";

describe("decideAiReply", () => {
  it("menjawab normal selama kuota belum habis", () => {
    expect(decideAiReply(0, 5).action).toBe("answer");
    expect(decideAiReply(4, 5).action).toBe("answer");
  });

  it("mengirim pesan alih-tangan TEPAT SATU KALI saat kuota habis", () => {
    // Pesan alih-tangan ikut tercatat sebagai balasan AI, jadi hitungannya naik
    // dan pesan berikutnya jatuh ke "silent". Responden tidak dibiarkan menggantung,
    // tapi juga tidak menerima pesan yang sama berulang-ulang.
    expect(decideAiReply(5, 5).action).toBe("handoff");
    expect(decideAiReply(6, 5).action).toBe("silent");
    expect(decideAiReply(50, 5).action).toBe("silent");
  });

  it("tanpa batas bila kuota disetel 0 atau negatif", () => {
    expect(decideAiReply(1000, 0).action).toBe("answer");
    expect(decideAiReply(1000, -1).action).toBe("answer");
  });

  it("kuota 1 memberi satu jawaban lalu satu alih-tangan", () => {
    expect(decideAiReply(0, 1).action).toBe("answer");
    expect(decideAiReply(1, 1).action).toBe("handoff");
    expect(decideAiReply(2, 1).action).toBe("silent");
  });
});

describe("clampAiSettings", () => {
  it("memakai nilai bawaan bila kosong atau bukan angka", () => {
    expect(clampAiSettings({})).toEqual({ maxTokens: 300, historyLimit: 6, maxRepliesPerDay: 5 });
    expect(clampAiSettings({ maxTokens: NaN })).toMatchObject({ maxTokens: 300 });
  });

  it("menahan nilai di luar batas wajar", () => {
    expect(clampAiSettings({ maxTokens: 999999 }).maxTokens).toBe(2000);
    expect(clampAiSettings({ maxTokens: 1 }).maxTokens).toBe(50);
    expect(clampAiSettings({ historyLimit: 500 }).historyLimit).toBe(30);
    expect(clampAiSettings({ maxRepliesPerDay: -5 }).maxRepliesPerDay).toBe(0);
  });

  it("membiarkan 0 pada kuota karena artinya tanpa batas", () => {
    expect(clampAiSettings({ maxRepliesPerDay: 0 }).maxRepliesPerDay).toBe(0);
  });

  it("membulatkan angka pecahan", () => {
    expect(clampAiSettings({ maxTokens: 250.7 }).maxTokens).toBe(250);
  });
});
