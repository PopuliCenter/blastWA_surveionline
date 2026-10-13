import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Alur penolakan kuota dari ujung ke ujung: pesan masuk → mesin survei → balasan.
// Penyedia WhatsApp dan antrean Google Sheets ditiru — tidak ada pesan yang benar-benar
// terkirim — tetapi basis datanya PostgreSQL sungguhan.
//
// Dilewati kecuali KUOTA_DB_URL diisi (lihat kuotaTerkunci.db.test.ts).
const URL_UJI = process.env.KUOTA_DB_URL;

const terkirim: { to: string; text?: string; flow?: string }[] = [];
const keSheets: string[] = [];
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
vi.mock("../src/services/autoResponder.js", () => ({ findAutoResponse: async () => null }));

type Engine = typeof import("../src/services/surveyEngine.js");
type Db = typeof import("../src/db.js");
type Kuota = typeof import("../src/services/kuotaSurvei.js");

describe.skipIf(!URL_UJI)("alur penolakan kuota — pesan masuk sampai balasan", () => {
  let engine: Engine;
  let prisma: Db["prisma"];
  let PESAN_BAWAAN: string;
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    engine = await import("../src/services/surveyEngine.js");
    PESAN_BAWAAN = ((await import("../src/services/kuotaSurvei.js")) as Kuota).PESAN_KUOTA_PENUH_BAWAAN;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    terkirim.length = 0;
    keSheets.length = 0;
  });

  const nomorBaru = () => {
    const n = `62877${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
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

  // Survei chat: nama → provinsi → pendapat. Kuota Jawa Barat (32) = 1, sudah terisi.
  async function surveiChat(opsi: { pesanKuotaPenuh?: string } = {}) {
    const kata = `uji kuota ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-alur-${idUnik()}`,
        status: "active",
        mode: "chat",
        triggerEnabled: true,
        triggerKeywords: [kata],
        pesanKuotaPenuh: opsi.pesanKuotaPenuh ?? null,
        kuotaProvinsi: { create: { kodeProvinsi: "32", target: 1 } },
        questions: {
          create: [
            { order: 0, text: "Nama Anda?", type: "text", required: true },
            { order: 1, text: "Provinsi tempat tinggal?", type: "wilayah", required: true },
            { order: 2, text: "Pendapat Anda?", type: "text", required: true },
          ],
        },
      },
    });
    surveiDibuat.push(s.id);
    // Satu responden Jawa Barat yang sudah diterima — jatahnya habis.
    const lama = await prisma.contact.create({ data: { phone: nomorBaru() } });
    await prisma.surveyResponse.create({
      data: { surveyId: s.id, contactId: lama.id, kodeProvinsi: "32", completedAt: new Date(), currentStep: 3 },
    });
    return { surveyId: s.id, kata };
  }

  it("chat: provinsi yang penuh dihentikan di pertanyaan wilayah, sisa pertanyaan tidak dikirim", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();

    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Jawa Barat");

    const pesan = teksKe(hp);
    expect(pesan[0]).toContain("Nama Anda?");
    expect(pesan[1]).toContain("Provinsi tempat tinggal?");
    expect(pesan[2]).toBe(PESAN_BAWAAN);
    expect(pesan).toHaveLength(3); // "Pendapat Anda?" tidak pernah terkirim
    // Balasan penolakannya tidak menyebut provinsi. (Pertanyaan wilayahnya sendiri memang
    // mencontohkan "Jawa Barat" — yang diperiksa hanya balasan penolakan.)
    expect(pesan[2]).not.toContain("Jawa Barat");

    const r = await prisma.surveyResponse.findFirst({
      where: { surveyId, contact: { phone: hp } },
      include: { answers: true },
    });
    expect(r?.ditolakKuotaPada).not.toBeNull();
    expect(r?.alasanDitolakKuota).toBe("provinsi");
    expect(r?.completedAt).not.toBeNull(); // sesi ditutup — kontak tidak terkunci
    expect(r?.answers).toHaveLength(2); // jawabannya disimpan, bukan dibuang
    expect(keSheets).not.toContain(r?.id); // tidak masuk Google Sheets
  });

  it("chat: orang yang sama mengetik pemicu lagi → ditolak di awal, tanpa pertanyaan dan tanpa pesan ganda", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Jawa Barat");
    const sebelum = teksKe(hp).length;

    await kirim(hp, kata);
    await kirim(hp, kata);

    // Provinsinya sudah diketahui dari jawaban sebelumnya, jadi ditolak sebelum satu
    // pertanyaan pun terkirim — dan pesan yang sama tidak diulang berturut-turut.
    expect(teksKe(hp).length).toBe(sebelum);
    expect(await prisma.surveyResponse.count({ where: { surveyId, contact: { phone: hp } } })).toBe(1);
  });

  it("chat: provinsi yang masih longgar selesai normal dan masuk Google Sheets", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Siti");
    await kirim(hp, "Banten");
    await kirim(hp, "Bagus");

    const r = await prisma.surveyResponse.findFirst({ where: { surveyId, contact: { phone: hp } } });
    expect(r?.ditolakKuotaPada).toBeNull();
    expect(r?.completedAt).not.toBeNull();
    expect(keSheets).toContain(r?.id);
    expect(teksKe(hp).at(-1)).not.toBe(PESAN_BAWAAN);
  });

  it("chat: pesan manual survei dipakai menggantikan teks bawaan", async () => {
    const { kata } = await surveiChat({ pesanKuotaPenuh: "Mohon maaf, pendaftaran responden sudah ditutup." });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Jawa Barat");
    expect(teksKe(hp).at(-1)).toBe("Mohon maaf, pendaftaran responden sudah ditutup.");
  });

  it("chat: setelah kuota dinaikkan, orang yang pernah ditolak bisa mengisi dari awal", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Jawa Barat");

    await prisma.kuotaProvinsi.update({
      where: { surveyId_kodeProvinsi: { surveyId, kodeProvinsi: "32" } },
      data: { target: 5 },
    });
    terkirim.length = 0;
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Jawa Barat");
    await kirim(hp, "Cukup baik");

    expect(teksKe(hp)[0]).toContain("Nama Anda?");
    const diterima = await prisma.surveyResponse.findFirst({
      where: { surveyId, contact: { phone: hp }, ditolakKuotaPada: null },
    });
    expect(diterima?.completedAt).not.toBeNull();
  });

  // ===== Mode Flow =====

  async function surveiFlow() {
    const s = await prisma.survey.create({
      data: {
        title: `uji-flow-${idUnik()}`,
        status: "active",
        mode: "flow",
        flowId: "123",
        triggerEnabled: true,
        triggerKeywords: [`uji flow ${Math.random().toString(36).slice(2, 7)}`],
        kuotaProvinsi: { create: { kodeProvinsi: "32", target: 1 } },
        questions: {
          create: [
            { order: 0, text: "Nama Anda?", type: "text", required: true },
            { order: 1, text: "Provinsi Anda?", type: "text", required: true },
          ],
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    // Pertanyaan provinsi bertipe teks yang ditunjuk sebagai sumber provinsi — pola
    // instrumen lama yang tidak memakai tipe Wilayah.
    await prisma.survey.update({ where: { id: s.id }, data: { questionProvinsiId: s.questions[1]!.id } });
    surveiDibuat.push(s.id);
    const lama = await prisma.contact.create({ data: { phone: nomorBaru() } });
    await prisma.surveyResponse.create({
      data: { surveyId: s.id, contactId: lama.id, kodeProvinsi: "32", completedAt: new Date(), currentStep: 2 },
    });
    const isian = (nama: string, prov: string) => ({
      [`q_${s.questions[0]!.id}`]: nama,
      [`q_${s.questions[1]!.id}`]: prov,
    });
    return { surveyId: s.id, kata: s.triggerKeywords[0]!, isian };
  }

  it("flow: formulir dari provinsi yang penuh disimpan tapi ditolak, dan dibalas pesan kuota", async () => {
    const { surveyId, kata, isian } = await surveiFlow();
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    expect(token).toMatch(/^resp_/);

    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });

    const r = await prisma.surveyResponse.findFirst({
      where: { surveyId, contact: { phone: hp } },
      include: { answers: true },
    });
    expect(r?.ditolakKuotaPada).not.toBeNull();
    expect(r?.currentStep).toBe(2); // lengkap — bisa dipulihkan kelak
    expect(r?.answers).toHaveLength(2);
    expect(keSheets).not.toContain(r?.id);
    expect(teksKe(hp).at(-1)).toBe(PESAN_BAWAAN);
  });

  it("flow: formulir yang sama dikirim ulang tidak dibalas berulang", async () => {
    const { kata, isian } = await surveiFlow();
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });
    const sebelum = teksKe(hp).length;

    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });
    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });
    expect(teksKe(hp).length).toBe(sebelum);
  });

  it("flow: tombol formulir blast (srv_) tidak melahirkan respons baru tiap ketukan", async () => {
    const { surveyId, isian } = await surveiFlow();
    const hp = nomorBaru();
    await kirimFormulir(hp, { flow_token: `srv_${surveyId}`, ...isian("Budi", "Jawa Barat") });
    expect(teksKe(hp)).toEqual([PESAN_BAWAAN]); // pertama kali: disimpan, ditolak, dibalas

    await kirimFormulir(hp, { flow_token: `srv_${surveyId}`, ...isian("Budi", "Jawa Barat") });
    await kirimFormulir(hp, { flow_token: `srv_${surveyId}`, ...isian("Budi", "Jawa Barat") });

    expect(await prisma.surveyResponse.count({ where: { surveyId, contact: { phone: hp } } })).toBe(1);
    expect(teksKe(hp)).toEqual([PESAN_BAWAAN]);
  });

  it("flow: provinsi yang longgar diterima dan masuk Google Sheets", async () => {
    const { surveyId, kata, isian } = await surveiFlow();
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    await kirimFormulir(hp, { flow_token: token, ...isian("Siti", "Banten") });

    const r = await prisma.surveyResponse.findFirst({ where: { surveyId, contact: { phone: hp } } });
    expect(r?.ditolakKuotaPada).toBeNull();
    expect(r?.kodeProvinsi).toBe("36");
    expect(keSheets).toContain(r?.id);
  });

  it("chat: pertanyaan wilayah di urutan TERAKHIR → ditolak di akhir dengan jawaban lengkap, bisa dipulihkan", async () => {
    const kata = `uji akhir ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-akhir-${idUnik()}`,
        status: "active",
        mode: "chat",
        triggerEnabled: true,
        triggerKeywords: [kata],
        kuotaProvinsi: { create: { kodeProvinsi: "32", target: 1 } },
        questions: {
          create: [
            { order: 0, text: "Nama Anda?", type: "text", required: true },
            { order: 1, text: "Pendapat Anda?", type: "text", required: true },
            { order: 2, text: "Provinsi tempat tinggal?", type: "wilayah", required: true },
          ],
        },
      },
    });
    surveiDibuat.push(s.id);
    const lama = await prisma.contact.create({ data: { phone: nomorBaru() } });
    await prisma.surveyResponse.create({
      data: { surveyId: s.id, contactId: lama.id, kodeProvinsi: "32", completedAt: new Date(), currentStep: 3 },
    });

    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "Budi");
    await kirim(hp, "Baik");
    await kirim(hp, "Jawa Barat");

    const r = await prisma.surveyResponse.findFirst({
      where: { surveyId: s.id, contact: { phone: hp } },
      include: { answers: true },
    });
    expect(r?.ditolakKuotaPada).not.toBeNull();
    expect(r?.answers).toHaveLength(3);
    // Tercatat sampai akhir — bukan "dihentikan di tengah" — jadi skrip pemulihan mengenalinya.
    expect(r?.currentStep).toBe(3);
    expect(teksKe(hp).at(-1)).toBe(PESAN_BAWAAN);
  });

  it("flow: formulir yang dulu ditolak lalu dikirim ulang SETELAH kuota dinaikkan → dipulihkan", async () => {
    const { surveyId, kata, isian } = await surveiFlow();
    const hp = nomorBaru();
    await kirim(hp, kata);
    const token = terkirim.find((t) => t.to === hp)?.flow;
    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });
    expect(teksKe(hp).at(-1)).toBe(PESAN_BAWAAN);

    await prisma.kuotaProvinsi.update({
      where: { surveyId_kodeProvinsi: { surveyId, kodeProvinsi: "32" } },
      data: { target: 3 },
    });
    keSheets.length = 0;
    await kirimFormulir(hp, { flow_token: token, ...isian("Budi", "Jawa Barat") });

    const semua = await prisma.surveyResponse.findMany({ where: { surveyId, contact: { phone: hp } } });
    expect(semua).toHaveLength(1); // dipulihkan, bukan respons baru
    expect(semua[0]!.ditolakKuotaPada).toBeNull();
    expect(keSheets).toContain(semua[0]!.id);
    expect(teksKe(hp).at(-1)).not.toBe(PESAN_BAWAAN);
  });

  it("pembatas pesan berlaku per survei: penolakan pertama di survei lain tetap dijawab", async () => {
    const a = await surveiChat();
    const b = await surveiChat();
    // Kuota global keduanya penuh, jadi penolakan terjadi di awal.
    await prisma.survey.updateMany({ where: { id: { in: [a.surveyId, b.surveyId] } }, data: { targetResponden: 1 } });
    const hp = nomorBaru();

    await kirim(hp, a.kata);
    await kirim(hp, b.kata);
    await kirim(hp, b.kata); // pengulangan di survei B — tidak dibalas lagi

    expect(teksKe(hp)).toEqual([PESAN_BAWAAN, PESAN_BAWAAN]);
  });
});
