import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { judulSalinan } from "../lib/salinSurvei.js";

// Gandakan survei: instrumen dan pengaturannya disalin, datanya TIDAK.
//
// Yang disalin: deskripsi, mode, seluruh pertanyaan beserta pilihan dan percabangannya,
// aturan asesmen durasi,
// banner, kebijakan privasi, kata penutup, pesan kuota penuh, aturan sekali-isi, dan
// target kuota (global maupun per provinsi). Kuota disalin karena ia bagian rancangan
// sampel; hitungannya mulai dari nol karena respons tidak ikut.
//
// Yang SENGAJA dikosongkan:
//   • Status → draf. Salinan yang langsung aktif bisa mulai menerima responden sebelum
//     sempat diperiksa.
//   • Flow ID. Flow di Meta mengirim jawaban dengan nama field q_<id pertanyaan>, dan
//     pertanyaan salinan punya id baru. Memakai Flow lama berarti setiap formulir yang masuk
//     tidak cocok dengan pertanyaan mana pun — jawabannya hilang. Salinan butuh Flow JSON
//     baru yang dibuat dari pertanyaannya sendiri.
//   • Kata pemicu. Dua survei aktif dengan kata pemicu sama saling berebut: yang terpicu
//     hanya salah satunya, tanpa peringatan apa pun.
//   • Respons, blast, dan kapan dibuat.
//
// Percabangan aman disalin apa adanya: ia menunjuk pertanyaan lewat URUTAN, dan urutannya
// dipertahankan. Penunjuk pertanyaan provinsi (questionProvinsiId) menunjuk lewat ID, jadi
// dipetakan ulang ke pertanyaan salinan yang seurutan.
export async function gandakanSurvei(id: string) {
  const asli = await prisma.survey.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } }, kuotaProvinsi: true },
  });
  if (!asli) return null;

  const urutanProvinsi = asli.questionProvinsiId
    ? asli.questions.findIndex((q) => q.id === asli.questionProvinsiId)
    : -1;

  return prisma.$transaction(
    async (tx) => {
      // Judul dipilih DI DALAM kunci. Dua permintaan gandakan yang hampir bersamaan (klik
      // ganda) sama-sama melihat "X (salinan)" masih kosong dan sama-sama memakainya —
      // dua survei berjudul sama berbagi satu tab Google Sheets. Kunci ini menahan
      // permintaan kedua sampai salinan pertama tercatat, sehingga ia memilih "(salinan 2)".
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('gandakan-survei', 0))`;
      const lain = await tx.survey.findMany({ select: { title: true } });
      const baru = await tx.survey.create({
        data: {
          title: judulSalinan(
            asli.title,
            lain.map((s) => s.title),
          ),
          description: asli.description,
          status: "draft",
          mode: asli.mode,
          flowId: null,
          flowCta: asli.flowCta,
          flowPerScreen: asli.flowPerScreen,
          privacyUrl: asli.privacyUrl,
          bannerUrl: asli.bannerUrl,
          closingMessage: asli.closingMessage,
          pesanKuotaPenuh: asli.pesanKuotaPenuh,
          aturanDurasi: (asli.aturanDurasi ?? undefined) as Prisma.InputJsonValue | undefined,
          oncePerContact: asli.oncePerContact,
          triggerEnabled: false,
          triggerKeywords: [],
          targetResponden: asli.targetResponden,
          questions: {
            create: asli.questions.map((q, i) => ({
              text: q.text,
              type: q.type,
              required: q.required,
              // Dinomori ulang 0..n-1: percabangan memakai INDEKS daftar yang terurut, jadi
              // celah pada nomor urut asli tidak boleh ikut terbawa.
              order: i,
              options: (q.options ?? undefined) as Prisma.InputJsonValue | undefined,
            })),
          },
          kuotaProvinsi: {
            create: asli.kuotaProvinsi.map((k) => ({ kodeProvinsi: k.kodeProvinsi, target: k.target })),
          },
        },
        include: { questions: { orderBy: { order: "asc" } } },
      });

      const provinsiBaru = urutanProvinsi >= 0 ? baru.questions[urutanProvinsi]?.id : undefined;
      if (!provinsiBaru) return baru;
      return tx.survey.update({
        where: { id: baru.id },
        data: { questionProvinsiId: provinsiBaru },
        include: { questions: { orderBy: { order: "asc" } } },
      });
    },
    // Survei dengan puluhan pertanyaan ditulis baris per baris; batas bawaan 5 detik
    // terlalu sempit untuk Postgres yang jauh, apalagi bila sedang menunggu kunci.
    { maxWait: 10_000, timeout: 30_000 },
  );
}
