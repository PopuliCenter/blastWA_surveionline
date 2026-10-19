import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { gandakanSurvei } from "../services/salinSurvei.js";
import { tabBertabrakan, teksPertanyaanGanda } from "../lib/salinSurvei.js";
import { galatAturanDurasi, menitDari } from "../lib/asesmenDurasi.js";
import { buildSurveyFlow } from "../lib/flowJson.js";
import { PROVINSI } from "../lib/wilayah.js";
import { ALASAN_DITUTUP, DIHITUNG_KE_KUOTA } from "../services/kuotaSurvei.js";

// Ditolak karena kuota penuh — BUKAN yang masuk setelah survei ditutup. OR dengan null:
// `not` saja di SQL membuang baris yang alasannya kosong.
const DITOLAK_KARENA_KUOTA = {
  ditolakKuotaPada: { not: null },
  OR: [{ alasanDitolakKuota: null }, { alasanDitolakKuota: { not: ALASAN_DITUTUP } }],
};
import { statusLokasi } from "../lib/lokasi.js";
import { batasTerpasang, provinsiDariTitik } from "../services/petaProvinsi.js";

// Diekspor agar daftar tipenya bisa diuji terhadap daftar yang ditawarkan UI. Keduanya
// pernah berbeda isi, dan selisihnya baru ketahuan dari pemakai yang gagal menyimpan.
export const questionSchema = z.object({
  id: z.string().optional(), // id pertanyaan yang sudah ada (untuk edit non-destruktif)
  text: z.string().min(1),
  type: z
    // "wilayah" WAJIB ada di sini. Tipe itu sudah ditawarkan di pemilih tipe jawaban dan
    // sudah didukung mesin survei, tapi sempat tidak masuk daftar ini — akibatnya setiap
    // survei yang memakainya ditolak saat disimpan, dan karena galat Zod dikirim sebagai
    // objek, layarnya hanya menampilkan "[object Object]" tanpa menyebut sebabnya.
    .enum(["text", "rating", "number", "choice", "multichoice", "boolean", "image", "date", "consent", "wilayah"])
    .default("text"),
  required: z.boolean().default(true),
  // rating {min,max,minLabel?,maxLabel?} | choice/multichoice {choices:[...]} | branches:[...]
  // mode flow: newScreen (mulai layar baru di sini) & screenTitle (judul seksi)
  options: z.any().optional(),
});

export const surveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
  triggerEnabled: z.boolean().default(false),
  oncePerContact: z.boolean().default(false),
  triggerKeywords: z.array(z.string().min(1)).max(50).default([]),
  mode: z.enum(["chat", "flow"]).default("chat"),
  flowId: z.string().optional().nullable(),
  flowCta: z.string().optional().nullable(),
  flowPerScreen: z.coerce.number().int().min(1).max(20).default(4),
  privacyUrl: z.string().url().or(z.literal("")).optional().nullable(),
  bannerUrl: z.string().url().or(z.literal("")).optional().nullable(),
  closingMessage: z.string().max(2000).optional().nullable(),
  // Wajib terdaftar di sini: z.object membuang kunci yang tak dikenal TANPA galat, jadi
  // tanpa baris ini builder menyimpan dengan HTTP 200 dan pesannya tak pernah tersimpan.
  pesanKuotaPenuh: z.string().max(1000).optional().nullable(),
  // Balasan untuk orang yang mencoba ikut setelah survei ditutup; kosong = teks bawaan.
  pesanSurveiBerakhir: z.string().max(1000).optional().nullable(),
  // Minta lokasi setelah responden selesai (lihat kirimPenutup di mesin survei). Teksnya
  // kosong = teks bawaan, yang menyebut tujuan, ketelitian, dan bahwa boleh dilewati.
  mintaLokasi: z.boolean().default(false),
  pesanMintaLokasi: z.string().max(900).optional().nullable(),
  // Opsional: permintaan lokasi sebagai pesan terpisah, dan balasan setelah lokasi diterima.
  lokasiPesanTerpisah: z.boolean().default(false),
  balasanLokasi: z.string().max(500).optional().nullable(),
  // null = kembali ke aturan bawaan. Diperiksa dengan aturan yang SAMA dengan yang dipakai
  // saat membaca (lib/asesmenDurasi.ts), supaya yang lolos disimpan pasti terpakai.
  aturanDurasi: z
    .object({
      // Angka atau teks ("2,5" maupun "2.5") — dibaca menitDari, sama dengan saat dipakai.
      batas: z.array(z.object({ sampai: z.union([z.number(), z.string()]), label: z.string() })),
      selebihnya: z.string(),
    })
    .superRefine((a, ctx) => {
      const e = galatAturanDurasi(a);
      if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
    })
    // Spasi dirapikan di sini, sekali: ekspor Excel merapikan spasi ganda saat menulis sel,
    // Google Sheets tidak — tanpa ini "Terlalu  cepat" tampil berbeda di keduanya.
    .transform((a) => ({
      batas: a.batas.map((b) => ({ sampai: menitDari(b.sampai), label: b.label.trim().replace(/\s+/g, " ") })),
      selebihnya: a.selebihnya.trim().replace(/\s+/g, " "),
    }))
    .optional()
    .nullable(),
  questions: z.array(questionSchema).default([]),
});

// Kolom Json di Prisma tidak menerima null polos: "kembali ke bawaan" ditulis sebagai DbNull.
function dataSurvei<T extends { aturanDurasi?: unknown }>(data: T) {
  const { aturanDurasi, ...lain } = data;
  if (aturanDurasi === undefined) return lain;
  return { ...lain, aturanDurasi: aturanDurasi === null ? Prisma.DbNull : (aturanDurasi as Prisma.InputJsonValue) };
}

// Dua penjaga yang dulu tidak perlu, dan menjadi perlu sejak survei serta pertanyaan bisa
// digandakan — menggandakan membuat judul dan teks kembar jauh lebih mudah terjadi.
//
//   • Judul yang berbagi tab Google Sheets dengan survei lain: baris kedua survei akan
//     bercampur di satu tab di bawah satu header.
//   • Teks pertanyaan kembar: ekspor dan Laporan mencocokkan jawaban lewat teks, jadi
//     jawabannya bertumpuk di satu kolom.
//
// Keduanya hanya menolak yang BARU. Survei lama yang terlanjur berjudul kembar, atau yang
// sudah punya pertanyaan bertulisan sama, tetap bisa disunting — termasuk sekadar ditutup
// untuk menahan biaya — tanpa dipaksa mengubah instrumen di tengah pengumpulan data. Di
// mode chat, teks yang diubah langsung terkirim ke responden yang sedang mengisi.
export async function galatSimpanSurvei(
  id: string | null,
  judul: string | undefined,
  pertanyaan: readonly { text?: string | null }[] | undefined,
): Promise<string | null> {
  if (judul !== undefined) {
    const kini = id ? await prisma.survey.findUnique({ where: { id }, select: { title: true } }) : null;
    if (!kini || kini.title !== judul) {
      const lain = await prisma.survey.findMany({ where: id ? { id: { not: id } } : {}, select: { title: true } });
      if (tabBertabrakan(judul, lain.map((s) => s.title)))
        return `Judul "${judul}" sudah dipakai survei lain. Google Sheets menyimpan tiap survei di tab bernama sama dengan judulnya, jadi data kedua survei akan bercampur. Pakai judul lain.`;
    }
  }
  let ganda = pertanyaan ? teksPertanyaanGanda(pertanyaan) : [];
  if (ganda.length && id) {
    const lama = await prisma.question.findMany({ where: { surveyId: id }, select: { text: true } });
    const sudahKembar = new Set(teksPertanyaanGanda(lama));
    ganda = ganda.filter((t) => !sudahKembar.has(t));
  }
  if (ganda.length)
    return `Ada pertanyaan yang tulisannya sama persis: "${ganda[0]}". Jawabannya akan bertumpuk di satu kolom ekspor — bedakan tulisannya.`;
  return null;
}

export async function surveyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireWriter); // viewer = hanya-baca

  app.get("/api/surveys", async () => {
    const surveys = await prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      include: { questions: { orderBy: { order: "asc" } }, _count: { select: { responses: true } } },
    });
    // `responses` tetap SELURUH baris — Biaya memakainya, dan pesannya memang sudah
    // ditagih. Yang ditolak kuota dikirim terpisah untuk layar yang menampilkan data terpakai.
    // responsesDitolakKuota = SEMUA yang tidak dihitung (kuota penuh maupun masuk setelah
    // survei ditutup) — layar memakainya untuk mengurangi jumlah respons terpakai.
    // responsesDitolakDitutup = bagian yang masuk setelah ditutup, untuk labelnya.
    const ditolak = await prisma.surveyResponse.groupBy({
      by: ["surveyId", "alasanDitolakKuota"],
      where: { surveyId: { in: surveys.map((s) => s.id) }, ditolakKuotaPada: { not: null } },
      _count: { _all: true },
    });
    const ditolakPer = new Map<string, number>();
    const ditutupPer = new Map<string, number>();
    for (const d of ditolak) {
      ditolakPer.set(d.surveyId, (ditolakPer.get(d.surveyId) ?? 0) + d._count._all);
      if (d.alasanDitolakKuota === ALASAN_DITUTUP)
        ditutupPer.set(d.surveyId, (ditutupPer.get(d.surveyId) ?? 0) + d._count._all);
    }
    return surveys.map((s) => ({
      ...s,
      responses: s._count.responses,
      responsesDitolakKuota: ditolakPer.get(s.id) ?? 0,
      responsesDitolakDitutup: ditutupPer.get(s.id) ?? 0,
    }));
  });

  app.post("/api/surveys", async (req, reply) => {
    const parsed = surveySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { questions, ...data } = parsed.data;
    const galat = await galatSimpanSurvei(null, data.title, questions);
    if (galat) return reply.code(400).send({ error: galat });
    const survey = await prisma.survey.create({
      data: {
        ...dataSurvei(data),
        questions: {
          create: questions.map((q, i) => ({
            text: q.text,
            type: q.type,
            required: q.required,
            order: i,
            options: q.options ?? undefined,
          })),
        },
      },
      include: { questions: true },
    });
    return reply.code(201).send(survey);
  });

  app.put("/api/surveys/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = surveySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { questions, ...data } = parsed.data;
    const galat = await galatSimpanSurvei(id, data.title, questions);
    if (galat) return reply.code(400).send({ error: galat });

    // Perbarui pertanyaan secara non-destruktif: pertanyaan lama di-update (id tetap →
    // jawaban responden tidak ikut terhapus), pertanyaan baru dibuat, yang dihapus saja yang dibuang.
    if (questions) {
      const existing = await prisma.question.findMany({ where: { surveyId: id }, select: { id: true } });
      const existingIds = new Set(existing.map((e) => e.id));
      const keepIds = new Set(questions.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id as string));

      const toDelete = [...existingIds].filter((eid) => !keepIds.has(eid));
      if (toDelete.length) await prisma.question.deleteMany({ where: { id: { in: toDelete } } });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const data = { text: q.text, type: q.type, required: q.required, order: i, options: q.options ?? null };
        if (q.id && existingIds.has(q.id)) await prisma.question.update({ where: { id: q.id }, data });
        else await prisma.question.create({ data: { surveyId: id, ...data } });
      }
    }
    const survey = await prisma.survey.update({
      where: { id },
      data: dataSurvei(data),
      include: { questions: { orderBy: { order: "asc" } } },
    });
    return survey;
  });

  // Gandakan survei sebagai draf baru — pertanyaan dan pengaturannya ikut, respons tidak.
  // Rinciannya (apa yang disalin dan apa yang sengaja dikosongkan) di services/salinSurvei.ts.
  app.post("/api/surveys/:id/gandakan", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const baru = await gandakanSurvei(id);
    if (!baru) return reply.code(404).send({ error: "survei tidak ditemukan" });
    // Bentuknya disamakan dengan butir daftar GET /api/surveys, supaya layar bisa langsung
    // membuka builder untuk salinan ini tanpa memuat ulang.
    return reply.code(201).send({ ...baru, responses: 0, responsesDitolakKuota: 0 });
  });

  // Flow JSON dari survei tersimpan (untuk ditempel ke Meta Flow Builder).
  // Dibuat dari pertanyaan tersimpan agar nama field cocok saat memetakan balasan flow.
  app.get("/api/surveys/:id/flow-json", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!survey) return reply.code(404).send({ error: "survei tidak ditemukan" });
    return buildSurveyFlow({
      title: survey.title,
      description: survey.description,
      questions: survey.questions as any,
      flowPerScreen: survey.flowPerScreen,
      privacyUrl: survey.privacyUrl,
    });
  });

  app.delete("/api/surveys/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    await prisma.survey.delete({ where: { id } });
    return { ok: true };
  });

  // Hapus banyak respons survei (responden) sekaligus — beserta jawabannya.
  app.post("/api/surveys/responses/bulk-delete", async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.string()).min(1).max(5000) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "input tidak valid" });
    const r = await prisma.surveyResponse.deleteMany({ where: { id: { in: parsed.data.ids } } });
    return { ok: true, deleted: r.count };
  });

  // Ambil data jawaban survei (per responden).
  app.get("/api/surveys/:id/responses", async (req) => {
    const id = (req.params as { id: string }).id;
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: id },
      orderBy: { startedAt: "desc" },
      include: {
        // consentSource ikut ditarik untuk kolom "Sumber Kontak" di ekspor: kolom Nama
        // tidak bisa membedakan rekrutan surveyor (impor) dari responden organik
        // (pesan masuk), padahal komposisi itulah yang dilaporkan di metodologi.
        contact: { select: { phone: true, name: true, attributes: true, consentSource: true } },
        answers: { include: { question: { select: { text: true, order: true } } } },
      },
    });
    // Lokasi yang masuk SEBELUM data batas provinsi dipasang tersimpan tanpa provinsi.
    // Begitu datanya ada, provinsinya dihitung di sini dari titik yang tersimpan — tanpa
    // menunggu skrip lengkapi:lokasi dijalankan (skrip itu yang menyimpannya permanen).
    const terpasang = await batasTerpasang();
    const provinsiLokasi = new Map<string, string | null>();
    for (const r of responses) {
      if (r.kodeProvinsiLokasi || !terpasang || !r.lokasiDiterimaPada) continue;
      if (r.lokasiLat == null || r.lokasiLng == null) continue;
      provinsiLokasi.set(r.id, await provinsiDariTitik({ lat: r.lokasiLat, lng: r.lokasiLng }));
    }
    return responses.map((r) => {
      const kodeProvinsiLokasi = r.kodeProvinsiLokasi ?? provinsiLokasi.get(r.id) ?? null;
      return {
        id: r.id,
        phone: r.contact.phone,
        name: r.contact.name,
        consentSource: r.contact.consentSource,
        attributes: r.contact.attributes ?? {},
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        // Dikirim, bukan disaring di query: operator perlu MELIHAT respons yang ditolak
        // kuota untuk menjawab "kenapa baris Excel lebih sedikit", dan masih bisa
        // menghapusnya. Ekspor dan analitik di klien yang mengecualikannya.
        ditolakKuotaPada: r.ditolakKuotaPada,
        alasanDitolakKuota: r.alasanDitolakKuota,
        // Lokasi yang dibagikan sesudah selesai: titiknya sudah dibulatkan (±1 km) saat
        // disimpan. statusLokasi membandingkan provinsi titik itu dengan provinsi yang
        // DISEBUT responden — itulah pemeriksaan "benar-benar di wilayahnya".
        statusLokasi: statusLokasi({ ...r, kodeProvinsiLokasi }, terpasang),
        lokasi:
          r.lokasiDiterimaPada && r.lokasiLat != null && r.lokasiLng != null
            ? {
                lat: r.lokasiLat,
                lng: r.lokasiLng,
                kodeProvinsi: kodeProvinsiLokasi,
                provinsi: PROVINSI.find((p) => p.kode === kodeProvinsiLokasi)?.nama ?? null,
              }
            : null,
        kodeProvinsi: r.kodeProvinsi,
        answers: r.answers
          .slice()
          .sort((a, b) => (a.question.order ?? 0) - (b.question.order ?? 0))
          .map((a) => ({ question: a.question.text, value: a.value })),
      };
    });
  });

  // ===== Kuota responden =====
  //
  // Dua tingkat: batas global untuk seluruh survei, dan batas per provinsi. Dipakai klien
  // untuk membatasi sebaran sekaligus menahan biaya — tiap responden berbiaya pesan.

  app.get("/api/surveys/:id/kuota", async (req) => {
    const id = (req.params as { id: string }).id;
    const [survey, kuota, perProvinsi, terisiGlobal, jmlWilayah, penolakConsent, ditolakKuota] = await Promise.all([
      prisma.survey.findUnique({
        where: { id },
        select: { targetResponden: true, questionProvinsiId: true },
      }),
      prisma.kuotaProvinsi.findMany({ where: { surveyId: id }, orderBy: { kodeProvinsi: "asc" } }),
      // Keterisian dihitung dari responden SELESAI yang BUKAN penolak consent — syaratnya
      // sama persis dengan yang dipakai mesin untuk menutup survei, supaya angka di layar
      // tidak pernah berbeda dari angka yang menentukan.
      prisma.surveyResponse.groupBy({
        by: ["kodeProvinsi"],
        where: { surveyId: id, ...DIHITUNG_KE_KUOTA },
        _count: { _all: true },
      }),
      prisma.surveyResponse.count({ where: { surveyId: id, ...DIHITUNG_KE_KUOTA } }),
      // Tanpa pertanyaan wilayah, provinsi HANYA bisa datang dari atribut kontak hasil
      // impor — responden organik tak pernah terhitung, dan kuota provinsinya diam-diam
      // tak pernah penuh. Dilaporkan agar layar bisa memperingatkan, bukan dibiarkan
      // ketahuan belakangan saat datanya sudah timpang.
      prisma.question.count({ where: { surveyId: id, type: "wilayah" } }),
      // Ditampilkan, bukan sekadar dikecualikan diam-diam: selisih antara "respons selesai"
      // dan "terhitung kuota" harus bisa dijelaskan ke klien tanpa membuka database.
      // Penolak consent yang masuk setelah survei ditutup sudah terhitung di tab "Ditolak".
      prisma.surveyResponse.count({
        where: { surveyId: id, completedAt: { not: null }, consentDitolak: true, ditolakKuotaPada: null },
      }),
      // Kategori pengecualian KEDUA, dilaporkan dengan asas yang sama.
      // Yang masuk setelah survei DITUTUP tidak termasuk: itu bukan penolakan kuota, dan
      // menaikkan target tidak memulihkannya.
      prisma.surveyResponse.count({ where: { surveyId: id, ...DITOLAK_KARENA_KUOTA } }),
    ]);
    // Dari yang ditolak, berapa yang jawabannya LENGKAP — hanya itu yang bisa dipulihkan
    // bila kuotanya dinaikkan. Respons chat yang dihentikan begitu provinsinya ketahuan
    // penuh berhenti di pertanyaan wilayah, jadi currentStep-nya belum sampai akhir.
    const jmlPertanyaan = await prisma.question.count({ where: { surveyId: id } });
    const ditolakKuotaLengkap = ditolakKuota
      ? await prisma.surveyResponse.count({
          where: { surveyId: id, ...DITOLAK_KARENA_KUOTA, currentStep: { gte: jmlPertanyaan } },
        })
      : 0;
    const terisi = new Map(perProvinsi.map((r) => [r.kodeProvinsi ?? "", r._count._all]));
    return {
      targetResponden: survey?.targetResponden ?? null,
      terisiGlobal,
      // Provinsi bisa diketahui lewat pertanyaan bertipe wilayah ATAU pertanyaan lain yang
      // ditunjuk survei. Dilaporkan sebagai satu jawaban supaya layar tidak memperingatkan
      // survei yang sebenarnya sudah punya sumber provinsi.
      punyaPertanyaanWilayah: jmlWilayah > 0,
      sumberProvinsi: jmlWilayah > 0 ? "wilayah" : survey?.questionProvinsiId ? "pertanyaan" : null,
      teksPertanyaanProvinsi: survey?.questionProvinsiId
        ? ((await prisma.question.findUnique({
            where: { id: survey.questionProvinsiId },
            select: { text: true },
          })) ?? null)?.text ?? null
        : null,
      penolakConsent,
      ditolakKuota,
      ditolakKuotaLengkap,
      // Tanpa provinsi = responden selesai yang provinsinya tidak diketahui. Ditampilkan
      // apa adanya: menyembunyikannya membuat jumlah per provinsi tampak tidak menjumlah.
      tanpaProvinsi: terisi.get("") ?? 0,
      provinsi: PROVINSI.map((p) => ({
        kodeProvinsi: p.kode,
        nama: p.nama,
        target: kuota.find((k) => k.kodeProvinsi === p.kode)?.target ?? null,
        terisi: terisi.get(p.kode) ?? 0,
      })),
    };
  });

  app.put("/api/surveys/:id/kuota", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z
      .object({
        targetResponden: z.coerce.number().int().min(0).nullable().optional(),
        provinsi: z
          .array(z.object({ kodeProvinsi: z.string().min(2).max(2), target: z.coerce.number().int().min(0).nullable() }))
          .max(40)
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    if (parsed.data.targetResponden !== undefined)
      await prisma.survey.update({ where: { id }, data: { targetResponden: parsed.data.targetResponden } });

    for (const p of parsed.data.provinsi ?? []) {
      // target null/0 dihapus, bukan disimpan sebagai 0 — 0 berarti "tak seorang pun boleh",
      // yang hampir pasti bukan maksud pemakai saat ia mengosongkan kolomnya.
      if (p.target === null || p.target === undefined) {
        await prisma.kuotaProvinsi
          .delete({ where: { surveyId_kodeProvinsi: { surveyId: id, kodeProvinsi: p.kodeProvinsi } } })
          .catch(() => {});
        continue;
      }
      await prisma.kuotaProvinsi.upsert({
        where: { surveyId_kodeProvinsi: { surveyId: id, kodeProvinsi: p.kodeProvinsi } },
        update: { target: p.target },
        create: { surveyId: id, kodeProvinsi: p.kodeProvinsi, target: p.target },
      });
    }
    return { ok: true };
  });
}
