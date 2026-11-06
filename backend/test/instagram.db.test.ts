import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Survei lewat DM Instagram dari ujung ke ujung, plus perbaikan yang ikut berlaku untuk
// WhatsApp (metode respons, pesan ganda). Penyedia, antrean Sheets, antrean blast, dan
// Auto Reply ditiru; basis datanya PostgreSQL sungguhan. Dilewati kecuali KUOTA_DB_URL diisi.
const URL_UJI = process.env.KUOTA_DB_URL;

type Kirim = { vendor: string; to: string; text?: string; flow?: string; tombolLokasi?: boolean };
const terkirim: Kirim[] = [];
const antreBlast: { to: string }[] = [];
let nomorPesan = 0;
const idUnik = () => `uji-${Date.now()}-${++nomorPesan}-${Math.random().toString(36).slice(2, 8)}`;
// igPunya*: meniru adaptor Instagram yang (kelak, keliru) memiliki Flow atau permintaan
// lokasi — mesin survei harus tetap tidak memakainya untuk kontak Instagram.
const tiruan = {
  profil: null as null | { name?: string; username?: string },
  igPunyaFlow: false,
  igPunyaLokasi: false,
};

vi.mock("../src/providers/registry.js", () => ({
  getProvider: (vendor: string) => {
    const sendText = async ({ to, text }: { to: string; text: string }) => {
      terkirim.push({ vendor, to, text });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    };
    const sendFlow = async ({ to, flowToken }: { to: string; flowToken: string }) => {
      terkirim.push({ vendor, to, flow: flowToken });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    };
    const sendLocationRequest = async ({ to, text }: { to: string; text: string }) => {
      terkirim.push({ vendor, to, text, tombolLokasi: true });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    };
    if (vendor === "instagram")
      return {
        name: "instagram",
        sendText,
        async ambilProfil() {
          return tiruan.profil;
        },
        ...(tiruan.igPunyaFlow ? { sendFlow } : {}),
        ...(tiruan.igPunyaLokasi ? { sendLocationRequest } : {}),
      };
    return { name: vendor, sendText, sendFlow, sendLocationRequest };
  },
}));
vi.mock("../src/queue/sheetQueue.js", () => ({ enqueueSheetSync: async () => {}, enqueueSheetLokasi: async () => {} }));
vi.mock("../src/services/autoResponder.js", () => ({ findAutoResponse: async () => null }));
vi.mock("../src/queue/blastQueue.js", () => ({
  blastQueue: {
    async addBulk(jobs: { data: { to: string } }[]) {
      antreBlast.push(...jobs.map((j) => ({ to: j.data.to })));
    },
  },
}));

type Engine = typeof import("../src/services/surveyEngine.js");
type Db = typeof import("../src/db.js");

describe.skipIf(!URL_UJI)("survei lewat DM Instagram", () => {
  let engine: Engine;
  let prisma: Db["prisma"];
  let createBlast: typeof import("../src/services/blastService.js").createBlast;
  let L: typeof import("../src/lib/lokasi.js");
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];
  const segmenDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    engine = await import("../src/services/surveyEngine.js");
    createBlast = (await import("../src/services/blastService.js")).createBlast;
    L = await import("../src/lib/lokasi.js");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.blast.deleteMany({ where: { segmentId: { in: segmenDibuat } } });
    await prisma.segment.deleteMany({ where: { id: { in: segmenDibuat } } });
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    terkirim.length = 0;
    antreBlast.length = 0;
    tiruan.profil = null;
    tiruan.igPunyaFlow = false;
    tiruan.igPunyaLokasi = false;
    // Survei uji lain tidak boleh ikut menjawab kata pemicu.
    await prisma.survey.updateMany({ where: { id: { in: surveiDibuat } }, data: { status: "closed" } });
  });

  // IGSID uji: 17 digit, diawali 8 — tepat jenis ID yang dirusak normalizePhone ("62" + ID).
  const igsidBaru = () => {
    const id = `8${String(Date.now()).slice(-10)}${Math.floor(Math.random() * 900000 + 100000)}`;
    nomorDibuat.push(`ig:${id}`, `62${id}`, id);
    return id;
  };
  const nomorBaru = () => {
    const n = `62877${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
    nomorDibuat.push(n);
    return n;
  };
  const IKLAN = { id: "120200", judul: "Survei Instagram" };
  const kirim = (
    vendor: "meta" | "instagram",
    from: string,
    text: string,
    opsi: { iklan?: typeof IKLAN; messageId?: string } = {},
  ) =>
    engine.handleInboundEvents([
      {
        vendor,
        kind: "message",
        from,
        text,
        ...(opsi.iklan ? { iklan: opsi.iklan } : {}),
        messageId: opsi.messageId ?? idUnik(),
        timestamp: new Date().toISOString(),
        raw: {},
      },
    ]);

  async function survei(opsi: { mode?: "chat" | "flow"; flowId?: string | null; mintaLokasi?: boolean } = {}) {
    const kata = `uji ig ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-ig-${idUnik()}`,
        status: "active",
        mode: opsi.mode ?? "flow",
        flowId: opsi.flowId === undefined ? (opsi.mode === "chat" ? null : "123") : opsi.flowId,
        triggerEnabled: true,
        triggerKeywords: [kata],
        mintaLokasi: opsi.mintaLokasi ?? false,
        questions: {
          create: [
            { order: 0, text: "Nama Anda?", type: "text", required: true },
            { order: 1, text: "Kota Anda?", type: "text", required: true },
          ],
        },
      },
    });
    surveiDibuat.push(s.id);
    return { s, kata };
  }
  const respons = (surveyId: string) =>
    prisma.surveyResponse.findFirstOrThrow({ where: { surveyId }, include: { answers: true } });

  it("DM Instagram: kontak ig:, sumber Instagram, saluran Instagram, chatbot walau survei Form — dan selesai", async () => {
    const { s, kata } = await survei({ mode: "flow", flowId: "123" });
    const igsid = igsidBaru();
    tiruan.profil = { name: "Siti Instagram", username: "siti.ig" };

    await kirim("instagram", igsid, kata);
    const kontak = await prisma.contact.findUniqueOrThrow({ where: { phone: `ig:${igsid}` } });
    expect(kontak).toMatchObject({ consentSource: "instagram", name: "Siti Instagram" });
    expect(kontak.consentAt).not.toBeNull();
    // Tidak pernah lewat penormal nomor.
    expect(await prisma.contact.count({ where: { phone: { in: [`62${igsid}`, igsid] } } })).toBe(0);
    expect(await respons(s.id)).toMatchObject({ saluran: "instagram", metode: "chatbot", jalurMasuk: "kata-pemicu" });
    // Pertanyaan pertama dikirim lewat Instagram sebagai teks, bukan formulir.
    expect(terkirim.filter((t) => t.flow)).toHaveLength(0);
    expect(terkirim.at(-1)).toMatchObject({ vendor: "instagram", to: `ig:${igsid}` });
    expect(terkirim.at(-1)!.text).toContain("Nama Anda?");

    // Jawaban MEMAJUKAN survei (dulu dialihkan ke Auto Reply karena surveinya mode Form).
    await kirim("instagram", igsid, "Siti");
    expect(terkirim.at(-1)!.text).toContain("Kota Anda?");
    await kirim("instagram", igsid, "Bandung");
    const r = await respons(s.id);
    expect(r.completedAt).not.toBeNull();
    expect(r.answers.map((a) => a.value).sort()).toEqual(["Bandung", "Siti"]);
  });

  it("nama kosong dari profil → @username; profil gagal → tanpa nama, survei tetap jalan", async () => {
    const a = await survei({ mode: "chat" });
    const ig1 = igsidBaru();
    tiruan.profil = { username: "budi_ig" };
    await kirim("instagram", ig1, a.kata);
    expect((await prisma.contact.findUniqueOrThrow({ where: { phone: `ig:${ig1}` } })).name).toBe("@budi_ig");

    const b = await survei({ mode: "chat" });
    const ig2 = igsidBaru();
    tiruan.profil = null;
    await kirim("instagram", ig2, b.kata);
    expect((await prisma.contact.findUniqueOrThrow({ where: { phone: `ig:${ig2}` } })).name).toBeNull();
    expect(await respons(b.s.id)).toMatchObject({ saluran: "instagram", metode: "chatbot" });
  });

  it("adaptor Instagram yang punya sendFlow pun tidak dipakai untuk kontak Instagram", async () => {
    const { s, kata } = await survei({ mode: "flow", flowId: "123" });
    tiruan.igPunyaFlow = true;
    await kirim("instagram", igsidBaru(), kata);
    expect(await respons(s.id)).toMatchObject({ metode: "chatbot" });
    expect(terkirim.filter((t) => t.flow)).toHaveLength(0);
  });

  it("WhatsApp: survei Form ber-Flow ID tetap Form", async () => {
    const { s, kata } = await survei({ mode: "flow", flowId: "123" });
    const hp = nomorBaru();
    await kirim("meta", hp, kata);
    expect(await respons(s.id)).toMatchObject({ saluran: "whatsapp", metode: "form" });
    expect(terkirim.at(-1)).toMatchObject({ vendor: "meta", flow: expect.stringMatching(/^resp_/) });
    // Teks bebas selagi formulir ditunggu tidak menjadi jawaban.
    await kirim("meta", hp, "halo");
    expect((await respons(s.id)).answers).toHaveLength(0);
  });

  it("WhatsApp: survei Form TANPA Flow ID → chatbot, dan jawaban memajukan survei (bug lama)", async () => {
    const { s, kata } = await survei({ mode: "flow", flowId: null });
    const hp = nomorBaru();
    await kirim("meta", hp, kata);
    expect(await respons(s.id)).toMatchObject({ saluran: "whatsapp", metode: "chatbot" });
    await kirim("meta", hp, "Andi");
    expect(terkirim.at(-1)!.text).toContain("Kota Anda?");
    await kirim("meta", hp, "Medan");
    const r = await respons(s.id);
    expect(r.completedAt).not.toBeNull();
    expect(r.answers).toHaveLength(2);
  });

  it("pesan ganda (messageId sama) diproses sekali — WhatsApp maupun Instagram", async () => {
    for (const vendor of ["meta", "instagram"] as const) {
      const { s, kata } = await survei({ mode: "chat" });
      const dari = vendor === "meta" ? nomorBaru() : igsidBaru();
      await kirim(vendor, dari, kata);
      const id = idUnik();
      await kirim(vendor, dari, "Jawaban satu", { messageId: id });
      const sebelum = terkirim.length;
      await kirim(vendor, dari, "Jawaban satu", { messageId: id });
      const r = await respons(s.id);
      expect(r.answers).toHaveLength(1);
      expect(r.currentStep).toBe(1);
      expect(terkirim.length).toBe(sebelum); // tidak ada balasan untuk kiriman ulang
      expect(await prisma.message.count({ where: { vendorMessageId: id } })).toBe(1);
    }
  });

  it("kiriman kembar yang tiba BERSAMAAN pun hanya diproses sekali", async () => {
    const { s, kata } = await survei({ mode: "chat" });
    const dari = igsidBaru();
    await kirim("instagram", dari, kata);
    const id = idUnik();
    await Promise.all([
      kirim("instagram", dari, "Jawaban kembar", { messageId: id }),
      kirim("instagram", dari, "Jawaban kembar", { messageId: id }),
    ]);
    const r = await respons(s.id);
    expect(r.answers).toHaveLength(1);
    expect(r.currentStep).toBe(1);
    expect(await prisma.message.count({ where: { vendorMessageId: id } })).toBe(1);
  });

  it("respons chatbot survei Form yang tak pernah dijawab dianggap ditinggalkan setelah 24 jam", async () => {
    const lama = await survei({ flowId: null });
    const baru = await survei({ mode: "chat" });
    const hp = nomorBaru();
    await kirim("meta", hp, lama.kata);
    await prisma.surveyResponse.updateMany({
      where: { surveyId: lama.s.id },
      data: { startedAt: new Date(Date.now() - 25 * 3600_000) },
    });
    await kirim("meta", hp, baru.kata);
    expect((await respons(lama.s.id)).answers).toHaveLength(0);
    expect(await prisma.surveyResponse.count({ where: { surveyId: baru.s.id } })).toBe(1);
  });

  it("alamat kontak tidak bisa dipindah antara WhatsApp dan Instagram lewat sunting kontak", async () => {
    const Fastify = (await import("fastify")).default;
    const { contactRoutes } = await import("../src/routes/contacts.js");
    const app = Fastify();
    app.decorate("authenticate", async () => {});
    app.decorate("requireWriter", async () => {});
    await app.register(contactRoutes);
    const ig = `ig:${igsidBaru()}`;
    const wa = nomorBaru();
    const [kIg, kWa] = await Promise.all([
      prisma.contact.create({ data: { phone: ig } }),
      prisma.contact.create({ data: { phone: wa } }),
    ]);
    const put = (id: string, payload: unknown) =>
      app.inject({ method: "PUT", url: `/api/contacts/${id}`, payload: payload as object });
    expect((await put(kIg.id, { name: "Siti", phone: ig })).statusCode).toBe(200); // alamat sama: boleh
    expect((await put(kIg.id, { phone: "081234567890" })).statusCode).toBe(400);
    expect((await put(kWa.id, { phone: `IG:${igsidBaru()}` })).statusCode).toBe(400);
    await app.close();
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: kIg.id } })).phone).toBe(ig);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: kWa.id } })).phone).toBe(wa);
  });

  it("DM yang tidak memicu apa pun dibalas pesan bawaan, sekali per 24 jam; WhatsApp tetap tidak", async () => {
    await survei({ mode: "chat" }); // ada survei aktif, tapi pesannya bukan kata pemicu
    const dari = igsidBaru();
    await kirim("instagram", dari, "halo kak");
    await kirim("instagram", dari, "ada info?");
    const bawaan = terkirim.filter((k) => k.text === engine.BALASAN_BAWAAN_IG);
    expect(bawaan).toHaveLength(1);
    expect(bawaan[0]!.vendor).toBe("instagram");

    const sebelum = terkirim.length;
    await kirim("meta", nomorBaru(), "halo kak");
    expect(terkirim.slice(sebelum).some((k) => k.text === engine.BALASAN_BAWAAN_IG)).toBe(false);
  });

  it("balasan bawaan: dua DM bersamaan tetap sekali; kontak yang dilayani Agen AI tidak disapa", async () => {
    await survei({ mode: "chat" });
    const dari = igsidBaru();
    await Promise.all([kirim("instagram", dari, "halo"), kirim("instagram", dari, "kak")]);
    expect(terkirim.filter((k) => k.text === engine.BALASAN_BAWAAN_IG)).toHaveLength(1);

    const lain = igsidBaru();
    const kontak = await prisma.contact.create({ data: { phone: `ig:${lain}` } });
    await prisma.message.create({
      data: { contactId: kontak.id, direction: "out", vendor: "instagram", text: "dari AI", isBot: true, source: "ai" },
    });
    const sebelum = terkirim.length;
    await kirim("instagram", lain, "halo lagi");
    expect(terkirim.length).toBe(sebelum);
  });

  it("balasan bawaan tanpa ajakan kata kunci bila tak ada survei yang bisa diikuti", async () => {
    const { s } = await survei({ mode: "chat" });
    await prisma.survey.update({ where: { id: s.id }, data: { triggerEnabled: false } });
    const dari = igsidBaru();
    await kirim("instagram", dari, "halo");
    expect(terkirim.map((k) => k.text)).toContain(engine.BALASAN_NETRAL_IG);
    expect(terkirim.map((k) => k.text)).not.toContain(engine.BALASAN_BAWAAN_IG);
  });

  it("iklan Instagram → Jalur Masuk Iklan", async () => {
    const { s, kata } = await survei({ mode: "chat" });
    await kirim("instagram", igsidBaru(), kata, { iklan: IKLAN });
    expect(await respons(s.id)).toMatchObject({
      saluran: "instagram",
      jalurMasuk: "iklan",
      iklanId: IKLAN.id,
      iklanJudul: IKLAN.judul,
    });
  });

  it("referral iklan tanpa pesan: dicatat di kontak, tidak dibalas; kata pemicu berikutnya → Iklan", async () => {
    const { s, kata } = await survei({ mode: "chat" });
    const igsid = igsidBaru();
    await engine.handleInboundEvents([
      { vendor: "instagram", kind: "message", from: igsid, iklan: IKLAN, timestamp: new Date().toISOString(), raw: {} },
    ]);
    expect(terkirim).toHaveLength(0);
    await kirim("instagram", igsid, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: IKLAN.id });
  });

  it("penutup Instagram tidak meminta lokasi walau survei mintaLokasi", async () => {
    const { s, kata } = await survei({ mode: "chat", mintaLokasi: true });
    tiruan.igPunyaLokasi = true;
    const igsid = igsidBaru();
    await kirim("instagram", igsid, kata);
    await kirim("instagram", igsid, "Siti");
    await kirim("instagram", igsid, "Bandung");
    const r = await respons(s.id);
    expect(r.completedAt).not.toBeNull();
    expect(r.lokasiDimintaPada).toBeNull();
    const akhir = terkirim.at(-1)!;
    expect(akhir.tombolLokasi).toBeUndefined();
    expect(akhir.text).not.toContain(L.PESAN_MINTA_LOKASI_BAWAAN);
    expect(akhir.text).not.toContain(L.PETUNJUK_LOKASI_TANPA_TOMBOL);

    // Pembanding: WhatsApp pada survei yang sama tetap dimintai lokasi.
    const hp = nomorBaru();
    await kirim("meta", hp, kata);
    await kirim("meta", hp, "Andi");
    await kirim("meta", hp, "Medan");
    expect(terkirim.at(-1)).toMatchObject({ vendor: "meta", tombolLokasi: true });
  });

  it("STOP dari Instagram tercatat di daftar penekan dengan alamat ig: apa adanya", async () => {
    const igsid = igsidBaru();
    await kirim("instagram", igsid, "STOP");
    expect(await prisma.contact.findUniqueOrThrow({ where: { phone: `ig:${igsid}` } })).toMatchObject({
      subscribed: false,
    });
    expect(await prisma.optOutNumber.findUnique({ where: { phone: `ig:${igsid}` } })).not.toBeNull();
    await prisma.optOutNumber.deleteMany({ where: { phone: `ig:${igsid}` } });
  });

  it("blast menyaring kontak Instagram dan melaporkan jumlahnya", async () => {
    const hp = nomorBaru();
    const igsid = igsidBaru();
    const wa = await prisma.contact.create({ data: { phone: hp } });
    const ig = await prisma.contact.create({ data: { phone: `ig:${igsid}`, consentSource: "instagram" } });
    const seg = await prisma.segment.create({
      data: { name: `uji-ig-${idUnik()}`, contacts: { create: [{ contactId: wa.id }, { contactId: ig.id }] } },
    });
    segmenDibuat.push(seg.id);
    const b = await createBlast({ segmentId: seg.id, vendor: "meta", templateName: "uji_tanpa_template" });
    expect(b).toMatchObject({ excludedInstagram: 1, excludedOptOut: 0 });
    expect(antreBlast).toEqual([{ to: hp }]);
    expect(await prisma.blastRecipient.count({ where: { blastId: b.id } })).toBe(1);

    const hanyaIg = await prisma.segment.create({
      data: { name: `uji-ig-${idUnik()}`, contacts: { create: [{ contactId: ig.id }] } },
    });
    segmenDibuat.push(hanyaIg.id);
    await expect(createBlast({ segmentId: hanyaIg.id, vendor: "meta", templateName: "x" })).rejects.toThrow(
      /Instagram/,
    );
    await expect(createBlast({ segmentId: seg.id, vendor: "instagram", templateName: "x" })).rejects.toThrow(
      "Instagram tidak mendukung templat/broadcast",
    );
  });
});
