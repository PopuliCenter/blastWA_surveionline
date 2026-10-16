import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import type { NormalizedInbound, SendResult } from "../providers/types.js";
import { normalizePhone } from "../lib/phone.js";
import { ALLOWED_FROM, MESSAGE_ALLOWED_FROM, counterField } from "../lib/deliveryStatus.js";
import {
  isOptOutExact,
  isOptInExact,
  isOptOutMessage,
  isOptInMessage,
  OPT_OUT_REPLY,
  OPT_IN_REPLY,
} from "../lib/optOut.js";
import { suppressNumber, unsuppressNumber } from "../lib/optOutList.js";
import { kodeProvinsiDari } from "../lib/wilayah.js";
import {
  bolehMulaiSurvei,
  pesanKuotaPenuh,
  provinsiAwal,
  pulihkanRespons,
  stempelProvinsi,
  tolakKarenaKuota,
  tutupRespons,
} from "./kuotaSurvei.js";
import { findAutoResponse } from "./autoResponder.js";
import { enqueueSheetSync } from "../queue/sheetQueue.js";
import { parseFlowAnswers, flowOutOfSync } from "../lib/flowJson.js";
import { logError } from "../lib/errorLog.js";
import {
  BERLAKU_PERMINTAAN_MS,
  PESAN_MINTA_LOKASI_BAWAAN,
  PETUNJUK_LOKASI_TANPA_TOMBOL,
  TERIMA_KASIH_LOKASI,
  bulatkanKoordinat,
  saringLokasi,
} from "../lib/lokasi.js";
import { provinsiDariTitik } from "./petaProvinsi.js";
import {
  validateAnswer,
  formatQuestion,
  closingText,
  nextStepWithBranch,
  isFlowAbandoned,
  shouldStartSurveyFromBlast,
  looksLikeQuestion,
  matchesTriggerInSentence,
  disaringKeluar,
  saringJawaban,
  type QLite,
} from "../lib/surveyLogic.js";

// Mesin survei berbasis chat dengan tipe pertanyaan kaya:
// text | rating (min-max, label jangkar opsional) | number | choice (1 pilihan) |
// multichoice (boleh >1, balas "1,3") | boolean (ya/tidak) | image
// Mendukung pertanyaan opsional (skip) & validasi jawaban (re-prompt bila salah).
// Logika murni (validasi, format, percabangan, penutup) ada di lib/surveyLogic.ts (teruji unit).

const SKIP_WORDS = ["lewati", "skip", "lewat", "-"];
// Simpan/cabut langganan + balas konfirmasinya. Dipakai dari dua tempat: pencocokan
// ketat di awal, dan pencocokan longgar untuk kontak yang tidak sedang mengisi survei.
async function doOptOut(contactId: string, vendor: string, phone: string): Promise<void> {
  await prisma.contact.update({ where: { id: contactId }, data: { subscribed: false, optOutAt: new Date() } });
  // Dicatat juga di daftar penekan yang berdiri sendiri. Penanda pada Contact ikut hilang
  // bila kontaknya dihapus, dan tanpa daftar ini nomor yang sama bisa diimpor ulang lalu
  // dihubungi lagi seolah tak pernah menolak.
  await suppressNumber(phone, "pesan berhenti");
  await reply(vendor, phone, OPT_OUT_REPLY, contactId, "optout");
}

async function doOptIn(
  contact: { id: string; consentSource: string | null; consentAt: Date | null },
  vendor: string,
  phone: string,
): Promise<void> {
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      subscribed: true,
      optOutAt: null,
      consentSource: contact.consentSource ?? "inbound",
      consentAt: contact.consentAt ?? new Date(),
    },
  });
  // Orangnya sendiri yang menyatakan berlangganan lagi — satu-satunya alasan sah untuk
  // mengangkat nomor dari daftar penekan.
  await unsuppressNumber(phone);
  await reply(vendor, phone, OPT_IN_REPLY, contact.id, "optout");
}

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
  const next = ev.deliveryStatus;

  // Status antar dicatat pada pesannya sendiri LEBIH DULU, terlepas dari blast.
  // Dulu fungsi ini langsung berhenti saat pesannya bukan bagian blast, sehingga
  // formulir survei dan balasan bot yang gagal diantar tidak meninggalkan jejak di mana
  // pun — vendor sudah menerima panggilan API-nya, jadi aplikasi terlanjur mencatat
  // "terkirim" dan kegagalannya tak pernah terlihat sampai responden mengeluh.
  //
  // Penjagaan transisi memakai satu UPDATE bersyarat, sama seperti blast di bawah:
  // callback datang "at least once" dan bisa kembar, jadi status yang sudah lebih maju
  // tidak boleh dimundurkan oleh callback yang telat.
  await prisma.message.updateMany({
    where: {
      vendorMessageId: ev.refMessageId,
      OR: [{ deliveryStatus: null }, { deliveryStatus: { in: [...MESSAGE_ALLOWED_FROM[next]] } }],
    },
    data: {
      deliveryStatus: next,
      failedReason: next === "failed" ? (ev.deliveryError ?? "Vendor tidak menyebutkan alasan.") : null,
    },
  });

  const recipient = await prisma.blastRecipient.findUnique({ where: { vendorMessageId: ev.refMessageId } });
  if (!recipient) return;

  // Perubahan status dilakukan BERSYARAT di database: updateMany hanya mengenai baris
  // yang statusnya masih boleh berpindah ke `next`. Ini satu perintah UPDATE, jadi bila
  // dua callback kembar datang bersamaan hanya satu yang lolos (count 1) dan penghitung
  // pun naik sekali. Membaca dulu lalu menulis (findUnique + update) tidak aman di sini
  // karena Meta mengirim status blast dalam burst.
  const moved = await prisma.blastRecipient.updateMany({
    where: { id: recipient.id, status: { in: [...ALLOWED_FROM[next]] } },
    data: { status: next },
  });
  if (moved.count === 0) return; // callback duplikat atau transisi mundur → abaikan

  const field = counterField(next);
  if (field) await prisma.blast.update({ where: { id: recipient.blastId }, data: { [field]: { increment: 1 } } });
}

async function handleMessage(ev: NormalizedInbound): Promise<void> {
  if (!ev.from) return;
  const phone = normalizePhone(ev.from);
  // Nama profil WhatsApp dipakai HANYA untuk mengisi kekosongan. Nama dari impor atau
  // input manual lebih mungkin akurat, sedangkan push name bisa diubah pemilik nomor
  // kapan saja — jadi `update: {}` sengaja dibiarkan kosong agar tak pernah menimpa.
  const contact = await prisma.contact.upsert({
    where: { phone },
    update: {},
    create: { phone, name: ev.senderName },
  });
  if (ev.senderName && !contact.name) {
    // Predikat `name: null` membuat penulisannya bersyarat di database, jadi dua pesan
    // yang datang bersamaan dari nomor yang sama tidak saling menimpa.
    await prisma.contact.updateMany({ where: { id: contact.id, name: null }, data: { name: ev.senderName } });
  }

  const storedText =
    ev.interactiveType === "nfm_reply"
      ? "[formulir survei terkirim]"
      : ev.location
        ? "[lokasi]"
        : (ev.text ?? (ev.mediaType ? `[${ev.mediaType}]` : null));
  await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: "in",
      vendor: ev.vendor,
      vendorMessageId: ev.messageId,
      text: storedText,
      // Lokasi di payload disaring (dibulatkan, nama tempat & alamat dibuang) — titik GPS
      // mentah tidak boleh tersimpan di mana pun, termasuk riwayat pesan.
      payload: saringLokasi(ev.raw) as object,
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

  // Lokasi yang dibagikan. Bila ada permintaan lokasi yang masih berlaku, ini jawabannya.
  // Bila tidak, lokasi TIDAK BOLEH memulai apa pun: dulu pesan lokasi dari penerima blast
  // terbaca sebagai pesan kosong yang lolos penyaring, dan survei terkirim ke orang yang
  // hanya membagikan lokasinya. Di tengah survei chat, ia diteruskan ke bawah dan dibalas
  // bahwa jawabannya harus berupa teks — seperti sebelumnya.
  if (ev.location) {
    // Hanya lewat vendor yang bisa MEMINTA lokasi (lihat kirimPenutup): nomor yang sama
    // bisa menghubungi beberapa nomor kita, dan lokasi lewat nomor lain bukan jawaban
    // atas permintaan itu.
    const bisaMinta = typeof getProvider(ev.vendor).sendLocationRequest === "function";
    if (bisaMinta && (await simpanLokasi(ev.location, ev.contextId, contact.id, phone, ev.vendor))) return;
    // Sama dengan sesi yang dipilih langkah 1 di bawah (yang TERBARU), agar lokasi tidak
    // pernah jatuh ke cabang formulir Flow / auto-reply sebagai pesan kosong.
    const berjalan = await prisma.surveyResponse.findFirst({
      where: { contactId: contact.id, completedAt: null },
      orderBy: { startedAt: "desc" },
      select: { survey: { select: { mode: true } } },
    });
    if (!berjalan || berjalan.survey.mode === "flow") return;
  }

  // 0) Opt-out / opt-in (anti-banned) — prioritas tertinggi.
  // Di sini sengaja dipakai pencocokan KETAT (seluruh pesan = satu perintah), karena
  // blok ini juga dilewati kontak yang sedang mengisi survei. Di survei kebijakan
  // publik, jawaban pendek seperti "cabut saja" atau "stop subsidi" adalah JAWABAN —
  // bukan permintaan berhenti. Frasa yang lebih longgar diperiksa belakangan, hanya
  // untuk kontak yang tidak sedang mengisi survei.
  if (isOptOutExact(ev.text ?? "")) {
    await doOptOut(contact.id, ev.vendor, phone);
    return;
  }
  if (isOptInExact(ev.text ?? "")) {
    await doOptIn(contact, ev.vendor, phone);
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
  let active = await prisma.surveyResponse.findFirst({
    where: { contactId: contact.id, completedAt: null },
    orderBy: { startedAt: "desc" },
    include: { survey: { include: { questions: { orderBy: { order: "asc" } } } } },
  });

  // Formulir Flow yang tak kunjung diisi TIDAK boleh mengunci kontak selamanya.
  // Lewat jendela 24 jam → anggap ditinggalkan, pesan berikutnya diproses normal
  // (pemicu survei, auto-reply, agen AI).
  if (active && active.survey.mode === "flow" && isFlowAbandoned(active.startedAt)) active = null;

  if (active) {
    if (active.survey.mode === "flow") {
      // Formulir masih ditunggu. Bila responden mengirim kata kunci pemicu lagi
      // (formulir tak jadi diisi / chat dihapus / pesan hilang), kirim ulang formulirnya.
      const again = await findTriggeredSurvey(ev.text ?? "");
      if (again && again.questions.length) {
        // Buang respons menggantung yang BELUM berisi jawaban agar tak menumpuk.
        await prisma.surveyResponse.deleteMany({ where: { id: active.id, answers: { none: {} } } });
        await startSurvey(again, contact.id, phone, ev.vendor);
        return;
      }
      // Dulu teks lain DIDIAMKAN TOTAL sampai formulir disubmit. Laporan lapangan:
      // responden menyapa dan bertanya dulu ("Apakah ada survei") sebelum menekan
      // tombol, dan kebisuan total terbaca seperti nomor mati — merusak kepercayaan
      // justru pada momen orang menimbang mau ikut atau tidak. Berbeda dari mode chat
      // di bawah, jawaban flow datang lewat FORMULIR, bukan teks, jadi teks bebas di
      // sini tidak mungkin jawaban survei dan aman dialihkan:
      //  • permintaan berhenti/langganan longgar (aman — bukan jawaban survei);
      //  • sisanya ke Auto Reply / Agen AI, yang tahu survei aktif dan kata pemicunya
      //    (menyuruh balas kata pemicu pun tak apa: cabang di atas mengirim ulang
      //    formulirnya).
      if (isOptOutMessage(ev.text ?? "")) {
        await doOptOut(contact.id, ev.vendor, phone);
        return;
      }
      if (isOptInMessage(ev.text ?? "")) {
        await doOptIn(contact, ev.vendor, phone);
        return;
      }
      const auto = await findAutoResponse(contact.id, ev.text ?? "");
      if (auto) await reply(ev.vendor, phone, auto.text, contact.id, auto.source);
      return;
    }
    await advanceSurvey(
      active.id,
      active.currentStep,
      active.survey.questions as QLite[],
      contact.id,
      phone,
      ev.vendor,
      ev,
      active.survey,
    );
    return;
  }

  // 2) Pemicu kata kunci → mulai survei yang cocok (mis. responden ketik "isi survey")
  const triggered = await findTriggeredSurvey(ev.text ?? "");
  if (triggered && triggered.questions.length) {
    // Survei "sekali saja": tolak halus, jangan diamkan (responden perlu tahu alasannya).
    if (await alreadyCompleted(triggered, contact.id)) {
      await reply(ev.vendor, phone, ALREADY_DONE_TEXT, contact.id);
      return;
    }
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
    // Pernah selesai SEKALI saja — apa pun pengaturan boleh-ulang — cukup untuk berhenti
    // menawarkan otomatis. BUKAN alreadyCompleted(): helper itu mengembalikan false untuk
    // survei boleh-ulang, sehingga mesin menawarkan formulir lagi pada SETIAP pesan dalam
    // jendela 24 jam dan Auto Reply / Agen AI tak pernah kebagian. Tugas jalur blast
    // (mengubah penerima jadi responden) tuntas pada pengisian pertama; mengulang tetap
    // bisa lewat kata pemicu.
    //
    // Respons yang ditolak kuota SENGAJA ikut terhitung di sini: orangnya sudah dibalas
    // bahwa kuota penuh, dan menawarinya formulir lagi pada pesan berikutnya hanya akan
    // berujung penolakan yang sama.
    const pernahSelesai = await prisma.surveyResponse.findFirst({
      where: { surveyId: recipient.blast.survey.id, contactId: contact.id, completedAt: { not: null } },
      select: { id: true },
    });
    if (
      shouldStartSurveyFromBlast({
        blastSentAt: recipient.createdAt,
        alreadyCompleted: Boolean(pernahSelesai),
        text: ev.text ?? "",
      })
    ) {
      await startSurvey(recipient.blast.survey, contact.id, phone, ev.vendor, recipient.blastId);
      return;
    }
    // Sengaja TIDAK return: pesan diteruskan ke Auto Reply / Agen AI. Dulu di sini
    // dibalas "jawaban Anda sudah kami terima" lalu berhenti, sehingga kontak yang
    // pernah diblast tak pernah bisa mendapat balasan sapaan. Pesan itu tetap dikirim
    // pada jalur pemicu eksplisit di atas, tempat ia memang bermakna.
  }

  // 3b) Permintaan berhenti/berlangganan yang tidak persis satu perintah — mis. "STOP.",
  // "berhenti ya", "saya mau berhenti". Diperiksa DI SINI, paling belakang, karena:
  //  • kontak sudah dipastikan tidak sedang mengisi survei, jadi jawaban survei pendek
  //    tidak mungkin disalahartikan; dan
  //  • pemicu survei sudah dicek lebih dulu, sehingga "mulai survei" tetap memulai survei
  //    dan tidak tertangkap sebagai perintah berlangganan.
  // Membiarkan permintaan berhenti tak terjawab jauh lebih mahal: responden akan
  // memblokir atau melaporkan nomor, dan itu menekan quality rating di Meta.
  if (isOptOutMessage(ev.text ?? "")) {
    await doOptOut(contact.id, ev.vendor, phone);
    return;
  }
  if (isOptInMessage(ev.text ?? "")) {
    await doOptIn(contact, ev.vendor, phone);
    return;
  }

  // 4) Auto Reply / Agen AI
  const auto = await findAutoResponse(contact.id, ev.text ?? "");
  if (auto) await reply(ev.vendor, phone, auto.text, contact.id, auto.source);
}

const ALREADY_DONE_TEXT = "Terima kasih, jawaban Anda untuk survei ini sudah kami terima sebelumnya. 🙏";

// Survei "sekali saja": sudah pernah DISELESAIKAN kontak ini?
// Respons yang belum selesai tidak dihitung — responden yang batal mengisi tetap boleh mengulang.
// Respons yang ditolak kuota juga tidak: orangnya belum pernah benar-benar ikut, dan bila
// kuotanya dinaikkan ia harus bisa mengisi — bukan dibalas "jawaban Anda sudah kami terima".
async function alreadyCompleted(survey: { id: string; oncePerContact: boolean }, contactId: string): Promise<boolean> {
  if (!survey.oncePerContact) return false;
  return sudahPernahDiterima(survey.id, contactId);
}

async function sudahPernahDiterima(surveyId: string, contactId: string): Promise<boolean> {
  const done = await prisma.surveyResponse.findFirst({
    where: { surveyId, contactId, completedAt: { not: null }, ditolakKuotaPada: null },
    select: { id: true },
  });
  return Boolean(done);
}

// Cari survei aktif yang kata kunci pemicunya cocok dengan teks masuk.
async function findTriggeredSurvey(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const surveys = await prisma.survey.findMany({
    where: { triggerEnabled: true, status: "active" },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  const kataKunci = (s: (typeof surveys)[number]): string[] =>
    (s.triggerKeywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);

  // 1) Pesan PERSIS sama dengan kata kunci → selalu memulai survei, apa pun bentuknya.
  for (const s of surveys) if (kataKunci(s).some((k) => t === k)) return s;

  // 2) Pertanyaan TENTANG survei bukan perintah memulainya. "Cara isi survei" mengandung
  // kata kunci "isi survei", tapi maksudnya bertanya — biarkan Auto Reply / Agen AI yang
  // menjawab, jangan langsung melempar responden ke dalam survei.
  if (looksLikeQuestion(t)) return null;

  // 3) Kata kunci muncul sebagai frasa utuh di kalimat pendek, mis. "saya mau isi survei".
  // BUKAN includes() mentah — itu dulu menjaring "sudah saya isi surveinya" (potongan
  // kata) dan kalimat panjang yang cuma menyebut survei, lalu melempar pengirimnya ke
  // pertanyaan 1. Yang tak cocok di sini jatuh ke Auto Reply / Agen AI, bukan didiamkan.
  for (const s of surveys) if (kataKunci(s).some((k) => matchesTriggerInSentence(t, k))) return s;
  return null;
}

type SurveyLite = {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  flowId: string | null;
  flowCta: string | null;
  bannerUrl: string | null; // gambar pembuka (header pesan flow / caption di mode chat)
  pesanKuotaPenuh: string | null; // balasan saat kuota penuh (null = teks umum bawaan)
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

  // Kuota diperiksa SEBELUM apa pun dikirim. Untuk kontak hasil impor, provinsinya sudah
  // diketahui dari atribut, sehingga penerima dari provinsi yang kuotanya penuh ditolak
  // tanpa satu pesan survei pun terkirim. Untuk responden organik yang baru pertama kali
  // datang, provinsinya belum diketahui di titik ini — yang berlaku hanya batas global, dan
  // batas provinsinya diperiksa lagi begitu ia menjawab pertanyaan wilayah.
  const kontak = await prisma.contact.findUnique({ where: { id: contactId }, select: { attributes: true } });
  const kodeProv = await provinsiAwal(survey.id, contactId, kontak?.attributes);
  const kuota = await bolehMulaiSurvei(survey.id, kodeProv);
  if (!kuota.boleh) {
    // Dijawab, bukan didiamkan: kebisuan terbaca seperti nomor mati dan merusak kepercayaan
    // justru pada orang yang bersedia ikut.
    await balasKuotaPenuh(vendor, phone, contactId, survey.id, survey.pesanKuotaPenuh);
    return;
  }

  if (survey.mode === "flow" && survey.flowId && typeof provider.sendFlow === "function") {
    const resp = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        contactId,
        currentStep: 0,
        ...(kodeProv ? { kodeProvinsi: kodeProv } : {}),
        ...(blastId ? { blastId } : {}),
      },
    });
    const body = survey.description ? `${survey.title}\n\n${survey.description}` : survey.title;
    const flowInput = {
      to: phone,
      flowId: survey.flowId,
      flowToken: `resp_${resp.id}`,
      cta: survey.flowCta || "Isi Survei",
      bodyText: body,
      screen: "SURVEY",
    };
    let result = await provider.sendFlow({
      ...flowInput,
      ...(survey.bannerUrl ? { headerImageUrl: survey.bannerUrl } : {}),
    });
    // Gagal-aman: banner hanyalah estetika — jangan sampai formulir survei batal terkirim
    // karena gambarnya ditolak Meta (URL tak bisa diunduh, ukuran/rasio, dll).
    // Ulangi TANPA banner, dan catat penyebab aslinya agar bisa ditelusuri.
    if (result.status === "failed" && survey.bannerUrl) {
      logError("backend", new Error("Banner Flow ditolak — mengirim ulang tanpa banner"), {
        surveyId: survey.id,
        bannerUrl: survey.bannerUrl,
        metaResponse: result.raw,
      });
      result = await provider.sendFlow(flowInput);
    }
    // Formulir benar-benar tak terkirim → buang respons yang terlanjur dibuat, supaya
    // kontak tidak tercatat "sedang mengisi" padahal tak pernah menerima apa pun
    // (dan pemicu berikutnya tetap bisa memulai survei).
    if (result.status === "failed") {
      logError("backend", new Error("Formulir Flow gagal dikirim"), {
        surveyId: survey.id,
        metaResponse: result.raw,
      });
      await prisma.surveyResponse.delete({ where: { id: resp.id } }).catch(() => {});
      return;
    }
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
    data: {
      surveyId: survey.id,
      contactId,
      currentStep: 0,
      ...(kodeProv ? { kodeProvinsi: kodeProv } : {}),
      ...(blastId ? { blastId } : {}),
    },
  });
  const first = formatQuestion(survey.questions[0]!);
  const intro = survey.description ? `${survey.description}\n\n${first}` : first;

  // Banner: kirim sebagai gambar ber-caption supaya tetap SATU pesan (bukan gambar
  // lalu teks terpisah). Vendor tanpa dukungan gambar → jatuh ke teks biasa.
  if (survey.bannerUrl && typeof provider.sendImage === "function") {
    try {
      const result = await provider.sendImage({ to: phone, link: survey.bannerUrl, caption: intro });
      if (result.status !== "failed") {
        await prisma.message.create({
          data: {
            contactId,
            direction: "out",
            vendor,
            vendorMessageId: result.vendorMessageId || null,
            text: intro,
            payload: result.raw as object,
            isBot: true,
          },
        });
        return;
      }
      // Gagal kirim gambar (mis. URL tak bisa diunduh Meta) → jangan biarkan survei
      // batal; lanjut kirim versi teksnya.
      logError("backend", new Error("Banner survei gagal dikirim, memakai teks biasa"), {
        surveyId: survey.id,
        bannerUrl: survey.bannerUrl,
      });
    } catch (e) {
      logError("backend", e, { surveyId: survey.id, kind: "bannerSurvei" });
    }
  }
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
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: { id: true, oncePerContact: true, pesanKuotaPenuh: true },
      });
      if (survey) {
        // Tombol formulir di template blast tetap bisa ditekan lagi kapan pun, jadi
        // jalur inilah penjaga aturan sekali-isi. Tanpa pemeriksaan ini, tiap submit
        // ulang MEMBUAT RESPONS BARU: satu orang bisa "memilih" berkali-kali dan
        // penghitung respons menggelembung diam-diam (kejadian nyata saat uji blast).
        // Tolak halus dengan pesan yang sama seperti jalur kata pemicu.
        if (survey.oncePerContact && (await sudahPernahDiterima(surveyId, contactId))) {
          await reply(vendor, phone, ALREADY_DONE_TEXT, contactId);
          return;
        }
        // Provinsi dari atribut impor ikut distempel, sama seperti startSurvey(). Tanpa ini,
        // penerima blast yang formulirnya tidak memuat pertanyaan wilayah lolos dari kuota
        // provinsinya sama sekali — padahal provinsinya sudah diketahui sejak diimpor.
        const kontak = await prisma.contact.findUnique({ where: { id: contactId }, select: { attributes: true } });
        const kodeProv = await provinsiAwal(surveyId, contactId, kontak?.attributes);
        // Sudah pernah ditolak kuota di survei ini, dan kuotanya masih penuh: jangan buat
        // respons baru. Tanpa penjaga ini setiap ketukan tombol melahirkan satu respons
        // tertolak lengkap dengan jawabannya — angka "respons" di aplikasi menggelembung
        // jauh di atas jumlah baris Excel, gejala yang justru membuat orang curiga datanya
        // rusak. Orang yang BARU pertama kali mengisi tetap disimpan, lalu diputuskan
        // tutupRespons() seperti biasa.
        const pernahDitolak = await prisma.surveyResponse.findFirst({
          where: { surveyId, contactId, ditolakKuotaPada: { not: null } },
          select: { id: true },
        });
        if (pernahDitolak && !(await bolehMulaiSurvei(surveyId, kodeProv)).boleh) {
          await balasKuotaPenuh(vendor, phone, contactId, surveyId, survey.pesanKuotaPenuh);
          return;
        }
        surveyResponse = await prisma.surveyResponse.create({
          data: { surveyId, contactId, currentStep: 0, ...(kodeProv ? { kodeProvinsi: kodeProv } : {}) },
          include: withQuestions,
        });
      }
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
  if (surveyResponse.completedAt) {
    // Sudah pernah diproses. Yang ditolak kuota ditangani, bukan didiamkan — formulir yang
    // dikirim lagi tanpa jawaban apa pun terbaca seperti jawabannya hilang.
    if (surveyResponse.ditolakKuotaPada) {
      // Kuotanya mungkin sudah dinaikkan sejak ia ditolak. Formulir yang ditolak di akhir
      // sudah membawa jawaban lengkap, jadi cukup dipulihkan lewat kunci yang sama — tanpa
      // respons baru dan tanpa menulis jawaban dua kali.
      const lengkap = surveyResponse.currentStep >= surveyResponse.survey.questions.length;
      const hasil = lengkap ? await pulihkanRespons(surveyResponse.id) : "masih-penuh";
      if (hasil === "dipulihkan") {
        await enqueueSheetSync(surveyResponse.id);
        await kirimPenutup(vendor, phone, contactId, surveyResponse.id, surveyResponse.survey);
      } else if (hasil === "masih-penuh") {
        await balasKuotaPenuh(vendor, phone, contactId, surveyResponse.surveyId, surveyResponse.survey.pesanKuotaPenuh);
      }
      // "sudah-diterima": ia sudah punya respons lain yang diterima — sama seperti respons
      // selesai biasa yang dikirim ulang, tidak perlu dibalas.
    }
    return;
  }
  const flowResp = resp as Record<string, unknown>;
  const questions = surveyResponse.survey.questions as QLite[];

  // Flow di Meta memakai id pertanyaan lain (survei diubah / Flow dibuat dari survei lain).
  // Tanpa peringatan ini kegagalan bersifat SENYAP: responden ditandai "selesai" tapi 0 jawaban.
  if (flowOutOfSync(flowResp, questions)) {
    logError(
      "backend",
      new Error(
        `Flow tidak sinkron: response_json memakai nama field lain dari pertanyaan survei "${surveyResponse.survey.title}". ` +
          `Regenerate Flow JSON dari survei ini lalu update & publish ulang Flow di Meta.`,
      ),
      { surveyId: surveyResponse.surveyId, responseId: surveyResponse.id },
    );
  }

  const semuaJawaban = parseFlowAnswers(flowResp, questions);

  // Percabangan ditegakkan DI SERVER, bukan hanya di Flow.
  //
  // Komponen If pada Flow bekerja di sisi klien, dan payload "complete" mendaftar SEMUA
  // field layar tanpa syarat. Responden yang sempat mengisi lalu mengubah jawaban pemicunya
  // membuat komponennya hilang dari layar — tetapi nilainya masih ada di state formulir dan
  // tetap terkirim. Dua-duanya terjadi nyata di produksi: satu responden menolak informed
  // consent namun 20 jawaban berikutnya tetap tersimpan, dan responden yang menjawab tidak
  // tahu suatu program tetap membawa nilai pada pertanyaan lanjutan "jika Anda tahu…".
  //
  // Mesin chat tidak pernah punya masalah ini — ia memang tidak mengirim pertanyaan yang
  // dilompati. Ini menyamakan Flow dengan perilaku yang sudah benar itu.
  const { diterima: answers, ditolak } = saringJawaban(questions, semuaJawaban);
  if (ditolak.length) {
    const judul = new Map(questions.map((q) => [q.id, q.text]));
    logError("backend", new Error("Jawaban di luar jalur percabangan ditolak"), {
      surveyId: surveyResponse.surveyId,
      responseId: surveyResponse.id,
      jumlahDitolak: ditolak.length,
      pertanyaan: ditolak.map((a) => (judul.get(a.questionId) ?? a.questionId).slice(0, 60)),
      catatan:
        "Formulir membawa jawaban atas pertanyaan yang seharusnya dilewati responden ini. " +
        "Bila sering berulang, periksa apakah Flow yang terbit di Meta sudah memuat aturan percabangan survei ini.",
    });
  }
  for (const a of answers)
    await prisma.answer.create({ data: { responseId: surveyResponse.id, questionId: a.questionId, value: a.value } });

  // Jawaban responden MENIMPA tebakan dari atribut impor: yang mengisi tahu domisilinya
  // sendiri, sedangkan atribut impor bisa usang atau salah kolom.
  //
  // Sumbernya bisa pertanyaan bertipe "wilayah", atau pertanyaan lain yang ditunjuk survei
  // lewat questionProvinsiId — instrumen yang sudah berjalan memakai tipe "choice" berisi
  // nama provinsi, dan tanpa penunjuk itu responden baru tidak pernah distempel.
  const idProvinsi =
    questions.find((q) => q.type === "wilayah")?.id ?? surveyResponse.survey.questionProvinsiId ?? null;
  if (idProvinsi) {
    const jawab = answers.find((a) => a.questionId === idProvinsi);
    if (jawab) await stempelProvinsi(surveyResponse.id, kodeProvinsiDari(jawab.value));
  }

  // Kuota diperiksa ULANG di sini. Di mode Flow seluruh jawaban — termasuk provinsi — baru
  // tiba sekarang, jadi pemeriksaan saat formulir dikirim hanya bisa memakai batas global.
  // Dulu respons ini langsung diterima, dan kuota Jawa Barat 2 terisi 3.
  //
  // Jawabannya tetap tersimpan, hanya ditandai ditolak: tidak dihitung, tidak ikut ekspor
  // maupun Google Sheets, tetapi masih ada bila klien kelak menaikkan kuotanya.
  const tutup = await tutupRespons(surveyResponse.id, {
    currentStep: surveyResponse.survey.questions.length,
    // Penolak consent tetap "selesai" tapi tidak membawa data, jadi tidak dihitung ke
    // kuota. Ditandai di sini supaya pemeriksaan kuota — yang berjalan pada setiap pesan
    // masuk dan setiap pengiriman blast — tidak perlu menelusuri tabel jawaban.
    consentDitolak: disaringKeluar(questions, answers),
  });
  if (!tutup.diterima) {
    await kirimPesanKuota(vendor, phone, contactId, surveyResponse.surveyId, surveyResponse.survey.pesanKuotaPenuh);
    return;
  }
  await enqueueSheetSync(surveyResponse.id);
  await kirimPenutup(vendor, phone, contactId, surveyResponse.id, surveyResponse.survey);
}

async function advanceSurvey(
  responseId: string,
  step: number,
  questions: QLite[],
  contactId: string,
  phone: string,
  vendor: string,
  ev: NormalizedInbound,
  survei: {
    id: string;
    closingMessage: string | null;
    pesanKuotaPenuh: string | null;
    mintaLokasi: boolean;
    pesanMintaLokasi: string | null;
    // Pertanyaan yang ditunjuk survei sebagai sumber provinsi (selain tipe "wilayah").
    questionProvinsiId: string | null;
  },
): Promise<void> {
  const current = questions[step];
  if (!current) {
    // Langkahnya sudah melewati pertanyaan terakhir (survei diubah di tengah pengisian).
    // Jalur selesai yang jarang, tapi tetap lewat pemeriksaan kuota yang sama — kalau
    // tidak, inilah pintu belakang tempat respons di luar kuota masuk ke Google Sheets.
    const tutup = await tutupRespons(responseId);
    if (tutup.diterima) await enqueueSheetSync(responseId);
    else await kirimPesanKuota(vendor, phone, contactId, survei.id, survei.pesanKuotaPenuh);
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
    if (current.type === "wilayah" || current.id === survei.questionProvinsiId) {
      const kode = kodeProvinsiDari(savedValue);
      await stempelProvinsi(responseId, kode);
      // Provinsinya baru diketahui SEKARANG, jadi kuota provinsinya baru bisa diperiksa
      // sekarang. Bila sudah penuh, sisa pertanyaan tidak dikirim — tiap pertanyaan satu
      // pesan — dan sesinya ditutup supaya kontak tidak terkunci di survei yang takkan
      // menerimanya. Makin awal pertanyaan wilayah, makin sedikit yang terbuang.
      //
      // Harganya: respons ini hanya berisi jawaban sampai pertanyaan wilayah, jadi tidak
      // bisa dipulihkan menjadi data utuh kalau kuotanya kelak dinaikkan. Orangnya tetap
      // bisa mengisi ulang dari awal — penolakan kuota tidak dihitung "sudah pernah mengisi".
      //
      // Hanya bila MASIH ADA pertanyaan sesudahnya. Bila jawaban wilayah ini mengakhiri
      // jalurnya (pertanyaan terakhir, atau cabang "akhiri"), tidak ada pesan yang bisa
      // dihemat — biarkan pemeriksaan terkunci di titik selesai yang memutuskan. Di sana
      // currentStep dicatat sampai akhir, sehingga respons yang jawabannya lengkap tidak
      // salah tergolong "dihentikan di tengah" dan tetap bisa dipulihkan.
      const masihLanjut = Boolean(questions[nextStepWithBranch(current, step, savedValue, questions.length)]);
      const cek = kode && masihLanjut ? await bolehMulaiSurvei(survei.id, kode) : null;
      if (cek && !cek.boleh) {
        // false = respons ini sudah diputuskan pesan lain yang diproses bersamaan.
        if (await tolakKarenaKuota(responseId, cek.alasan))
          await kirimPesanKuota(vendor, phone, contactId, survei.id, survei.pesanKuotaPenuh);
        return;
      }
    }
    if (disaringKeluar([current], [{ questionId: current.id, value: savedValue }]))
      await prisma.surveyResponse.update({ where: { id: responseId }, data: { consentDitolak: true } });
  }

  // Skip logic: pertanyaan berikutnya bisa dilompati / survei diakhiri sesuai jawaban.
  const nextStep = nextStepWithBranch(current, step, savedValue, questions.length);
  const next = questions[nextStep];
  if (next) {
    await prisma.surveyResponse.update({ where: { id: responseId }, data: { currentStep: nextStep } });
    await reply(vendor, phone, formatQuestion(next), contactId);
    return;
  }
  // Pemeriksaan terakhir, terkunci: jatah yang tadi masih ada bisa saja sudah diambil
  // responden lain yang selesai lebih dulu.
  const tutup = await tutupRespons(responseId, { currentStep: questions.length });
  if (!tutup.diterima) {
    await kirimPesanKuota(vendor, phone, contactId, survei.id, survei.pesanKuotaPenuh);
    return;
  }
  await enqueueSheetSync(responseId);
  await kirimPenutup(vendor, phone, contactId, responseId, survei);
}

// Kata penutup — dan, bila survei meminta lokasi, permintaan lokasinya dalam pesan yang SAMA.
//
// Satu pesan, bukan dua: sejak Oktober 2026 pesan service ikut ditagih per pesan, dan
// penutup + permintaan terpisah berarti dua tagihan per responden.
//
// HANYA vendor yang punya pesan bertombol "Kirim lokasi" (Meta). Di vendor lain responden
// harus berbagi lewat lampiran, dan di sana janji privasinya tidak bisa ditepati: Baileys
// adalah perangkat tertaut, jadi titik persis, nama tempat, dan lokasi langsung (live)
// ikut tersimpan di ponsel operator; bentuk pesan lokasi Qontak tidak terdokumentasi.
//
// Tidak diminta dari penolak persetujuan: orang yang baru saja menyatakan tidak bersedia
// ikut tidak semestinya diminta data pribadi lagi.
const BATAS_BADAN_INTERAKTIF = 1024;

async function kirimPenutup(
  vendor: string,
  phone: string,
  contactId: string,
  responseId: string,
  survei: { closingMessage: string | null; mintaLokasi: boolean; pesanMintaLokasi: string | null },
): Promise<void> {
  const penutup = closingText(survei.closingMessage);
  const provider = getProvider(vendor);
  if (!survei.mintaLokasi || typeof provider.sendLocationRequest !== "function") {
    await reply(vendor, phone, penutup, contactId);
    return;
  }
  const r = await prisma.surveyResponse.findUnique({ where: { id: responseId }, select: { consentDitolak: true } });
  if (r?.consentDitolak) {
    await reply(vendor, phone, penutup, contactId);
    return;
  }

  // Dicatat SEBELUM dikirim: lokasi yang dibagikan sangat cepat tidak boleh tiba lebih dulu
  // daripada catatan permintaannya — tanpa catatan itu ia dibuang sebagai pesan liar.
  await prisma.surveyResponse.update({
    where: { id: responseId },
    data: { lokasiDimintaPada: new Date(), lokasiPesanId: null },
  });

  const minta = survei.pesanMintaLokasi?.trim() || PESAN_MINTA_LOKASI_BAWAAN;
  // Badan pesan bertombol dibatasi Meta 1024 karakter. Penutup yang panjang dikirim sendiri
  // lebih dulu — memotongnya justru membuang kalimat permintaan lokasinya.
  const gabung = `${penutup}\n\n${minta}`;
  const satuPesan = gabung.length <= BATAS_BADAN_INTERAKTIF;
  const teks = satuPesan ? gabung : minta;

  // Catatan permintaan dibatalkan bila permintaannya TIDAK PERNAH sampai ke responden —
  // kalau tidak, ia tercatat "tidak membagikan" padahal tak pernah diminta, dan lokasi
  // yang ia kirim untuk keperluan lain dalam 24 jam tertangkap sebagai jawaban survei.
  // Yang menentukan "sampai" hanya hasil KIRIM. Galat menulis riwayat pesan sesudahnya
  // tidak mengubahnya: pesan yang sudah sampai tidak boleh dikirim ulang (dua tagihan),
  // dan catatan permintaan yang sudah sampai tidak boleh hilang.
  let sampai = false;
  const catatPesan = (hasil: SendResult, text: string) =>
    prisma.message.create({
      data: {
        contactId,
        direction: "out",
        vendor,
        vendorMessageId: hasil.vendorMessageId || null,
        text,
        payload: hasil.raw as object,
        isBot: true,
        source: "survey",
      },
    });
  try {
    if (!satuPesan) await reply(vendor, phone, penutup, contactId);

    let hasil: SendResult | null = null;
    try {
      hasil = await provider.sendLocationRequest({ to: phone, text: teks });
    } catch (err) {
      logError("backend", err, { scope: "kirimPenutup", responseId });
    }
    if (hasil && hasil.status !== "failed") {
      sampai = true;
      // ID pesan permintaan disimpan: Meta menyertakannya (context.id) pada lokasi yang
      // dikirim lewat tombol ini, jadi lokasinya bisa dicocokkan ke respons yang tepat.
      await prisma.surveyResponse.update({
        where: { id: responseId },
        data: { lokasiPesanId: hasil.vendorMessageId || null },
      });
      await catatPesan(hasil, teks);
      return;
    }
    if (hasil) {
      logError("backend", new Error("Permintaan lokasi ditolak vendor — memakai teks biasa"), {
        responseId,
        vendorResponse: hasil.raw,
      });
    }

    // Cadangan: teks biasa, lokasi dibagikan lewat lampiran.
    const cadanganTeks = `${teks}\n\n${PETUNJUK_LOKASI_TANPA_TOMBOL}`;
    const cadangan = await provider.sendText({ to: phone, text: cadanganTeks });
    sampai = cadangan.status !== "failed";
    await catatPesan(cadangan, cadanganTeks);
  } finally {
    if (!sampai)
      await prisma.surveyResponse.updateMany({
        where: { id: responseId, lokasiDiterimaPada: null },
        data: { lokasiDimintaPada: null },
      });
  }
}

// Simpan lokasi yang dibagikan sebagai jawaban atas permintaan yang masih berlaku (24 jam).
// false = tidak ada permintaan yang menunggu; lokasinya bukan untuk survei mana pun.
//
// Respons mana yang dijawab:
//  1. yang pesan permintaannya dijawab (contextId — lokasi lewat tombol di pesan itu);
//  2. selain itu, permintaan TERAKHIR kontak ini. Bukan "permintaan terakhir yang belum
//     terjawab": dengan aturan itu lokasi yang dibagikan ulang — atau webhook yang dikirim
//     Meta dua kali — pindah ke permintaan lebih lama yang sengaja diabaikan responden,
//     padahal persetujuan berbagi lokasi berlaku per permintaan.
// Permintaan yang sudah terjawab tidak ditimpa: lokasi berikutnya diabaikan.
//
// Provinsi dihitung dari titik ASLI, lalu yang disimpan hanya titik yang dibulatkan (±1,1 km).
async function simpanLokasi(
  lokasi: { latitude: number; longitude: number },
  contextId: string | undefined,
  contactId: string,
  phone: string,
  vendor: string,
): Promise<boolean> {
  const pilih = { id: true, lokasiDimintaPada: true, lokasiDiterimaPada: true } as const;
  const r =
    (contextId
      ? await prisma.surveyResponse.findFirst({ where: { contactId, lokasiPesanId: contextId }, select: pilih })
      : null) ??
    (await prisma.surveyResponse.findFirst({
      where: { contactId, lokasiDimintaPada: { not: null } },
      orderBy: { lokasiDimintaPada: "desc" },
      select: pilih,
    }));
  if (!r?.lokasiDimintaPada || r.lokasiDimintaPada.getTime() < Date.now() - BERLAKU_PERMINTAAN_MS) return false;
  if (r.lokasiDiterimaPada) return true;

  const asli = { lat: lokasi.latitude, lng: lokasi.longitude };
  const kodeProvinsiLokasi = await provinsiDariTitik(asli);
  const bulat = bulatkanKoordinat(asli);
  const { count } = await prisma.surveyResponse.updateMany({
    where: { id: r.id, lokasiDiterimaPada: null },
    data: { lokasiDiterimaPada: new Date(), lokasiLat: bulat.lat, lokasiLng: bulat.lng, kodeProvinsiLokasi },
  });
  if (count) await reply(vendor, phone, TERIMA_KASIH_LOKASI, contactId);
  return true;
}

// Balasan "kuota penuh" untuk tindakan yang BERULANG — mengetik kata pemicu lagi, atau
// mengirim ulang formulir yang sudah diproses. Tidak dikirim dua kali berturut-turut dalam
// 24 jam: tiap balasan memakan jatah pesan service, isinya tidak pernah berubah, dan orang
// yang mengulang sepuluh kali cukup diberi tahu sekali. Bila sudah ada pesan LAIN
// sesudahnya, pesan ini dikirim lagi — percakapannya sudah berpindah.
//
// Penolakan di titik SELESAI tidak lewat sini, melainkan kirimPesanKuota() langsung. Orang
// yang baru mengisi formulir sampai habis harus selalu mendapat jawaban, walaupun kemarin
// ia sudah pernah menerima kalimat yang sama.
//
// Kuncinya per SURVEI, bukan per kontak: teks bawaannya sama untuk semua survei, dan orang
// yang ditolak survei A lalu pertama kali mencoba survei B tetap harus dijawab.
async function balasKuotaPenuh(
  vendor: string,
  phone: string,
  contactId: string,
  surveyId: string,
  teksSurvei: string | null | undefined,
): Promise<void> {
  const terakhir = await prisma.message.findFirst({
    where: { contactId, direction: "out" },
    orderBy: { createdAt: "desc" },
    select: { payload: true, createdAt: true },
  });
  const penanda = (terakhir?.payload as { kuotaSurveyId?: unknown } | null)?.kuotaSurveyId;
  if (terakhir && penanda === surveyId && Date.now() - terakhir.createdAt.getTime() < SEHARI_MS) return;
  await kirimPesanKuota(vendor, phone, contactId, surveyId, teksSurvei);
}

// Pesan kuota penuh, ditandai id surveinya di payload pesan — penanda itulah yang dibaca
// balasKuotaPenuh() untuk mengenali pengulangan. Disimpan di payload supaya tidak perlu
// kolom baru hanya untuk ini.
async function kirimPesanKuota(
  vendor: string,
  phone: string,
  contactId: string,
  surveyId: string,
  teksSurvei: string | null | undefined,
): Promise<void> {
  await reply(vendor, phone, pesanKuotaPenuh(teksSurvei), contactId, "survey", { kuotaSurveyId: surveyId });
}

const SEHARI_MS = 24 * 60 * 60 * 1000;

async function saveAnswer(responseId: string, questionId: string, value: string): Promise<void> {
  await prisma.answer.create({ data: { responseId, questionId, value } });
}

// `source` mencatat ASAL balasan otomatis (survey | autoreply | ai | optout).
// Kolom itulah yang dipakai menghitung kuota balasan AI per kontak.
async function reply(
  vendor: string,
  to: string,
  text: string,
  contactId?: string,
  source: "survey" | "autoreply" | "ai" | "optout" = "survey",
  // Keterangan tambahan yang ikut disimpan di payload pesan (mis. penanda pesan kuota).
  penanda?: Record<string, string>,
): Promise<void> {
  if (!to) return;
  const result = await getProvider(vendor).sendText({ to, text });
  await prisma.message.create({
    data: {
      contactId: contactId ?? null,
      direction: "out",
      vendor,
      vendorMessageId: result.vendorMessageId || null,
      text,
      payload: penanda ? { ...((result.raw as object) ?? {}), ...penanda } : (result.raw as object),
      isBot: true,
      source,
    },
  });
}
