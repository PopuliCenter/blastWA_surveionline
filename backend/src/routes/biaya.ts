import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hitungBiaya, pilihTarif, type JumlahPesan } from "../lib/biaya.js";

// Estimasi biaya pesan WhatsApp + bahan invoice.
//
// Dihitung dari data yang SUDAH ada, tanpa kolom tambahan, karena dua sumbernya terpisah
// rapi di sistem ini:
//   • BlastRecipient = pesan TEMPLATE (marketing/utility/authentication), satu baris per nomor.
//   • Message arah keluar = pesan SERVICE — balasan bot, pengiriman formulir, kiriman operator.
//     Semuanya non-template di dalam jendela layanan 24 jam.
//
// Meta menagih per pesan TERKIRIM, jadi yang gagal diantar dikecualikan. Untuk pesan lama
// yang dikirim sebelum status antar mulai dicatat, deliveryStatus bernilai null dan tetap
// dihitung — tidak ada cara mengetahui nasibnya, dan menghapusnya diam-diam justru
// membuat angka terlalu rendah dibanding tagihan Meta yang sebenarnya.

const tarifInput = z.object({
  berlakuSejak: z.string(),
  mataUang: z.string().min(1).max(8).default("IDR"),
  marketing: z.coerce.number().min(0),
  utility: z.coerce.number().min(0),
  authentication: z.coerce.number().min(0),
  service: z.coerce.number().min(0),
  gratisServicePerBulan: z.coerce.number().int().min(0).default(0),
  pajakPersen: z.coerce.number().min(0).max(100).default(0),
  // Boleh berbeda dari pajakPersen — lihat catatan di lib/biaya.ts.
  pajakEfektifPersen: z.coerce.number().min(0).max(100).nullable().optional(),
  catatan: z.string().max(1000).optional(),
});

export async function biayaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  // ===== Kartu tarif (diisi manual, berversi) =====

  app.get("/api/tarif", async () => prisma.tarifWa.findMany({ orderBy: { berlakuSejak: "desc" } }));

  app.post("/api/tarif", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const parsed = tarifInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const berlakuSejak = new Date(parsed.data.berlakuSejak);
    if (Number.isNaN(berlakuSejak.getTime())) return reply.code(400).send({ error: "tanggal berlaku tidak valid" });
    const t = await prisma.tarifWa.create({ data: { ...parsed.data, berlakuSejak } });
    return reply.code(201).send(t);
  });

  app.put("/api/tarif/:id", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const id = (req.params as { id: string }).id;
    const parsed = tarifInput.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.berlakuSejak) {
      const d = new Date(parsed.data.berlakuSejak);
      if (Number.isNaN(d.getTime())) return reply.code(400).send({ error: "tanggal berlaku tidak valid" });
      data.berlakuSejak = d;
    }
    return prisma.tarifWa.update({ where: { id }, data });
  });

  app.delete("/api/tarif/:id", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    await prisma.tarifWa.delete({ where: { id: (req.params as { id: string }).id } });
    return { ok: true };
  });

  // ===== Profil penerbit invoice (pengaturan tunggal) =====
  //
  // Hanya bagian yang TIDAK pernah berganti. Data per klien sengaja tidak disimpan:
  // menyimpannya akan membuat invoice untuk klien berikutnya terisi data klien sebelumnya.

  app.get("/api/profil-invoice", async () => {
    const p = await prisma.profilInvoice.findUnique({ where: { id: "default" } });
    return {
      penerbit: p?.penerbit ?? "",
      accountId: p?.accountId ?? "",
      metode: p?.metode ?? "",
      produk: p?.produk ?? "WhatsApp Business Account",
      status: p?.status ?? "Paid",
    };
  });

  app.put("/api/profil-invoice", async (req, reply) => {
    if (req.user.role === "viewer") return reply.code(403).send({ error: "forbidden" });
    const parsed = z
      .object({
        penerbit: z.string().max(600).optional(),
        accountId: z.string().max(120).optional(),
        metode: z.string().max(120).optional(),
        produk: z.string().max(120).optional(),
        status: z.string().max(60).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const data = {
      ...(d.penerbit !== undefined ? { penerbit: d.penerbit } : {}),
      ...(d.accountId !== undefined ? { accountId: d.accountId } : {}),
      ...(d.metode !== undefined ? { metode: d.metode } : {}),
      ...(d.produk ? { produk: d.produk } : {}),
      ...(d.status ? { status: d.status } : {}),
    };
    await prisma.profilInvoice.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
    return { ok: true };
  });

  // ===== Rentang tanggal tiap survei =====
  // Dipakai pemilih survei di halaman Biaya untuk mengisi tanggal otomatis. Biaya tetap
  // dihitung per PERIODE, bukan per survei: itu satu-satunya cara yang bisa dicocokkan
  // baris per baris dengan invoice Meta, dan itulah yang dipertanggungjawabkan ke klien.
  app.get("/api/biaya/survei", async () => {
    const rows = await prisma.survey.findMany({
      select: { id: true, title: true, status: true, _count: { select: { responses: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const rentang = await prisma.surveyResponse.groupBy({
      by: ["surveyId"],
      _min: { startedAt: true },
      _max: { startedAt: true },
    });
    const byId = new Map(rentang.map((r) => [r.surveyId, r]));
    return rows.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      responses: s._count.responses,
      mulai: byId.get(s.id)?._min.startedAt ?? null,
      selesai: byId.get(s.id)?._max.startedAt ?? null,
    }));
  });

  // ===== Perhitungan biaya untuk satu periode =====

  app.get("/api/biaya", async (req, reply) => {
    const q = z
      .object({
        dari: z.string(),
        sampai: z.string(),
        marginPersen: z.coerce.number().min(0).max(1000).optional(),
      })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "dari & sampai wajib diisi (YYYY-MM-DD)" });

    const dari = new Date(`${q.data.dari.slice(0, 10)}T00:00:00.000Z`);
    // `sampai` inklusif bagi pemakai: dipakai sebagai batas atas EKSKLUSIF hari berikutnya,
    // supaya pesan pada hari terakhir ikut terhitung.
    const sampai = new Date(`${q.data.sampai.slice(0, 10)}T00:00:00.000Z`);
    sampai.setUTCDate(sampai.getUTCDate() + 1);
    if (Number.isNaN(dari.getTime()) || Number.isNaN(sampai.getTime()) || sampai <= dari)
      return reply.code(400).send({ error: "rentang tanggal tidak valid" });

    const tarifList = await prisma.tarifWa.findMany({ orderBy: { berlakuSejak: "desc" } });
    // Tarif dipilih menurut AWAL periode. Bila Meta mengubah harga di tengah periode,
    // pisahkan laporannya jadi dua rentang — menggabungkannya akan menyembunyikan
    // perbedaan tarif di dalam satu angka.
    const tarif = pilihTarif(tarifList, dari);
    if (!tarif)
      return reply.code(400).send({
        error: "Belum ada kartu tarif yang berlaku pada tanggal awal periode. Tambahkan dulu di halaman Biaya.",
      });

    // Pesan service per bulan kalender — jatah gratisnya disetel ulang tiap bulan.
    const serviceRows = await prisma.$queryRaw<{ bulan: string; n: number }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS bulan, COUNT(*)::int AS n
      FROM "Message"
      WHERE "direction"::text = 'out'
        AND "createdAt" >= ${dari} AND "createdAt" < ${sampai}
        AND ("deliveryStatus" IS NULL OR "deliveryStatus" <> 'failed')
      GROUP BY 1 ORDER BY 1`;

    // Pesan template per nama template, lalu dipetakan ke kategorinya.
    const templateRows = await prisma.$queryRaw<{ nama: string | null; n: number }[]>`
      SELECT b."templateName" AS nama, COUNT(*)::int AS n
      FROM "BlastRecipient" r JOIN "Blast" b ON b."id" = r."blastId"
      WHERE r."createdAt" >= ${dari} AND r."createdAt" < ${sampai}
        AND r."status"::text NOT IN ('queued', 'failed')
      GROUP BY 1`;

    const templates = await prisma.messageTemplate.findMany({ select: { name: true, category: true, metaCategory: true } });
    // metaCategory didahulukan: itu kategori MENURUT META, yang menentukan tarifnya.
    // `category` hanya label lokal dan bisa berbeda — Meta kadang mengklasifikasi ulang.
    const kategoriOf = new Map(templates.map((t) => [t.name, (t.metaCategory || t.category || "MARKETING").toUpperCase()]));

    const jumlah: JumlahPesan = { marketing: 0, utility: 0, authentication: 0, servicePerBulan: {} };
    for (const r of serviceRows) jumlah.servicePerBulan[r.bulan] = Number(r.n);
    const templateTakDikenal: string[] = [];
    for (const r of templateRows) {
      const kat = r.nama ? kategoriOf.get(r.nama) : undefined;
      if (!kat && r.nama) templateTakDikenal.push(r.nama);
      // Template yang tak lagi ada di daftar dianggap marketing — tarif TERTINGGI, supaya
      // estimasi tidak pernah lebih rendah dari tagihan Meta yang sebenarnya.
      if (kat === "UTILITY") jumlah.utility += Number(r.n);
      else if (kat === "AUTHENTICATION") jumlah.authentication += Number(r.n);
      else jumlah.marketing += Number(r.n);
    }

    const rincian = hitungBiaya({ jumlah, tarif, marginPersen: q.data.marginPersen });
    return {
      periode: { dari: q.data.dari.slice(0, 10), sampai: q.data.sampai.slice(0, 10) },
      tarif: {
        id: tarif.id,
        berlakuSejak: tarif.berlakuSejak,
        mataUang: tarif.mataUang,
        gratisServicePerBulan: tarif.gratisServicePerBulan,
        catatan: tarif.catatan,
        marketing: tarif.marketing,
        utility: tarif.utility,
        authentication: tarif.authentication,
        service: tarif.service,
      },
      servicePerBulan: jumlah.servicePerBulan,
      templateTakDikenal,
      ...rincian,
    };
  });
}
