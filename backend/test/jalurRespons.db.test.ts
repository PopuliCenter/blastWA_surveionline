import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Asal responden dari ujung ke ujung: tiap jalur masuk mencatat saluran, jalur, dan metode
// pada respons yang dibuatnya. Penyedia WhatsApp, antrean Sheets, dan Auto Reply ditiru;
// basis datanya PostgreSQL sungguhan. Dilewati kecuali KUOTA_DB_URL diisi.
const URL_UJI = process.env.KUOTA_DB_URL;

let nomorPesan = 0;
const idUnik = () => `uji-${Date.now()}-${++nomorPesan}-${Math.random().toString(36).slice(2, 8)}`;
const tiruan = { flowGagal: false };

vi.mock("../src/providers/registry.js", () => ({
  getProvider: () => ({
    async sendText() {
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    },
    async sendFlow() {
      if (tiruan.flowGagal) return { status: "failed", vendorMessageId: "", raw: {} };
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    },
  }),
}));
vi.mock("../src/queue/sheetQueue.js", () => ({ enqueueSheetSync: async () => {}, enqueueSheetLokasi: async () => {} }));
vi.mock("../src/services/autoResponder.js", () => ({ findAutoResponse: async () => null }));

type Engine = typeof import("../src/services/surveyEngine.js");
type Db = typeof import("../src/db.js");

describe.skipIf(!URL_UJI)("asal responden", () => {
  let engine: Engine;
  let prisma: Db["prisma"];
  let Fastify: typeof import("fastify").default;
  let surveyRoutes: typeof import("../src/routes/surveys.js").surveyRoutes;
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];
  const blastDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    engine = await import("../src/services/surveyEngine.js");
    Fastify = (await import("fastify")).default;
    surveyRoutes = (await import("../src/routes/surveys.js")).surveyRoutes;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.blast.deleteMany({ where: { id: { in: blastDibuat } } });
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.$disconnect();
  });

  // Survei uji lain tidak boleh ikut menjawab kata pemicu.
  beforeEach(async () => {
    tiruan.flowGagal = false;
    await prisma.survey.updateMany({ where: { id: { in: surveiDibuat } }, data: { status: "closed" } });
  });

  const nomorBaru = () => {
    const n = `62876${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
    nomorDibuat.push(n);
    return n;
  };
  const IKLAN = { id: "2381", judul: "Ikut survei nasional" };
  const kirim = (from: string, text: string, iklan?: typeof IKLAN) =>
    engine.handleInboundEvents([
      {
        vendor: "meta",
        kind: "message",
        from,
        text,
        ...(iklan ? { iklan } : {}),
        messageId: idUnik(),
        timestamp: new Date().toISOString(),
        raw: {},
      },
    ]);

  async function survei(mode: "chat" | "flow" = "chat") {
    const kata = `uji jalur ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-jalur-${idUnik()}`,
        status: "active",
        mode,
        flowId: mode === "flow" ? "123" : null,
        triggerEnabled: true,
        triggerKeywords: [kata],
        questions: { create: [{ order: 0, text: "Nama Anda?", type: "text", required: true }] },
      },
      include: { questions: true },
    });
    surveiDibuat.push(s.id);
    return { s, kata };
  }
  const respons = (surveyId: string) => prisma.surveyResponse.findFirstOrThrow({ where: { surveyId } });
  const lalu = (jam: number) => new Date(Date.now() - jam * 3600_000);

  async function blastKe(
    surveyId: string,
    hp: string,
    opsi: { status?: "queued" | "sent" | "failed"; createdAt?: Date; terkirimPada?: Date } = {},
  ) {
    const kontak = await prisma.contact.upsert({ where: { phone: hp }, update: {}, create: { phone: hp } });
    const b = await prisma.blast.create({
      data: {
        vendor: "meta",
        surveyId,
        recipients: { create: { contactId: kontak.id, vendor: "meta", status: "sent", ...opsi } },
      },
    });
    blastDibuat.push(b.id);
    return b;
  }

  it("kata pemicu biasa → Kata pemicu, Chatbot, tanpa iklan", async () => {
    const { s, kata } = await survei();
    await kirim(nomorBaru(), kata);
    expect(await respons(s.id)).toMatchObject({
      saluran: "whatsapp",
      jalurMasuk: "kata-pemicu",
      metode: "chatbot",
      iklanId: null,
    });
  });

  it("kata pemicu dari iklan → Iklan, dengan ID dan judulnya", async () => {
    const { s, kata } = await survei();
    await kirim(nomorBaru(), kata, IKLAN);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: "2381", iklanJudul: IKLAN.judul });
  });

  it("menyapa dulu dari iklan, baru mengetik kata pemicu → tetap Iklan", async () => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    await kirim(hp, "halo", IKLAN);
    await kirim(hp, kata); // data iklan tidak lagi ikut pada pesan kedua ini
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: "2381" });
  });

  it("iklan yang diketuk lebih dari 72 jam lalu tidak lagi dihitung", async () => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    await prisma.contact.create({
      data: { phone: hp, iklanId: "lama", iklanJudul: "Lama", iklanPada: new Date(Date.now() - 73 * 3600_000) },
    });
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", iklanId: null });
  });

  it("balasan atas blast → Broadcast, dengan blastId", async () => {
    const { s } = await survei();
    const hp = nomorBaru();
    const b = await blastKe(s.id, hp);
    await kirim(hp, "ya");
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "broadcast", blastId: b.id, iklanId: null });
  });

  it("penerima blast yang lalu mengetuk iklan → Iklan: blastId tetap tercatat", async () => {
    const { s } = await survei();
    const hp = nomorBaru();
    const b = await blastKe(s.id, hp);
    await kirim(hp, "ya", IKLAN);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: "2381", blastId: b.id });
  });

  it("penerima blast yang membalas dengan kata pemicu → tetap Broadcast", async () => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    const b = await blastKe(s.id, hp);
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "broadcast", blastId: b.id });
  });

  it("iklan lalu blast yang lebih baru, dibalas kata pemicu → Broadcast", async () => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    await prisma.contact.create({
      data: { phone: hp, iklanId: "2381", iklanJudul: "Iklan", iklanPada: lalu(48) },
    });
    const b = await blastKe(s.id, hp, { createdAt: lalu(1) });
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "broadcast", blastId: b.id, iklanId: null });
  });

  it("blast yang sudah lewat jendela balasan tidak dihitung pada kata pemicu", async () => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    await blastKe(s.id, hp, { createdAt: lalu(30 * 24) });
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", blastId: null });
  });

  it.each(["failed", "queued"] as const)("blast berstatus %s bukan broadcast yang diterima", async (status) => {
    const { s, kata } = await survei();
    const hp = nomorBaru();
    await blastKe(s.id, hp, { status });
    await kirim(hp, "ya");
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(0);
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", blastId: null });
  });

  it("iklan dibandingkan dengan saat blast TERKIRIM, bukan saat penerimanya dibuat", async () => {
    const { s } = await survei();
    const hp = nomorBaru();
    await prisma.contact.create({ data: { phone: hp, iklanId: "2381", iklanPada: lalu(2) } });
    const b = await blastKe(s.id, hp, { createdAt: lalu(5), terkirimPada: lalu(1) });
    await kirim(hp, "ya");
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "broadcast", blastId: b.id, iklanId: null });
  });

  it("satu ketukan iklan hanya untuk satu respons", async () => {
    const a = await survei();
    const b = await survei();
    const hp = nomorBaru();
    await kirim(hp, a.kata, IKLAN);
    await kirim(hp, "Siti"); // menyelesaikan survei pertama
    expect(await prisma.contact.findUniqueOrThrow({ where: { phone: hp } })).toMatchObject({
      iklanId: null,
      iklanJudul: null,
      iklanPada: null,
    });
    await kirim(hp, b.kata);
    expect(await respons(a.s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: IKLAN.id });
    expect(await respons(b.s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", iklanId: null });
  });

  it("formulir gagal terkirim: ketukan iklannya masih berlaku untuk percobaan berikutnya", async () => {
    const { s, kata } = await survei("flow");
    const hp = nomorBaru();
    tiruan.flowGagal = true;
    await kirim(hp, kata, IKLAN);
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(0);
    tiruan.flowGagal = false;
    await kirim(hp, kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: IKLAN.id });
  });

  describe("formulir dikirim ulang lewat kata pemicu", () => {
    it("penerima blast tetap Broadcast, dengan blastId-nya", async () => {
      const { s, kata } = await survei("flow");
      const hp = nomorBaru();
      const b = await blastKe(s.id, hp);
      await kirim(hp, "ya");
      await kirim(hp, kata);
      expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(1);
      expect(await respons(s.id)).toMatchObject({ jalurMasuk: "broadcast", blastId: b.id, metode: "form" });
    });

    it("yang datang dari iklan tetap Iklan, walau ketukannya sudah terpakai", async () => {
      const { s, kata } = await survei("flow");
      const hp = nomorBaru();
      await kirim(hp, kata, IKLAN);
      await kirim(hp, kata);
      expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(1);
      expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: IKLAN.id, iklanJudul: IKLAN.judul });
    });

    it("ketukan iklan baru menggantikan asal lamanya; blastId tetap tercatat", async () => {
      const { s, kata } = await survei("flow");
      const hp = nomorBaru();
      const b = await blastKe(s.id, hp);
      await kirim(hp, "ya");
      await kirim(hp, kata, { id: "9999", judul: "Iklan baru" });
      expect(await respons(s.id)).toMatchObject({ jalurMasuk: "iklan", iklanId: "9999", blastId: b.id });
    });

    it("kata pemicu survei LAIN: asal survei sebelumnya tidak terbawa", async () => {
      const a = await survei("flow");
      const b = await survei("flow");
      const hp = nomorBaru();
      await kirim(hp, a.kata, IKLAN);
      await kirim(hp, b.kata);
      expect(await respons(b.s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", iklanId: null });
    });
  });

  it("survei Flow → metode Form; tombol formulir pada template blast → Broadcast", async () => {
    const { s, kata } = await survei("flow");
    await kirim(nomorBaru(), kata);
    expect(await respons(s.id)).toMatchObject({ jalurMasuk: "kata-pemicu", metode: "form" });

    const lain = await survei("flow");
    await engine.handleInboundEvents([
      {
        vendor: "meta",
        kind: "message",
        from: nomorBaru(),
        interactiveType: "nfm_reply",
        flowResponse: { flow_token: `srv_${lain.s.id}`, [`q_${lain.s.questions[0]!.id}`]: "Siti" },
        messageId: idUnik(),
        timestamp: new Date().toISOString(),
        raw: {},
      },
    ]);
    expect(await respons(lain.s.id)).toMatchObject({ jalurMasuk: "broadcast", metode: "form" });
  });

  it("API mengirim label yang siap tampil; respons lama tidak ditebak", async () => {
    const { s, kata } = await survei();
    await kirim(nomorBaru(), kata, IKLAN);
    const lamaHp = nomorBaru();
    const lama = await prisma.contact.create({ data: { phone: lamaHp } });
    await prisma.surveyResponse.create({ data: { surveyId: s.id, contactId: lama.id, currentStep: 0 } });

    const app = Fastify();
    app.decorate("authenticate", async () => {});
    app.decorate("requireWriter", async () => {});
    await app.register(surveyRoutes);
    const isi = (await app.inject({ url: `/api/surveys/${s.id}/responses` })).json() as {
      phone: string;
      saluran: string;
      jalurMasuk: string;
      metode: string;
      iklanId: string;
      iklanJudul: string | null;
    }[];
    await app.close();

    expect(isi.find((r) => r.phone !== lamaHp)).toMatchObject({
      saluran: "WhatsApp",
      jalurMasuk: "Iklan",
      metode: "Chatbot",
      iklanId: "2381",
      iklanJudul: IKLAN.judul,
    });
    expect(isi.find((r) => r.phone === lamaHp)).toMatchObject({
      saluran: "WhatsApp",
      jalurMasuk: "(tidak tercatat)",
      metode: "Chatbot",
      iklanId: "",
    });
  });
});
