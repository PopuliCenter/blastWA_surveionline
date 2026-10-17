import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Alur lokasi dari ujung ke ujung: survei selesai → permintaan lokasi → lokasi dibagikan →
// tersimpan dibulatkan. Penyedia WhatsApp dan antrean Google Sheets ditiru, basis datanya
// PostgreSQL sungguhan.
//
// Dilewati kecuali KUOTA_DB_URL diisi (lihat kuotaTerkunci.db.test.ts).
const URL_UJI = process.env.KUOTA_DB_URL;

type Kirim = { to: string; text?: string; flow?: string; tombolLokasi?: boolean; id?: string };
const terkirim: Kirim[] = [];
let nomorPesan = 0;
const idUnik = () => `uji-${Date.now()}-${++nomorPesan}-${Math.random().toString(36).slice(2, 8)}`;
// Diatur per tes: vendor yang menolak pesan bertombol harus jatuh ke teks biasa, dsb.
const tiruan = {
  tolakTombol: false,
  tanpaTombol: false,
  tolakTeks: false,
  rawRusak: false,
  lemparTeks: false,
  rawTeksRusak: false,
};

vi.mock("../src/providers/registry.js", () => ({
  getProvider: () => ({
    async sendText({ to, text }: { to: string; text: string }) {
      if (tiruan.lemparTeks) throw new Error("ECONNRESET (uji)");
      if (tiruan.tolakTeks) return { status: "failed", vendorMessageId: "", raw: { error: "uji" } };
      terkirim.push({ to, text });
      return {
        status: "sent",
        vendorMessageId: idUnik(),
        raw: tiruan.rawTeksRusak ? { x: String.fromCharCode(0) } : {},
      };
    },
    async sendFlow({ to, flowToken }: { to: string; flowToken: string }) {
      terkirim.push({ to, flow: flowToken });
      return { status: "sent", vendorMessageId: idUnik(), raw: {} };
    },
    get sendLocationRequest() {
      if (tiruan.tanpaTombol) return undefined;
      return async ({ to, text }: { to: string; text: string }) => {
        if (tiruan.tolakTombol) return { status: "failed", vendorMessageId: "", raw: { error: "uji" } };
        const id = idUnik();
        terkirim.push({ to, text, tombolLokasi: true, id });
        // Karakter NUL ditolak kolom jsonb Postgres — meniru galat tulis DB SESUDAH pesan terkirim.
        return { status: "sent", vendorMessageId: id, raw: tiruan.rawRusak ? { x: String.fromCharCode(0) } : {} };
      };
    },
  }),
}));
vi.mock("../src/queue/sheetQueue.js", () => ({ enqueueSheetSync: async () => {} }));
vi.mock("../src/services/autoResponder.js", () => ({ findAutoResponse: async () => null }));

type Engine = typeof import("../src/services/surveyEngine.js");
type Db = typeof import("../src/db.js");
type Lokasi = typeof import("../src/lib/lokasi.js");

describe.skipIf(!URL_UJI)("alur lokasi responden", () => {
  let engine: Engine;
  let prisma: Db["prisma"];
  let L: Lokasi;
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];
  const blastDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    engine = await import("../src/services/surveyEngine.js");
    L = await import("../src/lib/lokasi.js");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.blast.deleteMany({ where: { id: { in: blastDibuat } } });
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    terkirim.length = 0;
    tiruan.tolakTombol = false;
    tiruan.tanpaTombol = false;
    tiruan.tolakTeks = false;
    tiruan.rawRusak = false;
    tiruan.lemparTeks = false;
    tiruan.rawTeksRusak = false;
  });

  const nomorBaru = () => {
    const n = `62878${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
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

  const kirimLokasi = (
    from: string,
    latitude: number,
    longitude: number,
    opsi: { contextId?: string; messageId?: string } = {},
  ) =>
    engine.handleInboundEvents([
      {
        vendor: "meta",
        kind: "message",
        from,
        location: { latitude, longitude },
        contextId: opsi.contextId,
        messageId: opsi.messageId ?? idUnik(),
        timestamp: new Date().toISOString(),
        raw: { from, type: "location", location: { latitude, longitude, name: "Rumah", address: "Jl. Rahasia 1" } },
      },
    ]);

  const ke = (to: string) => terkirim.filter((t) => t.to === to);

  async function surveiChat(
    opsi: {
      mintaLokasi?: boolean;
      pesanMintaLokasi?: string;
      closingMessage?: string;
      lokasiPesanTerpisah?: boolean;
      balasanLokasi?: string;
    } = {},
  ) {
    const kata = `uji lokasi ${Math.random().toString(36).slice(2, 7)}`;
    const s = await prisma.survey.create({
      data: {
        title: `uji-lokasi-${idUnik()}`,
        status: "active",
        mode: "chat",
        triggerEnabled: true,
        triggerKeywords: [kata],
        mintaLokasi: opsi.mintaLokasi ?? true,
        pesanMintaLokasi: opsi.pesanMintaLokasi ?? null,
        closingMessage: opsi.closingMessage ?? null,
        lokasiPesanTerpisah: opsi.lokasiPesanTerpisah ?? false,
        balasanLokasi: opsi.balasanLokasi ?? null,
        questions: {
          create: [
            {
              order: 0,
              text: "Bersedia ikut?",
              type: "consent",
              required: true,
              options: { branches: [{ value: "Tidak", goto: "end" }] },
            },
            { order: 1, text: "Provinsi tempat tinggal?", type: "wilayah", required: true },
          ],
        },
      },
    });
    surveiDibuat.push(s.id);
    return { surveyId: s.id, kata };
  }

  const respons = (surveyId: string, phone: string) =>
    prisma.surveyResponse.findFirstOrThrow({ where: { surveyId, contact: { phone } } });

  it("selesai → penutup + permintaan lokasi dalam SATU pesan bertombol, lalu lokasi tersimpan dibulatkan", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya"); // setuju
    await kirim(hp, "Jawa Barat");

    const akhir = ke(hp).at(-1)!;
    expect(akhir.tombolLokasi).toBe(true);
    expect(akhir.text).toContain("Terima kasih");
    expect(akhir.text).toContain(L.PESAN_MINTA_LOKASI_BAWAAN);
    expect((await respons(surveyId, hp)).lokasiDimintaPada).not.toBeNull();

    terkirim.length = 0;
    await kirimLokasi(hp, -6.914744, 107.60981);
    const r = await respons(surveyId, hp);
    expect(r.lokasiDiterimaPada).not.toBeNull();
    expect([r.lokasiLat, r.lokasiLng]).toEqual([-6.91, 107.61]);
    expect(ke(hp).map((t) => t.text)).toEqual([L.TERIMA_KASIH_LOKASI]);

    // Riwayat pesan: teks penanda, titik dibulatkan, nama tempat & alamat dibuang.
    const masuk = await prisma.message.findFirstOrThrow({
      where: { contact: { phone: hp }, direction: "in" },
      orderBy: { createdAt: "desc" },
    });
    expect(masuk.text).toBe("[lokasi]");
    expect(masuk.payload).toEqual({ from: hp, type: "location", location: { latitude: -6.91, longitude: 107.61 } });
  });

  it("lokasi kedua tidak menimpa yang pertama dan tidak dibalas lagi", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Banten");
    await kirimLokasi(hp, -6.12, 106.15);
    terkirim.length = 0;
    await kirimLokasi(hp, -7.8, 110.36);
    const r = await respons(surveyId, hp);
    expect([r.lokasiLat, r.lokasiLng]).toEqual([-6.12, 106.15]);
    expect(ke(hp)).toHaveLength(0);
  });

  it("penolak persetujuan TIDAK dimintai lokasi", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "tidak"); // tidak setuju → survei berakhir
    const r = await respons(surveyId, hp);
    expect(r.completedAt).not.toBeNull();
    expect(r.lokasiDimintaPada).toBeNull();
    expect(ke(hp).some((t) => t.tombolLokasi)).toBe(false);
  });

  it("survei tanpa permintaan lokasi: penutup biasa", async () => {
    const { surveyId, kata } = await surveiChat({ mintaLokasi: false });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    expect(ke(hp).at(-1)!.tombolLokasi).toBeUndefined();
    expect(ke(hp).at(-1)!.text).not.toContain(L.PESAN_MINTA_LOKASI_BAWAAN);
    expect((await respons(surveyId, hp)).lokasiDimintaPada).toBeNull();
  });

  it("vendor menolak pesan bertombol → teks biasa berisi petunjuk lampiran", async () => {
    tiruan.tolakTombol = true;
    const { kata } = await surveiChat({ pesanMintaLokasi: "Boleh bagikan lokasi?" });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    const akhir = ke(hp).at(-1)!;
    expect(akhir.tombolLokasi).toBeUndefined();
    expect(akhir.text).toContain("Boleh bagikan lokasi?");
    expect(akhir.text).toContain(L.PETUNJUK_LOKASI_TANPA_TOMBOL);
  });

  it("penutup yang panjang dikirim sendiri — kalimat permintaan lokasi tidak terpotong", async () => {
    const panjang = "Terima kasih banyak. ".repeat(60); // > 1024 karakter
    const { kata } = await surveiChat({ closingMessage: panjang });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    const [penutup, minta] = ke(hp).slice(-2);
    expect(penutup!.text).toBe(panjang.trim());
    expect(minta!.tombolLokasi).toBe(true);
    expect(minta!.text).toBe(L.PESAN_MINTA_LOKASI_BAWAAN);
  });

  it("lokasi dari penerima blast TIDAK memulai survei (bug lama)", async () => {
    const { surveyId } = await surveiChat();
    const hp = nomorBaru();
    const kontak = await prisma.contact.create({ data: { phone: hp } });
    const b = await prisma.blast.create({
      data: { vendor: "meta", surveyId, recipients: { create: { contactId: kontak.id, vendor: "meta" } } },
    });
    blastDibuat.push(b.id);

    await kirimLokasi(hp, -6.9, 107.6);
    expect(ke(hp)).toHaveLength(0);
    expect(await prisma.surveyResponse.count({ where: { surveyId, contactId: kontak.id } })).toBe(0);

    // Pembanding: balasan teks biasa memang memulai survei dari blast.
    await kirim(hp, "oke");
    expect(await prisma.surveyResponse.count({ where: { surveyId, contactId: kontak.id } })).toBe(1);
  });

  it("lokasi di tengah survei chat dibalas seperti jawaban bukan-teks, survei tidak rusak", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    terkirim.length = 0;
    await kirimLokasi(hp, -6.9, 107.6);
    const r = await respons(surveyId, hp);
    expect(r.completedAt).toBeNull();
    expect(r.lokasiDiterimaPada).toBeNull();
    // Jawabannya belum tercatat; pertanyaan wilayah masih ditunggu.
    expect(await prisma.answer.count({ where: { responseId: r.id } })).toBe(1);
    expect(ke(hp).length).toBeGreaterThan(0);
  });

  it("permintaan yang sudah lewat 24 jam tidak lagi menerima lokasi", async () => {
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    const r0 = await respons(surveyId, hp);
    await prisma.surveyResponse.update({
      where: { id: r0.id },
      data: { lokasiDimintaPada: new Date(Date.now() - L.BERLAKU_PERMINTAAN_MS - 60_000) },
    });
    terkirim.length = 0;
    await kirimLokasi(hp, -6.9, 107.6);
    expect((await respons(surveyId, hp)).lokasiDiterimaPada).toBeNull();
    expect(ke(hp)).toHaveLength(0);
  });

  // ===== Temuan review =====

  const selesaikan = async (hp: string, kata: string, provinsi = "Jawa Barat") => {
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, provinsi);
  };

  it("vendor tanpa tombol 'Kirim lokasi' (Baileys, Qontak): tidak dimintai lokasi sama sekali", async () => {
    tiruan.tanpaTombol = true;
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await selesaikan(hp, kata);
    const akhir = ke(hp).at(-1)!;
    expect(akhir.tombolLokasi).toBeUndefined();
    expect(akhir.text).not.toContain(L.PESAN_MINTA_LOKASI_BAWAAN);
    expect((await respons(surveyId, hp)).lokasiDimintaPada).toBeNull();
  });

  it("dua permintaan: lokasi masuk ke yang TERAKHIR, dan lokasi berikutnya tidak pindah ke yang lama", async () => {
    const A = await surveiChat();
    const B = await surveiChat();
    const hp = nomorBaru();
    await selesaikan(hp, A.kata);
    await selesaikan(hp, B.kata);

    const idPesan = idUnik();
    await kirimLokasi(hp, -6.91, 107.61, { messageId: idPesan });
    expect((await respons(B.surveyId, hp)).lokasiDiterimaPada).not.toBeNull();
    expect((await respons(A.surveyId, hp)).lokasiDiterimaPada).toBeNull();

    terkirim.length = 0;
    // Webhook yang sama dikirim Meta dua kali, lalu responden membagikan lokasi lagi.
    await kirimLokasi(hp, -6.91, 107.61, { messageId: idPesan });
    await kirimLokasi(hp, -7.8, 110.36);
    expect((await respons(A.surveyId, hp)).lokasiDiterimaPada).toBeNull();
    expect(ke(hp)).toHaveLength(0);
  });

  it("lokasi lewat tombol di pesan permintaan lama (context.id) masuk ke respons itu", async () => {
    const A = await surveiChat();
    const B = await surveiChat();
    const hp = nomorBaru();
    await selesaikan(hp, A.kata);
    const idMintaA = ke(hp).at(-1)!.id!;
    await selesaikan(hp, B.kata);

    await kirimLokasi(hp, -6.91, 107.61, { contextId: idMintaA });
    expect((await respons(A.surveyId, hp)).lokasiDiterimaPada).not.toBeNull();
    expect((await respons(B.surveyId, hp)).lokasiDiterimaPada).toBeNull();
  });

  it("semua pengiriman gagal → catatan permintaan dibatalkan, bukan 'tidak dibagikan'", async () => {
    tiruan.tolakTombol = true;
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    tiruan.tolakTeks = true;
    await kirim(hp, "Jawa Barat");
    const r = await respons(surveyId, hp);
    expect(r.completedAt).not.toBeNull();
    expect(r.lokasiDimintaPada).toBeNull();

    // Lokasi yang ia kirim kemudian bukan jawaban atas permintaan yang tak pernah sampai.
    tiruan.tolakTeks = false;
    await kirimLokasi(hp, -6.9, 107.6);
    expect((await respons(surveyId, hp)).lokasiDiterimaPada).toBeNull();
  });

  it("galat DB sesudah pesan bertombol terkirim tidak memicu teks cadangan (penutup tidak dobel)", async () => {
    const { kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    tiruan.rawRusak = true;
    await kirim(hp, "Jawa Barat").catch(() => {});
    const penutup = ke(hp).filter((t) => t.text?.includes(L.PESAN_MINTA_LOKASI_BAWAAN));
    expect(penutup).toHaveLength(1);
    expect(penutup[0]!.tombolLokasi).toBe(true);
  });

  it("penutup panjang yang gagal terkirim → permintaan tak pernah sampai, catatannya dibatalkan", async () => {
    const { surveyId, kata } = await surveiChat({ closingMessage: "Terima kasih banyak. ".repeat(60) });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    tiruan.lemparTeks = true;
    await kirim(hp, "Jawa Barat").catch(() => {});
    const r = await respons(surveyId, hp);
    expect(r.completedAt).not.toBeNull();
    expect(r.lokasiDimintaPada).toBeNull();
    expect(ke(hp).some((t) => t.tombolLokasi)).toBe(false);
  });

  it("teks cadangan SUDAH terkirim lalu tulis DB gagal → catatan permintaan tetap ada", async () => {
    tiruan.tolakTombol = true;
    const { surveyId, kata } = await surveiChat();
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    tiruan.rawTeksRusak = true;
    await kirim(hp, "Jawa Barat").catch(() => {});
    tiruan.rawTeksRusak = false;
    const terkirimCadangan = ke(hp).filter((t) => t.text?.includes(L.PETUNJUK_LOKASI_TANPA_TOMBOL));
    expect(terkirimCadangan).toHaveLength(1);
    expect((await respons(surveyId, hp)).lokasiDimintaPada).not.toBeNull();

    // Responden mengikuti petunjuk lampiran: lokasinya diterima.
    await kirimLokasi(hp, -6.9, 107.6);
    expect((await respons(surveyId, hp)).lokasiDiterimaPada).not.toBeNull();
  });

  // ===== Opsi pesan lokasi per survei =====

  it("pesan terpisah: penutup dulu (teks biasa), lalu permintaan lokasi sendiri dengan tombol", async () => {
    const { surveyId, kata } = await surveiChat({
      lokasiPesanTerpisah: true,
      pesanMintaLokasi: "Boleh bagikan lokasi?",
    });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    const [penutup, minta] = ke(hp).slice(-2);
    expect(penutup!.tombolLokasi).toBeUndefined();
    expect(penutup!.text).toContain("Terima kasih");
    expect(penutup!.text).not.toContain("Boleh bagikan lokasi?");
    expect(minta!.tombolLokasi).toBe(true);
    expect(minta!.text).toBe("Boleh bagikan lokasi?");
    // Lokasi lewat tombol pesan itu tetap tercocokkan.
    await kirimLokasi(hp, -6.91, 107.61, { contextId: minta!.id });
    expect((await respons(surveyId, hp)).lokasiDiterimaPada).not.toBeNull();
  });

  it("balasan setelah lokasi diterima memakai teks survei bila diisi", async () => {
    const { kata } = await surveiChat({ balasanLokasi: "  Makasih, lokasi sudah masuk!  " });
    const hp = nomorBaru();
    await kirim(hp, kata);
    await kirim(hp, "ya");
    await kirim(hp, "Jawa Barat");
    terkirim.length = 0;
    await kirimLokasi(hp, -6.91, 107.61);
    expect(ke(hp).map((t) => t.text)).toEqual(["Makasih, lokasi sudah masuk!"]);
  });
});
