import { prisma } from "../db.js";
import { env } from "../env.js";
import { blastQueue } from "../queue/blastQueue.js";

export type CreateBlastInput = {
  surveyId?: string;
  segmentId: string;
  vendor?: string;
  templateName?: string; // wajib untuk meta/qontak; tak dipakai vendor templateless (baileys)
  templateLang?: string;
  messageText?: string;
  bodyParams?: string[];
  scheduledAt?: string; // ISO; bila ada → dijadwalkan
};

// Render teks pesan: ganti placeholder {{1}}, {{2}}, ... dengan bodyParams.
function renderText(messageText: string | undefined, params: string[]): string {
  let t = messageText ?? "";
  params.forEach((p, i) => {
    t = t.split(`{{${i + 1}}}`).join(p);
  });
  return t.trim();
}

export async function createBlast(input: CreateBlastInput) {
  const vendor = input.vendor ?? env.DEFAULT_VENDOR;
  const templateLang = input.templateLang ?? "id";
  // Baileys tak punya template Meta → simpan label saja agar kolom tetap terisi.
  const templateName = input.templateName ?? (vendor === "baileys" ? "(teks langsung)" : "");

  // Survei mode flow → kirim template ber-tombol Flow + flow_token untuk korelasi balasan
  const survey = input.surveyId ? await prisma.survey.findUnique({ where: { id: input.surveyId }, select: { id: true, mode: true } }) : null;
  const flowToken = survey?.mode === "flow" ? `srv_${survey.id}` : undefined;

  const segment = await prisma.segment.findUnique({
    where: { id: input.segmentId },
    include: { contacts: { include: { contact: true } } },
  });
  if (!segment) throw new Error("Segmen tidak ditemukan");
  const allContacts = segment.contacts.map((sc) => sc.contact);
  if (allContacts.length === 0) throw new Error("Segmen tidak punya kontak");
  // Kecualikan kontak yang sudah opt-out (anti-banned)
  const contacts = allContacts.filter((c) => c.subscribed);
  const excludedOptOut = allContacts.length - contacts.length;
  if (contacts.length === 0) throw new Error("Semua kontak di segmen ini sudah berhenti berlangganan (opt-out)");

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

  const blast = await prisma.blast.create({
    data: {
      surveyId: input.surveyId ?? null,
      segmentId: input.segmentId,
      vendor,
      templateName,
      templateLang,
      messageText: input.messageText ?? null,
      status: scheduledAt ? "scheduled" : "running",
      scheduledAt,
    },
  });

  // Buat penerima
  await prisma.blastRecipient.createMany({
    data: contacts.map((c) => ({
      blastId: blast.id,
      contactId: c.id,
      vendor,
      status: "queued" as const,
    })),
  });

  const recipients = await prisma.blastRecipient.findMany({ where: { blastId: blast.id } });

  // Enqueue job (delay untuk yang terjadwal)
  const delayBase = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  await blastQueue.addBulk(
    recipients.map((r, i) => {
      const c = contactById.get(r.contactId)!;
      // Personalisasi sederhana: bila bodyParams kosong, pakai [nama]
      const bodyParams = input.bodyParams ?? [c.name ?? "Pelanggan"];
      // Teks final untuk vendor templateless (Baileys): {{1}},{{2}}.. → bodyParams.
      const text = renderText(input.messageText, bodyParams);
      return {
        name: "send",
        data: {
          recipientId: r.id,
          blastId: blast.id,
          vendor,
          to: c.phone,
          templateName,
          templateLang,
          bodyParams,
          ...(text ? { text } : {}),
          ...(flowToken ? { flowToken } : {}),
        },
        opts: { delay: delayBase + i * 50 }, // stagger ringan
      };
    }),
  );

  return { ...blast, excludedOptOut };
}
