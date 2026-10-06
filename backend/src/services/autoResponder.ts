import { prisma } from "../db.js";
import { decryptJson } from "../lib/crypto.js";
import { env } from "../env.js";
import { generateReply, type AiMessage } from "../lib/ai.js";
import { decideAiReply, AI_QUOTA_WINDOW_MS, AI_QUOTA_REACHED_REPLY } from "../lib/aiLimits.js";
import { logError } from "../lib/errorLog.js";
import { buildContactFacts } from "../lib/aiContext.js";
import { statusKuotaSurveiAktif } from "./kuotaSurvei.js";

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

  // MATIKAN agen begitu seluruh survei yang berjalan penuh kuotanya. Tiap balasan AI adalah
  // pesan service berbayar, dan setelah kuota penuh ia tidak lagi membawa satu pun responden
  // baru — hanya tagihan yang terus berjalan selama orang masih menulis.
  //
  // Yang dimatikan HANYA jalur AI. Aturan Auto Reply di atas tetap berjalan: jumlahnya
  // terbatas, isinya ditulis operator, dan justru di situlah pesan "survei sudah ditutup"
  // semestinya berada.
  //
  // Dimatikan BENAR-BENAR di basis data, bukan sekadar dilewati, atas permintaan operator:
  // agen yang bisa menyala sendiri sulit dipercaya ketika yang dipertaruhkan adalah tagihan.
  // Konsekuensinya ditanggung dengan sadar — ia tidak akan hidup lagi tanpa ada yang
  // menyalakannya, jadi sebabnya dicatat agar layar Agen AI bisa menjelaskannya.
  const kuota = await statusKuotaSurveiAktif();
  if (kuota.semuaPenuh && ai.izinOffOtomatis) {
    await prisma.aiConfig.update({
      where: { id: "default" },
      data: { enabled: false, offOtomatisPada: new Date(), izinOffOtomatis: false },
    });
    logError("ai-agent", "Agen AI dimatikan otomatis — kuota seluruh survei terpenuhi", {
      survei: kuota.survei.map((s) => `${s.judul}: ${s.terisi}/${s.target ?? "∞"}`),
      catatan: "Nyalakan kembali dari layar Agen AI bila masih dibutuhkan.",
    });
    return null;
  }
  // izinOffOtomatis false DAN kuota masih penuh berarti operator sudah menyalakannya
  // kembali setelah sistem mematikan. Itu keputusan sadar mereka — agen tetap menjawab,
  // dan sistem tidak mematikannya lagi. Mematikan apa yang baru saja dinyalakan orang
  // adalah aplikasi yang melawan pemakainya.
  // Kuota longgar lagi (target dinaikkan, survei baru, atau yang lama ditutup) → sistem
  // boleh mematikan lagi pada episode berikutnya.
  if (!ai.izinOffOtomatis || ai.offOtomatisPada) {
    await prisma.aiConfig.update({
      where: { id: "default" },
      data: { izinOffOtomatis: true, offOtomatisPada: null },
    });
  }

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

  // Fakta keadaan pengirim (sudah mengisi survei atau belum) disisipkan ke system
  // prompt. Tanpa ini AI menebak dan mengarang proses yang tidak ada.
  const aktif = await prisma.survey.findMany({
    where: { status: "active" },
    select: {
      title: true,
      triggerKeywords: true,
      triggerEnabled: true,
      oncePerContact: true,
      responses: { where: { contactId, completedAt: { not: null } }, select: { id: true }, take: 1 },
    },
  });
  const facts = buildContactFacts(
    aktif.map((s) => ({
      title: s.title,
      triggers: s.triggerEnabled ? (s.triggerKeywords ?? []) : [],
      oncePerContact: s.oncePerContact,
      completedByContact: s.responses.length > 0,
    })),
  );

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
      systemPrompt: `${ai.systemPrompt}\n\n${facts}`,
      messages,
      maxTokens: ai.maxTokens,
    });
    return reply ? { text: reply, source: "ai" } : null;
  } catch (err) {
    // Dulu hanya console.error, sehingga AI yang gagal tampak seperti "tidak menjawab
    // tanpa sebab" — penyebab tersering: nama model salah ketik. Sekarang masuk log
    // error terstruktur, dan halaman Agen AI punya tombol Tes untuk memunculkannya.
    logError("ai-agent", err, { provider: ai.provider, model: ai.model });
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
