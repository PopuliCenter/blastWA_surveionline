import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import type { NormalizedInbound } from "../providers/types.js";
import { normalizePhone } from "../lib/phone.js";
import { findAutoResponse } from "./autoResponder.js";
import { parseFlowAnswers } from "../lib/flowJson.js";
import { validateAnswer, formatQuestion, closingText, nextStepWithBranch, type QLite } from "../lib/surveyLogic.js";

// Mesin survei berbasis chat dengan tipe pertanyaan kaya:
// text | rating (min-max, label jangkar opsional) | number | choice (1 pilihan) |
// multichoice (boleh >1, balas "1,3") | boolean (ya/tidak) | image
// Mendukung pertanyaan opsional (skip) & validasi jawaban (re-prompt bila salah).
// Logika murni (validasi, format, percabangan, penutup) ada di lib/surveyLogic.ts (teruji unit).

const SKIP_WORDS = ["lewati", "skip", "lewat", "-"];
const OPT_OUT_WORDS = ["berhenti", "stop", "unsubscribe", "unsub", "cabut", "hapus saya", "berhenti langganan"];
const OPT_IN_WORDS = ["mulai", "langganan", "berlangganan", "subscribe", "daftar", "gabung"];

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
  const field =
    next === "delivered" ? "deliveredCount" : next === "read" ? "readCount" : next === "failed" ? "failedCount" : null;
  if (field) await prisma.blast.update({ where: { id: recipient.blastId }, data: { [field]: { increment: 1 } } });
}

async function handleMessage(ev: NormalizedInbound): Promise<void> {
  if (!ev.from) return;
  const phone = normalizePhone(ev.from);
  const contact = await prisma.contact.upsert({ where: { phone }, update: {}, create: { phone } });

  const storedText =
    ev.interactiveType === "nfm_reply"
      ? "[formulir survei terkirim]"
      : (ev.text ?? (ev.mediaType ? `[${ev.mediaType}]` : null));
  await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: "in",
      vendor: ev.vendor,
      vendorMessageId: ev.messageId,
      text: storedText,
      payload: ev.raw as object,
    },
  });

  // Tandai pesan dibaca (centang biru untuk pelanggan) — best-effort, tak memblokir alur.
  if (ev.messageId) {
    const prov = getProvider(ev.vendor);
    if (prov.markRead) prov.markRead(ev.messageId).catch(() => {});
  }

  // Balasan WhatsApp Flow (formulir terkirim) → simpan jawaban & selesaikan survei
  if (ev.interactiveType === "nfm_reply" && ev.flowResponse) {
    await handleFlowReply(ev, contact.id, phone, ev.vendor);
    return;
  }

  const lc = (ev.text ?? "").trim().toLowerCase();

  // 0) Opt-out / opt-in (anti-banned) — prioritas tertinggi
  if (OPT_OUT_WORDS.includes(lc)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { subscribed: false, optOutAt: new Date() } });
    await reply(
      ev.vendor,
      phone,
      "Anda telah berhenti menerima pesan dari kami. Balas *MULAI* untuk berlangganan kembali.",
      contact.id,
    );
    return;
  }
  if (OPT_IN_WORDS.includes(lc)) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        subscribed: true,
        optOutAt: null,
        consentSource: contact.consentSource ?? "inbound",
        consentAt: contact.consentAt ?? new Date(),
      },
    });
    await reply(ev.vendor, phone, "Terima kasih, Anda kembali berlangganan pesan kami. 🙏", contact.id);
    return;
  }
  // Kontak yang membalas = persetujuan implisit (bila belum tercatat)
  if (!contact.consentSource) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { consentSource: "inbound", consentAt: new Date() },
    });
  }

  // 1) Sesi survei berjalan?
  const active = await prisma.surveyResponse.findFirst({
    where: { contactId: contact.id, completedAt: null },
    orderBy: { startedAt: "desc" },
    include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (active) {
    if (active.survey.mode === "flow") return; // menunggu pengisian formulir flow, abaikan teks
    await advanceSurvey(
      active.id,
      active.currentStep,
      active.survey.questions as QLite[],
      contact.id,
      phone,
      ev.vendor,
      ev,
      active.survey.closingMessage,
    );
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

type SurveyLite = {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  flowId: string | null;
  flowCta: string | null;
  questions: QLite[];
};

// Mulai survei: mode flow → kirim formulir WhatsApp Flow; selain itu → chat per pesan.
async function startSurvey(
  survey: SurveyLite,
  contactId: string,
  phone: string,
  vendor: string,
  blastId?: string,
): Promise<void> {
  const provider = getProvider(vendor);
  if (survey.mode === "flow" && survey.flowId && typeof provider.sendFlow === "function") {
    const resp = await prisma.surveyResponse.create({
      data: { surveyId: survey.id, contactId, currentStep: 0, ...(blastId ? { blastId } : {}) },
    });
    const body = survey.description ? `${survey.title}\n\n${survey.description}` : survey.title;
    const result = await provider.sendFlow({
      to: phone,
      flowId: survey.flowId,
      flowToken: `resp_${resp.id}`,
      cta: survey.flowCta || "Isi Survei",
      bodyText: body,
      screen: "SURVEY",
    });
    await prisma.message.create({
      data: {
        contactId,
        direction: "out",
        vendor,
        vendorMessageId: result.vendorMessageId || null,
        text: `[flow] ${survey.title}`,
        payload: result.raw as object,
        isBot: true,
      },
    });
    return;
  }
  // Fallback / mode chat
  await prisma.surveyResponse.create({
    data: { surveyId: survey.id, contactId, currentStep: 0, ...(blastId ? { blastId } : {}) },
  });
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
    surveyResponse = await prisma.surveyResponse.findFirst({
      where: { contactId, surveyId, completedAt: null },
      orderBy: { startedAt: "desc" },
      include: withQuestions,
    });
    if (!surveyResponse) {
      const exists = await prisma.survey.findUnique({ where: { id: surveyId }, select: { id: true } });
      if (exists)
        surveyResponse = await prisma.surveyResponse.create({
          data: { surveyId, contactId, currentStep: 0 },
          include: withQuestions,
        });
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
  for (const a of answers)
    await prisma.answer.create({ data: { responseId: surveyResponse.id, questionId: a.questionId, value: a.value } });
  await prisma.surveyResponse.update({
    where: { id: surveyResponse.id },
    data: { completedAt: new Date(), currentStep: surveyResponse.survey.questions.length },
  });
  await reply(vendor, phone, closingText(surveyResponse.survey.closingMessage), contactId);
}

async function advanceSurvey(
  responseId: string,
  step: number,
  questions: QLite[],
  contactId: string,
  phone: string,
  vendor: string,
  ev: NormalizedInbound,
  closingMessage?: string | null,
): Promise<void> {
  const current = questions[step];
  if (!current) {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { completedAt: new Date() } });
    return;
  }

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
    await prisma.surveyResponse.update({
      where: { id: responseId },
      data: { currentStep: questions.length, completedAt: new Date() },
    });
    await reply(vendor, phone, closingText(closingMessage), contactId);
  }
}

async function saveAnswer(responseId: string, questionId: string, value: string): Promise<void> {
  await prisma.answer.create({ data: { responseId, questionId, value } });
}

async function reply(vendor: string, to: string, text: string, contactId?: string): Promise<void> {
  if (!to) return;
  const result = await getProvider(vendor).sendText({ to, text });
  await prisma.message.create({
    data: {
      contactId: contactId ?? null,
      direction: "out",
      vendor,
      vendorMessageId: result.vendorMessageId || null,
      text,
      payload: result.raw as object,
      isBot: true,
    },
  });
}
