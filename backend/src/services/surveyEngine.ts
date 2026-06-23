import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import type { NormalizedInbound } from "../providers/types.js";
import { normalizePhone } from "../lib/phone.js";

// Mesin survei berbasis chat:
// - balasan user dipetakan ke pertanyaan survei aktif yang sedang berjalan
// - bila belum ada sesi, balasan terhadap blast memulai sesi survei baru
// Lihat docs/ARCHITECTURE.md & ROADMAP Fase 2.

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
  const recipient = await prisma.blastRecipient.findUnique({
    where: { vendorMessageId: ev.refMessageId },
  });
  if (!recipient) return;

  // Hanya naikkan status (jangan turun: read > delivered > sent)
  const rank = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 1 } as const;
  const next = ev.deliveryStatus;
  if (rank[next] < rank[recipient.status]) return;

  await prisma.blastRecipient.update({ where: { id: recipient.id }, data: { status: next } });

  // Update agregat blast
  const field =
    next === "delivered" ? "deliveredCount" : next === "read" ? "readCount" : next === "failed" ? "failedCount" : null;
  if (field) {
    await prisma.blast.update({ where: { id: recipient.blastId }, data: { [field]: { increment: 1 } } });
  }
}

async function handleMessage(ev: NormalizedInbound): Promise<void> {
  if (!ev.from) return;
  const phone = normalizePhone(ev.from);

  const contact = await prisma.contact.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });

  await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: "in",
      vendor: ev.vendor,
      vendorMessageId: ev.messageId,
      text: ev.text,
      payload: ev.raw as object,
    },
  });

  const text = (ev.text ?? "").trim();

  // 1) Ada sesi survei berjalan?
  const active = await prisma.surveyResponse.findFirst({
    where: { contactId: contact.id, completedAt: null },
    orderBy: { startedAt: "desc" },
    include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } },
  });

  if (active) {
    await advanceSurvey(active, contact.id, ev.vendor, text);
    return;
  }

  // 2) Tidak ada sesi → mulai dari blast terakhir yang punya survei
  const recipient = await prisma.blastRecipient.findFirst({
    where: { contactId: contact.id, blast: { surveyId: { not: null } } },
    orderBy: { createdAt: "desc" },
    include: { blast: { include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } } } },
  });

  if (recipient?.blast?.survey && recipient.blast.survey.questions.length > 0) {
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: recipient.blast.survey.id,
        contactId: contact.id,
        blastId: recipient.blastId,
        currentStep: 0,
      },
    });
    const first = recipient.blast.survey.questions[0]!;
    await reply(ev.vendor, phone, first.text);
    void response;
  }
  // 3) Tidak ada konteks → diamkan (atau bisa kirim pesan default di sini)
}

async function advanceSurvey(
  active: { id: string; currentStep: number; survey: { questions: { id: string; text: string }[] } },
  contactId: string,
  vendor: string,
  text: string,
): Promise<void> {
  const questions = active.survey.questions;
  const step = active.currentStep;
  const current = questions[step];
  if (!current) {
    await prisma.surveyResponse.update({ where: { id: active.id }, data: { completedAt: new Date() } });
    return;
  }

  // Simpan jawaban untuk pertanyaan saat ini
  await prisma.answer.create({
    data: { responseId: active.id, questionId: current.id, value: text },
  });

  const nextStep = step + 1;
  const next = questions[nextStep];
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  const phone = contact?.phone ?? "";

  if (next) {
    await prisma.surveyResponse.update({ where: { id: active.id }, data: { currentStep: nextStep } });
    await reply(vendor, phone, next.text);
  } else {
    await prisma.surveyResponse.update({
      where: { id: active.id },
      data: { currentStep: nextStep, completedAt: new Date() },
    });
    await reply(vendor, phone, "Terima kasih, jawaban Anda sudah kami terima. 🙏");
  }
}

async function reply(vendor: string, to: string, text: string): Promise<void> {
  if (!to) return;
  const provider = getProvider(vendor);
  const result = await provider.sendText({ to, text });
  await prisma.message.create({
    data: {
      direction: "out",
      vendor,
      vendorMessageId: result.vendorMessageId || null,
      text,
      payload: result.raw as object,
    },
  });
}
