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
type Profil = null | { name?: string; username?: string };
const tiruan = {
  profil: null as Profil,
  // Profil per IGSID (didahulukan dari `profil`), dan jumlah panggilan API profil.
  profilPer: new Map<string, Profil>(),
  panggilProfil: 0,
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
        async ambilProfil(igsid: string) {
          tiruan.panggilProfil++;
          return tiruan.profilPer.has(igsid) ? tiruan.profilPer.get(igsid)! : tiruan.profil;
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
    tiruan.profilPer.clear();
    tiruan.panggilProfil = 0;
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

  it("pembuka & penutup khusus Instagram; WhatsApp tetap memakai deskripsi & kata penutup umum", async () => {
    const { s, kata } = await survei({ mode: "chat" });
    await prisma.survey.update({
      where: { id: s.id },
      data: {
        description: "Deskripsi umum",
        closingMessage: "Penutup umum",
        pembukaInstagram: "Pembuka IG: balas dengan nomor pilihan.",
        penutupInstagram: "Penutup IG: terima kasih!",
      },
    });
    const ig = igsidBaru();
    await kirim("instagram", ig, kata);
    await kirim("instagram", ig, "Siti");
    await kirim("instagram", ig, "Bandung");
    const keIg = terkirim.filter((k) => k.vendor === "instagram").map((k) => k.text ?? "");
    expect(keIg[0]!.startsWith("Pembuka IG: balas dengan nomor pilihan.\n\n")).toBe(true);
    expect(keIg.some((t) => t.includes("Deskripsi umum"))).toBe(false);
    expect(keIg).toContain("Penutup IG: terima kasih!");

    const sebelum = terkirim.length;
    const wa = nomorBaru();
    await kirim("meta", wa, kata);
    await kirim("meta", wa, "Budi");
    await kirim("meta", wa, "Medan");
    const keWa = terkirim.slice(sebelum).map((k) => k.text ?? "");
    expect(keWa[0]!.startsWith("Deskripsi umum\n\n")).toBe(true);
    expect(keWa).toContain("Penutup umum");
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

  describe("profil Instagram: username tersimpan, diperbarui, dan dilengkapi", () => {
    const kontakIg = (igsid: string) => prisma.contact.findUniqueOrThrow({ where: { phone: `ig:${igsid}` } });
    const JAM = 3600_000;

    it("(a) DM pertama menyimpan username dan waktu cek; nama terisi; baris Sheets memuat @username", async () => {
      const { s, kata } = await survei({ mode: "chat" });
      const igsid = igsidBaru();
      tiruan.profil = { name: "Siti Instagram", username: "siti.ig" };
      const sebelum = Date.now();
      await kirim("instagram", igsid, kata);
      const k = await kontakIg(igsid);
      expect(k).toMatchObject({ name: "Siti Instagram", igUsername: "siti.ig" });
      expect(k.igProfilPada!.getTime()).toBeGreaterThanOrEqual(sebelum - 1000);
      // Sekali saja: startSurvey tidak mengecek lagi profil yang baru dicek.
      expect(tiruan.panggilProfil).toBe(1);
      expect(await respons(s.id)).toMatchObject({ saluran: "instagram" });

      const { sheetRow, sheetHeader, JUDUL_USERNAME_IG } = await import("../src/lib/sheetRows.js");
      const judul = sheetHeader([]);
      const baris = sheetRow({
        phone: k.phone,
        name: k.name,
        consentSource: k.consentSource,
        startedAt: new Date(),
        completedAt: new Date(),
        questions: [],
        answers: [],
        igUsername: k.igUsername,
      });
      expect(baris[judul.indexOf(JUDUL_USERNAME_IG)]).toBe("@siti.ig");
    });

    it("(b) profil gagal → waktu cek tetap tercatat, dan DM berikutnya TIDAK memanggil API lagi", async () => {
      const igsid = igsidBaru();
      tiruan.profil = null;
      await kirim("instagram", igsid, "halo");
      const k = await kontakIg(igsid);
      expect(k.igProfilPada).not.toBeNull();
      expect(k).toMatchObject({ name: null, igUsername: null });
      expect(tiruan.panggilProfil).toBe(1);
      tiruan.profil = { username: "telat" };
      await kirim("instagram", igsid, "halo lagi");
      expect(tiruan.panggilProfil).toBe(1);
      expect((await kontakIg(igsid)).igUsername).toBeNull();
    });

    it("kontak lama yang belum pernah dicek terlengkapi saat DM lagi", async () => {
      const igsid = igsidBaru();
      await prisma.contact.create({ data: { phone: `ig:${igsid}`, name: "@budi_lama", consentSource: "instagram" } });
      tiruan.profil = { username: "budi_lama" };
      await kirim("instagram", igsid, "halo");
      expect(await kontakIg(igsid)).toMatchObject({ name: "@budi_lama", igUsername: "budi_lama" });
      expect(tiruan.panggilProfil).toBe(1);
    });

    it("(c) startSurvey memperbarui profil > 24 jam: @lama → @baru, nama suntingan tetap", async () => {
      const { s, kata } = await survei({ mode: "chat" });
      const [igOto, igSunting, igSegar, igTanpa] = [igsidBaru(), igsidBaru(), igsidBaru(), igsidBaru()];
      const lama = new Date(Date.now() - 25 * JAM);
      await prisma.contact.createMany({
        data: [
          { phone: `ig:${igOto}`, name: "@lama", igUsername: "lama", igProfilPada: lama },
          { phone: `ig:${igSunting}`, name: "Bu Siti (RT 3)", igUsername: "lama2", igProfilPada: lama },
          { phone: `ig:${igSegar}`, name: "@segar", igUsername: "segar", igProfilPada: new Date(Date.now() - JAM) },
          { phone: `ig:${igTanpa}`, name: "@tetap", igUsername: "tetap", igProfilPada: lama },
        ],
      });
      tiruan.profilPer.set(igOto, { username: "baru" });
      tiruan.profilPer.set(igSunting, { name: "Siti Nurhaliza", username: "baru2" });
      tiruan.profilPer.set(igSegar, { username: "tak_dipakai" });
      // Respons tanpa username tidak menghapus username lama.
      tiruan.profilPer.set(igTanpa, { name: "Hanya Nama" });

      const sebelum = Date.now();
      await kirim("instagram", igOto, kata);
      const oto = await kontakIg(igOto);
      expect(oto).toMatchObject({ name: "@baru", igUsername: "baru" });
      expect(oto.igProfilPada!.getTime()).toBeGreaterThanOrEqual(sebelum - 1000);
      expect(await prisma.surveyResponse.count({ where: { surveyId: s.id, contactId: oto.id } })).toBe(1);

      await kirim("instagram", igSunting, kata);
      expect(await kontakIg(igSunting)).toMatchObject({ name: "Bu Siti (RT 3)", igUsername: "baru2" });

      await kirim("instagram", igTanpa, kata);
      expect(await kontakIg(igTanpa)).toMatchObject({ name: "@tetap", igUsername: "tetap" });

      const n = tiruan.panggilProfil;
      await kirim("instagram", igSegar, kata);
      expect(tiruan.panggilProfil).toBe(n); // dicek < 24 jam lalu → tidak dipanggil
      expect(await kontakIg(igSegar)).toMatchObject({ name: "@segar", igUsername: "segar" });
    });

    it("nama yang berubah di antara pembacaan dan penulisan tidak ditimpa", async () => {
      const { perbaruiProfilInstagram } = await import("../src/services/profilInstagram.js");
      const igsid = igsidBaru();
      const k = await prisma.contact.create({ data: { phone: `ig:${igsid}`, name: "Disunting operator" } });
      tiruan.profil = { name: "Nama Profil", username: "uname" };
      // Pemanggil masih memegang nama kosong — operator menyuntingnya sebelum profil tiba.
      expect(await perbaruiProfilInstagram(k.id, "instagram", igsid, { name: null, igUsername: null })).toBe(
        "berhasil",
      );
      expect(await kontakIg(igsid)).toMatchObject({ name: "Disunting operator", igUsername: "uname" });
    });

    it("(d) pelengkap kontak lama: rencana tidak menulis; --apply mengisi username", async () => {
      const { lengkapiProfilKontakLama } = await import("../src/services/profilInstagram.js");
      const [igA, igB, igC, igD, igE] = [igsidBaru(), igsidBaru(), igsidBaru(), igsidBaru(), igsidBaru()];
      // Kontak ig: tanpa username dari uji lain ikut diproses skrip; dibuat berhasil supaya
      // tidak memicu penghentian dini karena gagal beruntun.
      tiruan.profil = { username: "lain_lain" };
      const dicek = new Date(Date.now() - 48 * JAM);
      await prisma.contact.createMany({
        data: [
          { phone: `ig:${igA}`, name: null },
          { phone: `ig:${igB}`, name: "Pak Operator" },
          { phone: `ig:${igC}`, name: null, igProfilPada: dicek }, // dulu gagal terbaca
          { phone: `ig:${igD}`, name: null },
          { phone: `ig:${igE}`, name: "@e_lama" }, // dulu diisi otomatis, sebelum username disimpan
        ],
      });
      tiruan.profilPer.set(igE, { username: "e_baru" });
      tiruan.profilPer.set(igA, { username: "a_baru" });
      tiruan.profilPer.set(igB, { name: "Profil B", username: "b_baru" });
      tiruan.profilPer.set(igC, { name: "Profil C" });
      tiruan.profilPer.set(igD, null);

      const rencana = await lengkapiProfilKontakLama({ apply: false });
      expect(rencana.tanpaUsername).toBeGreaterThanOrEqual(4);
      expect(rencana.belumDicek).toBeGreaterThanOrEqual(3);
      expect(rencana.diproses).toBe(0);
      expect(tiruan.panggilProfil).toBe(0);
      expect((await kontakIg(igA)).igProfilPada).toBeNull();

      const hasil = await lengkapiProfilKontakLama({ apply: true, jedaMs: 0 });
      expect(hasil.diproses).toBeGreaterThanOrEqual(4);
      expect(hasil.berhasil).toBeGreaterThanOrEqual(2);
      expect(hasil.tanpaUsernameDariApi).toBeGreaterThanOrEqual(1);
      expect(hasil.gagal).toBeGreaterThanOrEqual(1);
      expect(await kontakIg(igA)).toMatchObject({ name: "@a_baru", igUsername: "a_baru" });
      expect(await kontakIg(igB)).toMatchObject({ name: "Pak Operator", igUsername: "b_baru" });
      const c = await kontakIg(igC);
      expect(c).toMatchObject({ name: "Profil C", igUsername: null });
      expect(c.igProfilPada!.getTime()).toBeGreaterThan(dicek.getTime());
      const d = await kontakIg(igD);
      expect(d.igUsername).toBeNull();
      // Kegagalan di skrip tidak dicatat: kontak ini tetap dilengkapi otomatis saat DM lagi.
      expect(d.igProfilPada).toBeNull();
      // Nama "@lama" dari masa sebelum username disimpan ikut berganti.
      expect(await kontakIg(igE)).toMatchObject({ name: "@e_baru", igUsername: "e_baru" });
    });

    it("pelengkap berhenti dini saat gagal beruntun (batas laju), tanpa menandai kontak", async () => {
      const { lengkapiProfilKontakLama } = await import("../src/services/profilInstagram.js");
      const ids = Array.from({ length: 16 }, () => igsidBaru());
      await prisma.contact.createMany({ data: ids.map((id) => ({ phone: `ig:${id}` })) });
      tiruan.profil = null; // semua gagal
      const hasil = await lengkapiProfilKontakLama({ apply: true, jedaMs: 0 });
      expect(hasil.berhentiDini).toBe(true);
      expect(hasil.gagal).toBe(15);
      const ditandai = await prisma.contact.count({
        where: { phone: { in: ids.map((id) => `ig:${id}`) }, igProfilPada: { not: null } },
      });
      expect(ditandai).toBe(0);
    });

    it("rute kontak & percakapan mengembalikan igUsername, dan pencarian @username menemukannya", async () => {
      const Fastify = (await import("fastify")).default;
      const { contactRoutes } = await import("../src/routes/contacts.js");
      const app = Fastify();
      app.decorate("authenticate", async () => {});
      app.decorate("requireWriter", async () => {});
      await app.register(contactRoutes);
      const igsid = igsidBaru();
      const uname = `cari_${Math.random().toString(36).slice(2, 8)}`;
      tiruan.profil = { username: uname };
      await kirim("instagram", igsid, "halo");

      const cari = encodeURIComponent(`@${uname}`);
      const daftar = await app.inject({ method: "GET", url: `/api/contacts?page=1&search=${cari}` });
      expect(daftar.json().items).toEqual([expect.objectContaining({ phone: `ig:${igsid}`, igUsername: uname })]);
      const ekspor = await app.inject({ method: "POST", url: "/api/contacts/export", payload: { search: uname } });
      expect(ekspor.json()).toEqual([expect.objectContaining({ igUsername: uname })]);
      const obrolan = await app.inject({ method: "GET", url: `/api/conversations?page=1&search=${cari}` });
      expect(obrolan.json().items).toEqual([expect.objectContaining({ phone: `ig:${igsid}`, igUsername: uname })]);
      await app.close();
    });
  });

  describe("pertanyaan khusus Instagram (nomor HP / e-wallet untuk imbalan)", () => {
    const IG = { saluran: "instagram" };
    // Nama → [IG] Nomor HP → Kota → [IG] Nomor e-wallet. Pertanyaan khusus IG di tengah DAN
    // di akhir: bagi responden WhatsApp survei harus selesai setelah "Kota".
    async function surveiImbalan(opsi: { mode: "chat" | "flow"; igDiAwal?: boolean }) {
      const kata = `uji imbalan ${Math.random().toString(36).slice(2, 7)}`;
      const daftar = [
        ...(opsi.igDiAwal ? [{ text: "Bersedia dihubungi untuk imbalan?", type: "boolean", options: IG }] : []),
        { text: "Nama Anda?", type: "text" },
        { text: "Nomor HP Anda?", type: "phone", options: IG },
        { text: "Kota Anda?", type: "text" },
        { text: "Nomor e-wallet (GoPay/DANA/OVO)?", type: "phone", options: IG },
      ];
      const s = await prisma.survey.create({
        data: {
          title: `uji-imbalan-${idUnik()}`,
          status: "active",
          mode: opsi.mode,
          flowId: opsi.mode === "flow" ? "123" : null,
          triggerEnabled: true,
          triggerKeywords: [kata],
          closingMessage: "Penutup imbalan",
          questions: {
            create: daftar.map((x, order) => ({ order, required: true, ...x })),
          },
        },
        include: { questions: { orderBy: { order: "asc" } } },
      });
      surveiDibuat.push(s.id);
      return { s, kata };
    }
    const jawaban = async (surveyId: string) => {
      const r = await prisma.surveyResponse.findFirstOrThrow({
        where: { surveyId },
        include: { answers: { include: { question: { select: { text: true } } } } },
      });
      return { r, isi: Object.fromEntries(r.answers.map((a) => [a.question.text, a.value])) };
    };

    it("responden Instagram ditanya nomor HP & e-wallet; jawabannya tersimpan ternormalisasi", async () => {
      const { s, kata } = await surveiImbalan({ mode: "flow" });
      const igsid = igsidBaru();
      await kirim("instagram", igsid, kata);
      expect(terkirim.at(-1)!.text).toContain("Nama Anda?");
      await kirim("instagram", igsid, "Siti");
      expect(terkirim.at(-1)!.text).toContain("Nomor HP Anda?");
      expect(terkirim.at(-1)!.text).toContain("Tulis nomor HP Anda");
      // Nomor yang tidak sah ditolak dan pertanyaannya diulang, survei tidak maju.
      await kirim("instagram", igsid, "0812");
      expect(terkirim.at(-1)!.text).toContain("Mohon tulis nomor HP yang valid");
      expect(terkirim.at(-1)!.text).toContain("Nomor HP Anda?");
      await kirim("instagram", igsid, "0812 3456 7890");
      expect(terkirim.at(-1)!.text).toContain("Kota Anda?");
      await kirim("instagram", igsid, "Bandung");
      expect(terkirim.at(-1)!.text).toContain("Nomor e-wallet");
      await kirim("instagram", igsid, "+62 857-1111-2222");
      expect(terkirim.at(-1)!.text).toContain("Penutup imbalan");

      const { r, isi } = await jawaban(s.id);
      expect(r).toMatchObject({ saluran: "instagram", metode: "chatbot", ditolakKuotaPada: null });
      expect(r.completedAt).not.toBeNull();
      expect(isi).toEqual({
        "Nama Anda?": "Siti",
        "Nomor HP Anda?": "6281234567890",
        "Kota Anda?": "Bandung",
        "Nomor e-wallet (GoPay/DANA/OVO)?": "6285711112222",
      });
    });

    it("responden WhatsApp chatbot tidak ditanya pertanyaan khusus IG dan surveinya selesai normal", async () => {
      const { s, kata } = await surveiImbalan({ mode: "chat" });
      const nomor = nomorBaru();
      await kirim("meta", nomor, kata);
      expect(terkirim.at(-1)!.text).toContain("Nama Anda?");
      await kirim("meta", nomor, "Budi");
      // Langsung ke Kota — "Nomor HP Anda?" dilewati.
      expect(terkirim.at(-1)!.text).toContain("Kota Anda?");
      await kirim("meta", nomor, "Solo");
      // Pertanyaan terakhir khusus IG → selesai di sini, dengan kata penutup.
      expect(terkirim.at(-1)!.text).toBe("Penutup imbalan");
      expect(terkirim.some((t) => t.text?.includes("Nomor"))).toBe(false);

      const { r, isi } = await jawaban(s.id);
      expect(r).toMatchObject({ saluran: "whatsapp", metode: "chatbot", currentStep: s.questions.length });
      expect(r.completedAt).not.toBeNull();
      expect(r.ditolakKuotaPada).toBeNull();
      expect(isi).toEqual({ "Nama Anda?": "Budi", "Kota Anda?": "Solo" });
    });

    it("pertanyaan PERTAMA khusus IG: responden WhatsApp dibuka dengan pertanyaan berlaku pertama", async () => {
      const { s, kata } = await surveiImbalan({ mode: "chat", igDiAwal: true });
      const nomor = nomorBaru();
      await kirim("meta", nomor, kata);
      expect(terkirim.at(-1)!.text).toContain("Nama Anda?");
      expect(terkirim.at(-1)!.text).not.toContain("Bersedia dihubungi");
      const r0 = await prisma.surveyResponse.findFirstOrThrow({ where: { surveyId: s.id } });
      expect(r0.currentStep).toBe(1);
      await kirim("meta", nomor, "Ani");
      await kirim("meta", nomor, "Medan");
      const { r, isi } = await jawaban(s.id);
      expect(r.completedAt).not.toBeNull();
      expect(isi).toEqual({ "Nama Anda?": "Ani", "Kota Anda?": "Medan" });

      // Responden Instagram tetap dibuka dengan pertanyaan khusus IG itu.
      const igsid = igsidBaru();
      await kirim("instagram", igsid, kata);
      expect(terkirim.at(-1)!.text).toContain("Bersedia dihubungi");
    });

    it("survei Form WhatsApp: formulir tanpa pertanyaan khusus IG, balasannya diterima utuh", async () => {
      const { s, kata } = await surveiImbalan({ mode: "flow" });
      const { buildSurveyFlow, fieldName } = await import("../src/lib/flowJson.js");
      const flow = JSON.stringify(buildSurveyFlow({ title: s.title, questions: s.questions as any }));
      const [nama, hp, kota, ewallet] = s.questions;
      expect(flow).toContain(fieldName(nama!.id));
      expect(flow).toContain(fieldName(kota!.id));
      expect(flow).not.toContain(fieldName(hp!.id));
      expect(flow).not.toContain(fieldName(ewallet!.id));

      const nomor = nomorBaru();
      await kirim("meta", nomor, kata);
      const formulir = terkirim.at(-1)!;
      expect(formulir.flow).toMatch(/^resp_/);
      await engine.handleInboundEvents([
        {
          vendor: "meta",
          kind: "message",
          from: nomor,
          interactiveType: "nfm_reply",
          flowResponse: { flow_token: formulir.flow, [fieldName(nama!.id)]: "Dewi", [fieldName(kota!.id)]: "Bogor" },
          messageId: idUnik(),
          timestamp: new Date().toISOString(),
          raw: {},
        },
      ]);
      const { r, isi } = await jawaban(s.id);
      expect(r).toMatchObject({ saluran: "whatsapp", metode: "form", ditolakKuotaPada: null });
      expect(r.completedAt).not.toBeNull();
      expect(isi).toEqual({ "Nama Anda?": "Dewi", "Kota Anda?": "Bogor" });
      expect(terkirim.at(-1)!.text).toBe("Penutup imbalan");
    });
  });
});
