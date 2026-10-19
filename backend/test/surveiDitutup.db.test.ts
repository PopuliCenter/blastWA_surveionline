import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// Survei yang sudah DITUTUP: tidak menerima data baru lewat jalur mana pun, dan orang yang
// mencoba ikut diberi "pesan saat survei sudah berakhir". Jawaban yang sempat masuk tetap
// disimpan tetapi tidak dihitung. Saat tidak ada survei aktif, Agen AI tidak membalas.
//
// Penyedia WhatsApp, antrean Sheets, dan Auto Reply/Agen AI ditiru; basis datanya Postgres
// sungguhan. Dilewati kecuali KUOTA_DB_URL diisi (lihat kuotaTerkunci.db.test.ts).
const URL_UJI = process.env.KUOTA_DB_URL;

const terkirim: { to: string; text?: string; flow?: string }[] = [];
const keSheets: string[] = [];
const panggilanAi: string[] = [];
let nomorPesan = 0;
const idUnik = () => `uji-${Date.now()}-${++nomorPesan}-${Math.random().toString(36).slice(2, 8)}`;

vi.mock("../src/providers/registry.js", () => ({
  getProvider: () => ({
    async sendText({ to, text }: { to: string; text: string }) {
      terkirim.push({ to, text });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    },
    async sendFlow({ to, flowToken }: { to: string; flowToken: string }) {
      terkirim.push({ to, flow: flowToken });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    },
  }),
}));
vi.mock("../src/queue/sheetQueue.js", () => ({
  enqueueSheetSync: async (id: string) => {
    keSheets.push(id);
  },
}));
// Aturan Auto Reply ditiru untuk teks "aturan"; selain itu Agen AI — dicatat supaya tes bisa
// memastikan AI TIDAK dipanggil saat tidak ada survei aktif.
vi.mock("../src/services/autoResponder.js", () => ({
  findAutoResponse: async (_c: string, text: string, opsi: { tanpaAi?: boolean } = {}) => {
    if (text === "aturan") return { text: "Balasan aturan", source: "autoreply" };
    if (opsi.tanpaAi) return null;
    panggilanAi.push(text);
    return { text: "Jawaban AI", source: "ai" };
  },
}));

type Engine = typeof import("../src/services/surveyEngine.js");
type Db = typeof import("../src/db.js");
type Kuota = typeof import("../src/services/kuotaSurvei.js");

describe.skipIf(!URL_UJI)("survei yang sudah ditutup", () => {
  let engine: Engine;
  let prisma: Db["prisma"];
  let K: Kuota;
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];
  const blastDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    engine = await import("../src/services/surveyEngine.js");
    K = await import("../src/services/kuotaSurvei.js");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.blast.deleteMany({ where: { id: { in: blastDibuat } } });
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.optOutNumber.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    terkirim.length = 0;
    keSheets.length = 0;
    panggilanAi.length = 0;
  });

  // Survei uji yang masih aktif ditutup setelah tiap tes — juga bila tesnya gagal di tengah —
  // supaya tes "tidak ada survei aktif" tidak ikut gagal karena sisa tes lain.
  afterEach(async () => {
    await prisma.survey.updateMany({
      where: { id: { in: surveiDibuat }, status: "active" },
      data: { status: "closed" },
    });
  });

  const nomorBaru = () => {
    const n = `62879${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
    nomorDibuat.push(n);
    return n;
  };
  const kirim = (from: string, text: string) =>
    engine.handleInboundEvents([
      {
        vendor: "meta",
        kind: "message",
        from,
        text,
        messageId: idUnik(),
        timestamp: new Date().toISOString(),
        raw: {},
      },
    ]);
  const kirimFormulir = (from: string, flowResponse: Record<string, unknown>) =>
    engine.handleInboundEvents([
      {
        vendor: "meta",
        kind: "message",
        from,
        interactiveType: "nfm_reply",
        flowResponse,
        messageId: idUnik(),
        timestamp: new Date().toISOString(),
        raw: {},
      },
    ]);
  const teksKe = (to: string) => terkirim.filter((t) => t.to === to).map((t) => t.text ?? `[flow ${t.flow}]`);

  async function survei(opsi: {
    status: "active" | "closed";
    mode?: "chat" | "flow";
    pesan?: string;
    pemicu?: boolean;
    penyaring?: boolean; // pertanyaan 0 = "Bersedia ikut?", jawaban "Tidak" mengakhiri survei
  }) {
    const kata = `uji tutup ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-tutup-${idUnik()}`,
        status: opsi.status,
        mode: opsi.mode ?? "chat",
        flowId: opsi.mode === "flow" ? "123" : null,
        triggerEnabled: opsi.pemicu ?? true,
        triggerKeywords: [kata],
        pesanSurveiBerakhir: opsi.pesan ?? null,
        questions: {
          create: [
            opsi.penyaring
              ? {
                  order: 0,
                  text: "Bersedia ikut?",
                  type: "boolean",
                  required: true,
                  options: { branches: [{ value: "Tidak", goto: "end" }] },
                }
              : { order: 0, text: "Nama Anda?", type: "text", required: true },
            { order: 1, text: "Pendapat Anda?", type: "text", required: true },
          ],
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    surveiDibuat.push(s.id);
    return { s, kata };
  }

  it("kata pemicu survei yang ditutup → pesan berakhir milik survei itu, sekali dalam 24 jam", async () => {
    const { s, kata } = await survei({ status: "closed", pesan: "Survei uji sudah selesai, terima kasih." });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, kata);
    expect(teksKe(hp)).toEqual(["Survei uji sudah selesai, terima kasih."]);
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(0);
  });

  it("balasan atas blast survei yang ditutup tidak memulai survei; dibalas pesan berakhir bawaan", async () => {
    const { s } = await survei({ status: "closed" });
    const hp = nomorBaru();
    const kontak = await prisma.contact.create({ data: { phone: hp } });
    const b = await prisma.blast.create({
      data: { vendor: "meta", surveyId: s.id, recipients: { create: { contactId: kontak.id, vendor: "meta" } } },
    });
    blastDibuat.push(b.id);
    await kirim(hp, "ya");
    expect(teksKe(hp)).toEqual([K.PESAN_SURVEI_BERAKHIR_BAWAAN]);
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(0);
  });

  it("survei chat ditutup saat responden masih mengisi: dihentikan, jawabannya disimpan tapi tidak dihitung", async () => {
    const { s, kata } = await survei({ status: "active" });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await prisma.survey.update({ where: { id: s.id }, data: { status: "closed" } });
    terkirim.length = 0;
    await kirim(hp, "jawaban sesudah ditutup");

    const r = await prisma.surveyResponse.findFirstOrThrow({ where: { surveyId: s.id }, include: { answers: true } });
    expect(r.completedAt).not.toBeNull();
    expect(r.ditolakKuotaPada).not.toBeNull();
    expect(r.alasanDitolakKuota).toBe("ditutup");
    expect(r.answers.map((a) => a.value)).toEqual(["Budi"]);
    expect(teksKe(hp)).toEqual([K.PESAN_SURVEI_BERAKHIR_BAWAAN]);
    expect(keSheets).toEqual([]);
  });

  it("formulir Flow dikirim setelah ditutup: disimpan, tidak dihitung; ketukan ulang tidak membuat respons baru", async () => {
    const { s, kata } = await survei({ status: "active", mode: "flow", pesan: "Maaf, survei sudah ditutup." });
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    expect(token).toBeTruthy();
    await prisma.survey.update({ where: { id: s.id }, data: { status: "closed" } });
    terkirim.length = 0;

    const isian = { [`q_${s.questions[0]!.id}`]: "Siti", [`q_${s.questions[1]!.id}`]: "Setuju" };
    await kirimFormulir(hp, { flow_token: token, ...isian });
    const r = await prisma.surveyResponse.findFirstOrThrow({ where: { surveyId: s.id }, include: { answers: true } });
    expect(r.alasanDitolakKuota).toBe("ditutup");
    expect(r.answers).toHaveLength(2);
    expect(keSheets).toEqual([]);
    expect(teksKe(hp)).toEqual(["Maaf, survei sudah ditutup."]);

    // Tombol formulir di template blast ditekan lagi: tidak ada respons baru, tidak dibalas dua kali.
    await kirimFormulir(hp, { flow_token: `srv_${s.id}`, ...isian });
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(1);
    expect(teksKe(hp)).toHaveLength(1);

    // Tidak bisa dipulihkan selama surveinya masih ditutup; bisa setelah dibuka lagi.
    expect(await K.pulihkanRespons(r.id)).toBe("masih-ditutup");
    await prisma.survey.update({ where: { id: s.id }, data: { status: "active" } });
    expect(await K.pulihkanRespons(r.id)).toBe("dipulihkan");
    await prisma.survey.update({ where: { id: s.id }, data: { status: "closed" } });
  });

  it("kata pemicu survei lama yang ditutup tidak menyerobot balasan atas blast survei yang masih aktif", async () => {
    // Sakelar pemicu keduanya mati: survei lama tetap dikenali lewat kata pemicunya, survei
    // baru hanya bisa dimulai lewat blast.
    const lama = await survei({ status: "closed", pemicu: false });
    const baru = await survei({ status: "active", pemicu: false });
    const hp = nomorBaru();
    const kontak = await prisma.contact.create({ data: { phone: hp } });
    const b = await prisma.blast.create({
      data: { vendor: "meta", surveyId: baru.s.id, recipients: { create: { contactId: kontak.id, vendor: "meta" } } },
    });
    blastDibuat.push(b.id);

    await kirim(hp, lama.kata);
    expect(await prisma.surveyResponse.count({ where: { surveyId: baru.s.id } })).toBe(1);
    expect(teksKe(hp)).toEqual(["Nama Anda?"]);
    await prisma.survey.update({ where: { id: baru.s.id }, data: { status: "closed" } });
  });

  it("permintaan berhenti yang memuat kata pemicu survei yang ditutup tetap tercatat berhenti", async () => {
    const { kata } = await survei({ status: "closed" });
    const hp = nomorBaru();
    await kirim(hp, `stop ${kata}`);
    const kontak = await prisma.contact.findUniqueOrThrow({ where: { phone: hp } });
    expect(kontak.subscribed).toBe(false);
    expect(teksKe(hp)).not.toContain(K.PESAN_SURVEI_BERAKHIR_BAWAAN);
  });

  it("formulir Flow dengan consent 'Tidak' setelah ditutup: ikut ditandai ditutup, tidak ke Sheets", async () => {
    const { s, kata } = await survei({ status: "active", mode: "flow", penyaring: true });
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    await prisma.survey.update({ where: { id: s.id }, data: { status: "closed" } });
    terkirim.length = 0;

    const isian = { [`q_${s.questions[0]!.id}`]: "Tidak" };
    await kirimFormulir(hp, { flow_token: token, ...isian });
    const r = await prisma.surveyResponse.findFirstOrThrow({ where: { surveyId: s.id } });
    expect(r.alasanDitolakKuota).toBe("ditutup");
    expect(r.consentDitolak).toBe(true);
    expect(keSheets).toEqual([]);
    expect(teksKe(hp)).toEqual([K.PESAN_SURVEI_BERAKHIR_BAWAAN]);

    await kirimFormulir(hp, { flow_token: `srv_${s.id}`, ...isian });
    expect(await prisma.surveyResponse.count({ where: { surveyId: s.id } })).toBe(1);
    expect(keSheets).toEqual([]);
  });

  it("formulir Flow yang masih ditunggu saat surveinya ditutup tidak menahan kontak", async () => {
    const { s, kata } = await survei({ status: "active", mode: "flow", pesan: "Survei formulir sudah berakhir." });
    const lain = await survei({ status: "active" });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await prisma.survey.update({ where: { id: s.id }, data: { status: "closed" } });
    terkirim.length = 0;

    await kirim(hp, kata);
    expect(teksKe(hp)).toEqual(["Survei formulir sudah berakhir."]);
    expect(panggilanAi).toEqual([]);
    await prisma.survey.update({ where: { id: lain.s.id }, data: { status: "closed" } });
  });

  it("tidak ada survei aktif: Agen AI tidak membalas; pesan berakhir sekali; aturan Auto Reply tetap jalan", async () => {
    // Prasyarat: basis data uji tidak berisi survei aktif (berkas tes DB berjalan berurutan).
    expect(await prisma.survey.count({ where: { status: "active" } })).toBe(0);
    const { s } = await survei({ status: "closed", pesan: "Survei sudah berakhir — hasilnya kami umumkan nanti." });
    const hp = nomorBaru();
    const kontak = await prisma.contact.create({ data: { phone: hp } });
    await prisma.surveyResponse.create({
      data: { surveyId: s.id, contactId: kontak.id, completedAt: new Date(), currentStep: 2 },
    });

    await kirim(hp, "kapan hasilnya keluar?");
    await kirim(hp, "halo?");
    // Balasan manual operator dan aturan Auto Reply di sela-sela tidak membuka penahannya.
    await prisma.message.create({
      data: { contactId: kontak.id, direction: "out", vendor: "meta", text: "Bulan depan, Pak.", payload: {} },
    });
    await kirim(hp, "oke terima kasih");
    await kirim(hp, "aturan");
    await kirim(hp, "halo lagi");
    // Kata pemicu survei LAIN yang juga sudah ditutup: kabarnya sama, tidak dikirim lagi.
    const lain = await survei({ status: "closed", pesan: "Survei lain juga sudah berakhir." });
    await kirim(hp, lain.kata);
    expect(teksKe(hp)).toEqual(["Survei sudah berakhir — hasilnya kami umumkan nanti.", "Balasan aturan"]);
    expect(panggilanAi).toEqual([]);

    // Ada survei aktif lagi → Agen AI kembali menjawab.
    const baru = await survei({ status: "active" });
    await kirim(hp, "ada survei baru?");
    expect(panggilanAi).toEqual(["ada survei baru?"]);
    await prisma.survey.update({ where: { id: baru.s.id }, data: { status: "closed" } });
  });
});
