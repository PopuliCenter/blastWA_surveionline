import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { env } from "../env.js";
import { generateAiReply, type AiMessage } from "../lib/ai.js";

// Mencari balasan otomatis untuk pesan masuk yang TIDAK terkait survei.
// Urutan: aturan Auto Reply (cocok kata kunci) → Agen AI (bila aktif).
// Mengembalikan teks balasan atau null bila tidak ada.

export async function findAutoResponse(contactId: string, text: string): Promise<string | null> {
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
    if (hit) return r.response;
  }

  // 2) Agen AI
  const ai = await prisma.aiConfig.findUnique({ where: { id: "default" } });
  if (!ai?.enabled) return null;

  const apiKey = ai.apiKey ? safeDecrypt(ai.apiKey) : env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Konteks: ambil hingga 10 pesan terakhir kontak ini, urut lama→baru.
  const history = await prisma.message.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const messages: AiMessage[] = history
    .reverse()
    .filter((m) => m.text)
    .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.text as string }));
  if (!messages.length || messages[messages.length - 1]!.role !== "user") {
    messages.push({ role: "user", content: trimmed });
  }

  try {
    return await generateAiReply({ apiKey, model: ai.model, systemPrompt: ai.systemPrompt, messages });
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
