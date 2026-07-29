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
  // Header media per blast (menimpa headerMediaUrl template lokal bila diisi)
  headerMediaType?: "image" | "document" | "video";
  headerMediaUrl?: string;
};

// Format header yang memerlukan lampiran file saat kirim.
const MEDIA_HEADERS = ["image", "document", "video"];

export type HeaderMedia = { headerMediaType: "image" | "document" | "video"; headerMediaUrl: string } | null;

/**
 * Bolehkah parameter tombol Flow (flow_token) disertakan pada blast ini?
 *
 * flow_token hanya sah bila tombol INDEX 0 template bertipe FLOW. Bila template memakai
 * QuickReply (mis. "Mulai Survei"), Meta menolak SELURUH kiriman dengan
 * #132018 "buttons: Button at index 0 must be of type QuickReply".
 *
 * Template tanpa tombol Flow tetap boleh diblast — hanya tanpa flow_token. Responden
 * memulai survei lewat kata kunci pemicu (mis. menekan QuickReply "Mulai Survei"),
 * lalu formulir Flow dikirim oleh mesin survei dengan token korelasinya sendiri.
 *
 * `synced=false` (template belum disinkron) → tak bisa dipastikan; pertahankan perilaku
 * lama (kirim flow_token) agar template Flow yang sah tidak kehilangan korelasi.
 */
export function shouldAttachFlowToken(args: { surveyIsFlow: boolean; synced: boolean; metaButtons: string[] }): boolean {
  if (!args.surveyIsFlow) return false;
  if (!args.synced) return true; // belum diketahui → jangan ubah perilaku
  return args.metaButtons[0] === "FLOW";
}

/**
 * Tentukan parameter header untuk sebuah blast.
 *
 * Format header MENURUT META adalah sumber kebenaran: parameter yang dikirim WAJIB cocok
 * dengan template yang sudah dibuat, kalau tidak Meta menolak SEMUA penerima dengan
 * #132012 "Parameter format does not match format in the created template"
 * (mis. "expected TEXT, received IMAGE").
 *
 * Bila format Meta belum diketahui (template belum disinkron / nama diketik manual),
 * kita tak bisa memvalidasi → ikuti input operator, lalu template lokal sebagai cadangan.
 */
export function resolveHeaderMedia(args: {
  templateName: string;
  metaHeaderFormat: string | null;
  localHeaderType: string | null;
  localHeaderMediaUrl: string | null;
  inputType: "image" | "document" | "video" | null;
  inputUrl: string | null;
}): HeaderMedia {
  const { templateName, metaHeaderFormat, localHeaderType, localHeaderMediaUrl, inputType, inputUrl } = args;

  if (metaHeaderFormat) {
    const wantsMedia = MEDIA_HEADERS.includes(metaHeaderFormat);
    if (!wantsMedia) {
      // Header TEXT (atau bukan media). Mengirim parameter media = ditolak Meta.
      if (inputType)
        throw new Error(
          `Template "${templateName}" ber-header ${metaHeaderFormat.toUpperCase()} di Meta, bukan media. ` +
            `Kosongkan "Header media" pada blast ini.`,
        );
      return null;
    }
    const url = inputUrl || localHeaderMediaUrl;
    if (!url)
      throw new Error(
        `Template "${templateName}" ber-header ${metaHeaderFormat.toUpperCase()} di Meta — ` +
          `wajib melampirkan file media pada blast ini.`,
      );
    return { headerMediaType: metaHeaderFormat as "image" | "document" | "video", headerMediaUrl: url };
  }

  // Format Meta belum diketahui.
  if (inputType && inputUrl) return { headerMediaType: inputType, headerMediaUrl: inputUrl };
  if (localHeaderType && MEDIA_HEADERS.includes(localHeaderType) && localHeaderMediaUrl)
    return { headerMediaType: localHeaderType as "image" | "document" | "video", headerMediaUrl: localHeaderMediaUrl };
  return null;
}

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

  const survey = input.surveyId
    ? await prisma.survey.findUnique({ where: { id: input.surveyId }, select: { id: true, mode: true } })
    : null;

  // Template lokal ber-header media → bawa URL-nya agar dikirim sebagai parameter header.
  // (Template yang dipilih langsung "dari Meta" tidak punya metadata lokal → dilewati;
  // bila template Meta itu ber-header media, buat padanannya di menu Template + isi URL.)
  const localTpl =
    templateName && vendor !== "baileys"
      ? await prisma.messageTemplate.findFirst({ where: { name: templateName, language: templateLang } })
      : null;

  // Survei mode flow → sertakan flow_token HANYA bila tombol index 0 template bertipe FLOW.
  // Template ber-QuickReply tetap boleh diblast; responden memulai survei lewat kata kunci.
  const attachFlow = shouldAttachFlowToken({
    surveyIsFlow: survey?.mode === "flow",
    synced: Boolean(localTpl?.metaSyncedAt),
    metaButtons: localTpl?.metaButtons ?? [],
  });
  const flowToken = attachFlow ? `srv_${survey!.id}` : undefined;
  const headerMedia = resolveHeaderMedia({
    templateName,
    metaHeaderFormat: localTpl?.metaHeaderFormat ?? null,
    localHeaderType: localTpl?.headerType ?? null,
    localHeaderMediaUrl: localTpl?.headerMediaUrl ?? null,
    inputType: input.headerMediaType ?? null,
    inputUrl: input.headerMediaUrl ?? null,
  });

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
          ...(headerMedia ?? {}),
        },
        opts: { delay: delayBase + i * 50 }, // stagger ringan
      };
    }),
  );

  return { ...blast, excludedOptOut };
}
