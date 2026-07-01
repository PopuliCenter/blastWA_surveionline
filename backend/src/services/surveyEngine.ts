import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import type { NormalizedInbound } from "../providers/types.js";
import { normalizePhone } from "../lib/phone.js";
import { findAutoResponse } from "./autoResponder.js";
import { parseFlowAnswers } from "../lib/flowJson.js";

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

  const storedText = ev.interactiveType === "nfm_reply" ? "[formulir survei terkirim]" : (ev.text ?? (ev.mediaType ? `[${ev.mediaType}]` : null));
  await prisma.message.create({
    data: { contactId: contact.id, direction: "in", vendor: ev.vendor, vendorMessageId: ev.messageId, text: storedText, payload: ev.raw as object },
  });

  // Tandai pesan dibaca (centang biru untuk pelanggan) — best-effort, tak memblokir alur.
  if (ev.messageId) {
    const prov = getProvider(ev.vendor);
    if (prov.markRead) prov.markRead(ev.messageId).catch(() => {});
  }

  // Balasan WhatsApp Flow (formulir terkirim) → simpan jawaban & selesaikan survei
  if (ev.interactiveType === "nfm_reply" && ev.flowResponse) { await handleFlowReply(ev, contact.id, phone, ev.vendor); return; }

  const lc = (ev.text ?? "").trim().toLowerCase();

  // 0) Opt-out / opt-in (anti-banned) — prioritas tertinggi
  if (OPT_OUT_WORDS.includes(lc)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { subscribed: false, optOutAt: new Date() } });
    await reply(ev.vendor, phone, "Anda telah berhenti menerima pesan dari kami. Balas *MULAI* untuk berlangganan kembali.", contact.id);
    return;
  }
  if (OPT_IN_WORDS.includes(lc)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { subscribed: true, optOutAt: null, consentSource: contact.consentSource ?? "inbound", consentAt: contact.consentAt ?? new Date() } });
    await reply(ev.vendor, phone, "Terima kasih, Anda kembali berlangganan pesan kami. 🙏", contact.id);
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
  if (active) {
    if (active.survey.mode === "flow") return; // menunggu pengisian formulir flow, abaikan teks
    await advanceSurvey(active.id, active.currentStep, active.survey.questions as QLite[], contact.id, phone, ev.vendor, ev, active.survey.closingMessage);
    return;
  }

  // 2) Pemicu kata kunci → mulai survei yang cocok (mis. responden ketik "isi survey")
  const triggered = await findTriggeredSurvey(ev.text ?? "");
  if (triggered && triggered.questions.length) {
    await startSurvey(triggered, contact.id, phone, ev.vendor);
    return;
  }

  // 3) Mulai survei dari blast terkait
  const recipient = await prisma.blastRecipient.findFirst({
    where: { contactId: contact.id, blast: { surveyId: { not: null } } },
    orderBy: { createdAt: "desc" },
    include: { blast: { include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } } } },
  });
  if (recipient?.blast?.survey && recipient.blast.survey.questions.length) {
    await startSurvey(recipient.blast.survey, contact.id, phone, ev.vendor, recipient.blastId);
    return;
  }

  // 4) Auto Reply / Agen AI
  const auto = await findAutoResponse(contact.id, ev.text ?? "");
  if (auto) await reply(ev.vendor, phone, auto, contact.id);
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

type SurveyLite = { id: string; title: string; description: string | null; mode: string; flowId: string | null; flowCta: string | null; questions: QLite[] };

// Mulai survei: mode flow → kirim formulir WhatsApp Flow; selain itu → chat per pesan.
async function startSurvey(survey: SurveyLite, contactId: string, phone: string, vendor: string, blastId?: string): Promise<void> {
  const provider = getProvider(vendor);
  if (survey.mode === "flow" && survey.flowId && typeof provider.sendFlow === "function") {
    const resp = await prisma.surveyResponse.create({ data: { surveyId: survey.id, contactId, currentStep: 0, ...(blastId ? { blastId } : {}) } });
    const body = survey.description ? `${survey.title}\n\n${survey.description}` : survey.title;
    const result = await provider.sendFlow({ to: phone, flowId: survey.flowId, flowToken: `resp_${resp.id}`, cta: survey.flowCta || "Isi Survei", bodyText: body, screen: "SURVEY" });
    await prisma.message.create({ data: { contactId, direction: "out", vendor, vendorMessageId: result.vendorMessageId || null, text: `[flow] ${survey.title}`, payload: result.raw as object, isBot: true } });
    return;
  }
  // Fallback / mode chat
  await prisma.surveyResponse.create({ data: { surveyId: survey.id, contactId, currentStep: 0, ...(blastId ? { blastId } : {}) } });
  const first = formatQuestion(survey.questions[0]!);
  const intro = survey.description ? `${survey.description}\n\n${first}` : first;
  await reply(vendor, phone, intro, contactId);
}

// Terima balasan WhatsApp Flow (response_json) → simpan jawaban & tandai selesai.
async function handleFlowReply(ev: NormalizedInbound, contactId: string, phone: string, vendor: string): Promise<void> {
  const resp = ev.flowResponse ?? {};
  const token = String((resp as any).flow_token ?? "");
  const withQuestions = { survey: { include: { questions: { orderBy: { order: "asc" as const } } } } };

  let surveyResponse: any = null;

  // Token sesi/pemicu: resp_<responseId>
  if (token.startsWith("resp_")) {
    const r = await prisma.surveyResponse.findUnique({ where: { id: token.slice(5) }, include: withQuestions });
    if (r && r.contactId === contactId) surveyResponse = r;
  }
  // Token broadcast: srv_<surveyId> → cari/ buat respons untuk kontak ini
  if (!surveyResponse && token.startsWith("srv_")) {
    const surveyId = token.slice(4);
    surveyResponse = await prisma.surveyResponse.findFirst({ where: { contactId, surveyId, completedAt: null }, orderBy: { startedAt: "desc" }, include: withQuestions });
    if (!surveyResponse) {
      const exists = await prisma.survey.findUnique({ where: { id: surveyId }, select: { id: true } });
      if (exists) surveyResponse = await prisma.surveyResponse.create({ data: { surveyId, contactId, currentStep: 0 }, include: withQuestions });
    }
  }
  // Fallback: respons flow belum selesai milik kontak ini
  if (!surveyResponse) {
    surveyResponse = await prisma.surveyResponse.findFirst({
      where: { contactId, completedAt: null, survey: { mode: "flow" } },
      orderBy: { startedAt: "desc" },
      include: withQuestions,
    });
  }
  if (!surveyResponse) return;
  if (surveyResponse.completedAt) return; // sudah pernah diproses
  const answers = parseFlowAnswers(resp as Record<string, unknown>, surveyResponse.survey.questions as QLite[]);
  for (const a of answers) await prisma.answer.create({ data: { responseId: surveyResponse.id, questionId: a.questionId, value: a.value } });
  await prisma.surveyResponse.update({ where: { id: surveyResponse.id }, data: { completedAt: new Date(), currentStep: surveyResponse.survey.questions.length } });
  await reply(vendor, phone, closingText(surveyResponse.survey.closingMessage), contactId);
}

async function advanceSurvey(responseId: string, step: number, questions: QLite[], contactId: string, phone: string, vendor: string, ev: NormalizedInbound, closingMessage?: string | null): Promise<void> {
  const current = questions[step];
  if (!current) { await prisma.surveyResponse.update({ where: { id: responseId }, data: { completedAt: new Date() } }); return; }

  const text = (ev.text ?? "").trim();

  // Skip (pertanyaan opsional)
  let savedValue: string;
  if (!current.required && SKIP_WORDS.includes(text.toLowerCase())) {
    savedValue = "[dilewati]";
    await saveAnswer(responseId, current.id, savedValue);
  } else {
    const v = validateAnswer(current, ev);
    if (!v.ok) {
      // Jawaban tidak valid → beri tahu & ulangi pertanyaan, jangan maju.
      await reply(vendor, phone, `${v.error}\n\n${formatQuestion(current)}`, contactId);
      return;
    }
    savedValue = v.value;
    await saveAnswer(responseId, current.id, savedValue);
  }

  // Skip logic: pertanyaan berikutnya bisa dilompati / survei diakhiri sesuai jawaban.
  const nextStep = nextStepWithBranch(current, step, savedValue, questions.length);
  const next = questions[nextStep];
  if (next) {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { currentStep: nextStep } });
    await reply(vendor, phone, formatQuestion(next), contactId);
  } else {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { currentStep: questions.length, completedAt: new Date() } });
    await reply(vendor, phone, closingText(closingMessage), contactId);
  }
}

// Kata penutup: pakai custom bila diisi, selain itu default.
function closingText(custom?: string | null): string {
  const c = (custom ?? "").trim();
  return c || "Terima kasih, semua jawaban Anda sudah kami terima. 🙏";
}

// Tentukan langkah berikutnya berdasarkan aturan percabangan (options.branches) pada pertanyaan.
// branches: [{ value: "<jawaban>", goto: "end" | <indeks pertanyaan 0-based> }]. Lompat hanya MAJU.
function nextStepWithBranch(current: QLite, step: number, savedValue: string, total: number): number {
  const def = step + 1;
  const branches = (current.options as { branches?: { value: string; goto: string | number }[] } | null)?.branches;
  if (!Array.isArray(branches) || !savedValue || savedValue === "[dilewati]") return def;
  const sv = savedValue.trim().toLowerCase();
  const m = branches.find((b) => String(b.value ?? "").trim().toLowerCase() === sv);
  if (!m) return def;
  if (m.goto === "end" || m.goto === -1) return total; // akhiri survei lebih awal
  const g = Number(m.goto);
  if (Number.isInteger(g) && g > step && g < total) return g; // lompat maju ke pertanyaan g
  return def;
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
      const lc = text.toLowerCase();
      const exact = opts.find((o) => o.toLowerCase() === lc);
      if (exact) return { ok: true, value: exact };
      // Toleransi: cocok sebagian bila TIDAK ambigu (hanya satu pilihan yang cocok)
      const partial = opts.filter((o) => o.toLowerCase().includes(lc) || lc.includes(o.toLowerCase()));
      if (partial.length === 1) return { ok: true, value: partial[0]! };
      return { ok: false, error: "Maaf, pilihan belum dikenali. Balas dengan *nomor* pilihan, ya." };
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

async function reply(vendor: string, to: string, text: string, contactId?: string): Promise<void> {
  if (!to) return;
  const result = await getProvider(vendor).sendText({ to, text });
  await prisma.message.create({
    data: { contactId: contactId ?? null, direction: "out", vendor, vendorMessageId: result.vendorMessageId || null, text, payload: result.raw as object, isBot: true },
  });
}
