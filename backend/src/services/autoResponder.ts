import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { env } from "../env.js";
import { generateReply, type AiMessage } from "../lib/ai.js";
import { decideAiReply, AI_QUOTA_WINDOW_MS, AI_QUOTA_REACHED_REPLY } from "../lib/aiLimits.js";

// Mencari balasan otomatis untuk pesan masuk yang TIDAK terkait survei.
// Urutan: aturan Auto Reply (cocok kata kunci) → Agen AI (bila aktif).
// Mengembalikan { text, source } atau null bila tidak ada yang perlu dibalas.
// `source` ikut disimpan di tabel Message — itulah yang dipakai menghitung kuota AI.

export type AutoResponse = { text: string; source: "autoreply" | "ai" };

export async function findAutoResponse(contactId: string, text: string): Promise<AutoResponse | null> {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  // 1) Auto Reply rules
  const rules = await prisma.autoReplyRule.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
  });
  const lower = trimmed.toLowerCase();
  for (const r of rules) {
    const kw = r.keyword.toLowerCase();
    const hit =
      r.matchType === "exact" ? lower === kw : r.matchType === "starts" ? lower.startsWith(kw) : lower.includes(kw);
    if (hit) return { text: r.response, source: "autoreply" };
  }

  // 2) Agen AI
  const ai = await prisma.aiConfig.findUnique({ where: { id: "default" } });
  if (!ai?.enabled) return null;

  const apiKey = ai.apiKey ? safeDecrypt(ai.apiKey) : env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Kuota per kontak: batasi berapa kali AI boleh menjawab satu nomor dalam 24 jam.
  // Tanpa ini, satu orang yang terus membalas bisa menghabiskan token tanpa batas.
  const used = await prisma.message.count({
    where: { contactId, source: "ai", createdAt: { gte: new Date(Date.now() - AI_QUOTA_WINDOW_MS) } },
  });
  const decision = decideAiReply(used, ai.maxRepliesPerDay);
  if (decision.action === "silent") return null;
  if (decision.action === "handoff") return { text: AI_QUOTA_REACHED_REPLY, source: "ai" };

  // Konteks: ambil beberapa pesan terakhir kontak ini, urut lama→baru.
  const history = await prisma.message.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, ai.historyLimit),
  });
  const messages: AiMessage[] = history
    .reverse()
    .filter((m) => m.text)
    .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.text as string }));
  if (!messages.length || messages[messages.length - 1]!.role !== "user") {
    messages.push({ role: "user", content: trimmed });
  }

  try {
    const reply = await generateReply({
      provider: ai.provider,
      apiKey,
      model: ai.model,
      baseUrl: ai.baseUrl ?? undefined,
      systemPrompt: ai.systemPrompt,
      messages,
      maxTokens: ai.maxTokens,
    });
    return reply ? { text: reply, source: "ai" } : null;
  } catch (err) {
    console.error("AI reply gagal:", err);
    return null;
  }
}

function safeDecrypt(blob: string): string | undefined {
  try {
    return decryptJson<string>(blob);
  } catch {
    return undefined;
  }
}
