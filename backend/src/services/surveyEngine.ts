import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import type { NormalizedInbound } from "../providers/types.js";
import { normalizePhone } from "../lib/phone.js";
import { findAutoResponse } from "./autoResponder.js";

// Mesin survei berbasis chat dengan tipe pertanyaan kaya:
// text | rating (min-max) | number | choice (pilihan ganda) | boolean (ya/tidak) | image
// Mendukung pertanyaan opsional (skip) & validasi jawaban (re-prompt bila salah).

const SKIP_WORDS = ["lewati", "skip", "lewat", "-"];
const OPT_OUT_WORDS = ["berhenti", "stop", "unsubscribe", "unsub", "cabut", "hapus saya", "berhenti langganan"];
const OPT_IN_WORDS = ["mulai", "langganan", "berlangganan", "subscribe", "daftar", "gabung"];

type QLite = { id: string; text: string; type: string; required: boolean; options: any };

export async function handleInboundEvents(events: NormalizedInbound[]): Promise<void> {
  for (const ev of events) {
    try {
      if (ev.kind === "status") await handleStatus(ev);
      else if (ev.kind === "message") await handleMessage(ev);
    } catch (err) {
      console.error("handleInbound error:", err);
    }
  }
}

async function handleStatus(ev: NormalizedInbound): Promise<void> {
  if (!ev.refMessageId || !ev.deliveryStatus) return;
  const recipient = await prisma.blastRecipient.findUnique({ where: { vendorMessageId: ev.refMessageId } });
  if (!recipient) return;
  const rank = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 1 } as const;
  const next = ev.deliveryStatus;
  if (rank[next] < rank[recipient.status]) return;
  await prisma.blastRecipient.update({ where: { id: recipient.id }, data: { status: next } });
  const field = next === "delivered" ? "deliveredCount" : next === "read" ? "readCount" : next === "failed" ? "failedCount" : null;
  if (field) await prisma.blast.update({ where: { id: recipient.blastId }, data: { [field]: { increment: 1 } } });
}

async function handleMessage(ev: NormalizedInbound): Promise<void> {
  if (!ev.from) return;
  const phone = normalizePhone(ev.from);
  const contact = await prisma.contact.upsert({ where: { phone }, update: {}, create: { phone } });

  const storedText = ev.text ?? (ev.mediaType ? `[${ev.mediaType}]` : null);
  await prisma.message.create({
    data: { contactId: contact.id, direction: "in", vendor: ev.vendor, vendorMessageId: ev.messageId, text: storedText, payload: ev.raw as object },
  });

  const lc = (ev.text ?? "").trim().toLowerCase();

  // 0) Opt-out / opt-in (anti-banned) — prioritas tertinggi
  if (OPT_OUT_WORDS.includes(lc)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { subscribed: false, optOutAt: new Date() } });
    await reply(ev.vendor, phone, "Anda telah berhenti menerima pesan dari kami. Balas *MULAI* untuk berlangganan kembali.");
    return;
  }
  if (OPT_IN_WORDS.includes(lc)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { subscribed: true, optOutAt: null, consentSource: contact.consentSource ?? "inbound", consentAt: contact.consentAt ?? new Date() } });
    await reply(ev.vendor, phone, "Terima kasih, Anda kembali berlangganan pesan kami. 🙏");
    return;
  }
  // Kontak yang membalas = persetujuan implisit (bila belum tercatat)
  if (!contact.consentSource) {
    await prisma.contact.update({ where: { id: contact.id }, data: { consentSource: "inbound", consentAt: new Date() } });
  }

  // 1) Sesi survei berjalan?
  const active = await prisma.surveyResponse.findFirst({
    where: { contactId: contact.id, completedAt: null },
    orderBy: { startedAt: "desc" },
    include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (active) { await advanceSurvey(active.id, active.currentStep, active.survey.questions as QLite[], contact.id, phone, ev.vendor, ev); return; }

  // 2) Pemicu kata kunci → mulai survei yang cocok (mis. responden ketik "isi survey")
  const triggered = await findTriggeredSurvey(ev.text ?? "");
  if (triggered && triggered.questions.length) {
    await prisma.surveyResponse.create({ data: { surveyId: triggered.id, contactId: contact.id, currentStep: 0 } });
    const first = formatQuestion(triggered.questions[0] as QLite);
    const intro = triggered.description ? `${triggered.description}\n\n${first}` : first;
    await reply(ev.vendor, phone, intro);
    return;
  }

  // 3) Mulai survei dari blast terkait
  const recipient = await prisma.blastRecipient.findFirst({
    where: { contactId: contact.id, blast: { surveyId: { not: null } } },
    orderBy: { createdAt: "desc" },
    include: { blast: { include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } } } },
  });
  if (recipient?.blast?.survey && recipient.blast.survey.questions.length) {
    await prisma.surveyResponse.create({ data: { surveyId: recipient.blast.survey.id, contactId: contact.id, blastId: recipient.blastId, currentStep: 0 } });
    await reply(ev.vendor, phone, formatQuestion(recipient.blast.survey.questions[0] as QLite));
    return;
  }

  // 4) Auto Reply / Agen AI
  const auto = await findAutoResponse(contact.id, ev.text ?? "");
  if (auto) await reply(ev.vendor, phone, auto);
}

// Cari survei aktif yang kata kunci pemicunya cocok dengan teks masuk.
async function findTriggeredSurvey(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const surveys = await prisma.survey.findMany({
    where: { triggerEnabled: true, status: "active" },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  for (const s of surveys) {
    const kws = (s.triggerKeywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    // Cocok bila teks sama persis, mengandung kata kunci, atau kata kunci muncul sebagai kata utuh
    if (kws.some((k) => t === k || t.includes(k))) return s;
  }
  return null;
}

async function advanceSurvey(responseId: string, step: number, questions: QLite[], contactId: string, phone: string, vendor: string, ev: NormalizedInbound): Promise<void> {
  const current = questions[step];
  if (!current) { await prisma.surveyResponse.update({ where: { id: responseId }, data: { completedAt: new Date() } }); return; }

  const text = (ev.text ?? "").trim();

  // Skip (pertanyaan opsional)
  if (!current.required && SKIP_WORDS.includes(text.toLowerCase())) {
    await saveAnswer(responseId, current.id, "[dilewati]");
  } else {
    const v = validateAnswer(current, ev);
    if (!v.ok) {
      // Jawaban tidak valid → beri tahu & ulangi pertanyaan, jangan maju.
      await reply(vendor, phone, `${v.error}\n\n${formatQuestion(current)}`);
      return;
    }
    await saveAnswer(responseId, current.id, v.value);
  }

  const nextStep = step + 1;
  const next = questions[nextStep];
  if (next) {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { currentStep: nextStep } });
    await reply(vendor, phone, formatQuestion(next));
  } else {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { currentStep: nextStep, completedAt: new Date() } });
    await reply(vendor, phone, "Terima kasih, semua jawaban Anda sudah kami terima. 🙏");
  }
}

function ratingRange(q: QLite): { min: number; max: number } {
  const min = Number(q.options?.min ?? 1);
  const max = Number(q.options?.max ?? 5);
  return { min: Number.isFinite(min) ? min : 1, max: Number.isFinite(max) ? max : 5 };
}
function choices(q: QLite): string[] {
  const c = q.options?.choices;
  return Array.isArray(c) ? c.map((x: any) => String(x)) : [];
}

function validateAnswer(q: QLite, ev: NormalizedInbound): { ok: true; value: string } | { ok: false; error: string } {
  const text = (ev.text ?? "").trim();
  switch (q.type) {
    case "image":
      if (ev.mediaType === "image" && ev.mediaId) return { ok: true, value: `[gambar] ${ev.mediaId}` };
      return { ok: false, error: "Mohon kirim berupa foto/gambar." };
    case "rating": {
      const { min, max } = ratingRange(q);
      const n = Number(text);
      if (Number.isInteger(n) && n >= min && n <= max) return { ok: true, value: String(n) };
      return { ok: false, error: `Mohon balas dengan angka ${min} sampai ${max}.` };
    }
    case "number": {
      const n = Number(text);
      if (Number.isFinite(n) && text !== "") return { ok: true, value: String(n) };
      return { ok: false, error: "Mohon balas dengan angka." };
    }
    case "choice": {
      const opts = choices(q);
      if (!opts.length) return text ? { ok: true, value: text } : { ok: false, error: "Mohon pilih jawaban." };
      const asNum = Number(text);
      if (Number.isInteger(asNum) && asNum >= 1 && asNum <= opts.length) return { ok: true, value: opts[asNum - 1]! };
      const match = opts.find((o) => o.toLowerCase() === text.toLowerCase());
      if (match) return { ok: true, value: match };
      return { ok: false, error: "Pilihan tidak dikenali. Balas dengan nomor pilihan." };
    }
    case "boolean": {
      const t = text.toLowerCase();
      if (["ya", "iya", "y", "yes", "ok", "oke", "setuju", "betul", "benar"].includes(t)) return { ok: true, value: "Ya" };
      if (["tidak", "no", "t", "n", "ngga", "nggak", "gak", "ga", "bukan"].includes(t)) return { ok: true, value: "Tidak" };
      return { ok: false, error: "Mohon balas: Ya atau Tidak." };
    }
    case "text":
    default:
      if (text) return { ok: true, value: text };
      return { ok: false, error: "Mohon balas dengan teks." };
  }
}

function formatQuestion(q: QLite): string {
  let hint = "";
  switch (q.type) {
    case "rating": { const { min, max } = ratingRange(q); hint = `\n\nBalas angka ${min}-${max}.`; break; }
    case "number": hint = "\n\nBalas dengan angka."; break;
    case "boolean": hint = "\n\nBalas: Ya / Tidak."; break;
    case "image": hint = "\n\nKirim foto/gambar."; break;
    case "choice": {
      const opts = choices(q);
      if (opts.length) hint = "\n\n" + opts.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n\nBalas dengan nomor pilihan.";
      break;
    }
  }
  const skip = q.required ? "" : "\n\n(Ketik LEWATI untuk melewati)";
  return `${q.text}${hint}${skip}`;
}

async function saveAnswer(responseId: string, questionId: string, value: string): Promise<void> {
  await prisma.answer.create({ data: { responseId, questionId, value } });
}

async function reply(vendor: string, to: string, text: string): Promise<void> {
  if (!to) return;
  const result = await getProvider(vendor).sendText({ to, text });
  await prisma.message.create({
    data: { direction: "out", vendor, vendorMessageId: result.vendorMessageId || null, text, payload: result.raw as object },
  });
}
