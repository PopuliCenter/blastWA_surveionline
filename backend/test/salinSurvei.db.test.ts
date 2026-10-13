import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Menggandakan survei terhadap PostgreSQL sungguhan.
// Dilewati kecuali KUOTA_DB_URL diisi (lihat kuotaTerkunci.db.test.ts).
const URL_UJI = process.env.KUOTA_DB_URL;

describe.skipIf(!URL_UJI)("gandakanSurvei — Postgres sungguhan", () => {
  let prisma: typeof import("../src/db.js").prisma;
  let gandakanSurvei: typeof import("../src/services/salinSurvei.js").gandakanSurvei;
  let galatSimpanSurvei: typeof import("../src/routes/surveys.js").galatSimpanSurvei;
  const dibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    gandakanSurvei = (await import("../src/services/salinSurvei.js")).gandakanSurvei;
    galatSimpanSurvei = (await import("../src/routes/surveys.js")).galatSimpanSurvei;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.survey.deleteMany({ where: { id: { in: dibuat } } });
    await prisma.$disconnect();
  });

  async function surveiAsli() {
    const s = await prisma.survey.create({
      data: {
        title: `Asli ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: "Deskripsi",
        status: "active",
        mode: "flow",
        flowId: "1234567890",
        flowCta: "Mulai",
        flowPerScreen: 3,
        triggerEnabled: true,
        triggerKeywords: ["isi survei"],
        oncePerContact: true,
        closingMessage: "Terima kasih.",
        pesanKuotaPenuh: "Kuota penuh.",
        targetResponden: 400,
        kuotaProvinsi: {
          create: [
            { kodeProvinsi: "32", target: 50 },
            { kodeProvinsi: "35", target: 40 },
          ],
        },
        questions: {
          create: [
            // Nomor urut sengaja bercelah: percabangan memakai INDEKS daftar terurut.
            { order: 0, text: "Tahu program?", type: "boolean", options: { branches: [{ value: "Tidak", goto: 2 }] } },
            { order: 5, text: "Nilai program?", type: "rating", options: { min: 1, max: 5 } },
            { order: 9, text: "Provinsi?", type: "choice", options: { choices: ["Jawa Barat", "Jawa Timur"] } },
          ],
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    await prisma.survey.update({ where: { id: s.id }, data: { questionProvinsiId: s.questions[2]!.id } });
    dibuat.push(s.id);
    const kontak = await prisma.contact.create({ data: { phone: `62855${Date.now() % 1e8}` } });
    await prisma.surveyResponse.create({ data: { surveyId: s.id, contactId: kontak.id, completedAt: new Date() } });
    return s;
  }

  it("menyalin instrumen dan pengaturannya, bukan datanya", async () => {
    const asli = await surveiAsli();
    const baru = await gandakanSurvei(asli.id);
    dibuat.push(baru!.id);

    expect(baru!.id).not.toBe(asli.id);
    expect(baru!.title).toBe(`${asli.title} (salinan)`);
    expect(baru!).toMatchObject({
      description: "Deskripsi",
      mode: "flow",
      flowCta: "Mulai",
      flowPerScreen: 3,
      oncePerContact: true,
      closingMessage: "Terima kasih.",
      pesanKuotaPenuh: "Kuota penuh.",
      targetResponden: 400,
    });
    expect(baru!.questions.map((q) => q.text)).toEqual(["Tahu program?", "Nilai program?", "Provinsi?"]);
    expect(baru!.questions.map((q) => q.order)).toEqual([0, 1, 2]);
    expect(baru!.questions[1]!.options).toEqual({ min: 1, max: 5 });

    const kuota = await prisma.kuotaProvinsi.findMany({
      where: { surveyId: baru!.id },
      orderBy: { kodeProvinsi: "asc" },
    });
    expect(kuota.map((k) => [k.kodeProvinsi, k.target])).toEqual([
      ["32", 50],
      ["35", 40],
    ]);
    expect(await prisma.surveyResponse.count({ where: { surveyId: baru!.id } })).toBe(0);
    // Survei aslinya tidak tersentuh.
    expect(await prisma.surveyResponse.count({ where: { surveyId: asli.id } })).toBe(1);
  });

  it("mengosongkan yang berbahaya bila ikut tersalin", async () => {
    const asli = await surveiAsli();
    const baru = await gandakanSurvei(asli.id);
    dibuat.push(baru!.id);
    // Draf — tidak langsung menerima responden.
    expect(baru!.status).toBe("draft");
    // Flow lama mengirim field q_<id pertanyaan LAMA>; salinan punya id baru.
    expect(baru!.flowId).toBeNull();
    // Kata pemicu kembar membuat dua survei aktif berebut pesan yang sama.
    expect(baru!.triggerEnabled).toBe(false);
    expect(baru!.triggerKeywords).toEqual([]);
  });

  it("percabangan tetap menunjuk pertanyaan yang sama, dan penunjuk provinsi dipetakan ke salinannya", async () => {
    const asli = await surveiAsli();
    const baru = await gandakanSurvei(asli.id);
    dibuat.push(baru!.id);

    const goto = (baru!.questions[0]!.options as { branches: { goto: number }[] }).branches[0]!.goto;
    expect(baru!.questions[goto]!.text).toBe("Provinsi?");
    // Menunjuk pertanyaan SALINAN, bukan pertanyaan milik survei asli.
    expect(baru!.questionProvinsiId).toBe(baru!.questions[2]!.id);
    expect(baru!.questionProvinsiId).not.toBe(asli.questions[2]!.id);
  });

  it("menggandakan dua kali menghasilkan judul yang berbeda", async () => {
    const asli = await surveiAsli();
    const a = await gandakanSurvei(asli.id);
    const b = await gandakanSurvei(asli.id);
    dibuat.push(a!.id, b!.id);
    expect(b!.title).toBe(`${asli.title} (salinan 2)`);
  });

  it("survei yang tidak ada → null", async () => {
    expect(await gandakanSurvei("tidak-ada")).toBeNull();
  });

  it("menolak judul yang akan berbagi tab Google Sheets dengan survei lain", async () => {
    const asli = await surveiAsli();
    const baru = await gandakanSurvei(asli.id);
    dibuat.push(baru!.id);
    // Salinan diganti namanya kembali menjadi judul aslinya.
    expect(await galatSimpanSurvei(baru!.id, asli.title, undefined)).toMatch(/sudah dipakai survei lain/);
    expect(await galatSimpanSurvei(null, asli.title.toUpperCase(), undefined)).toMatch(/sudah dipakai/);
    // Judul yang TIDAK berubah tidak diperiksa — survei lama berjudul kembar tetap bisa disunting.
    expect(await galatSimpanSurvei(baru!.id, baru!.title, undefined)).toBeNull();
  });

  it("menolak teks pertanyaan kembar", async () => {
    expect(await galatSimpanSurvei(null, undefined, [{ text: "Usia?" }, { text: "Usia?" }])).toMatch(/sama persis/);
    expect(await galatSimpanSurvei(null, undefined, [{ text: "Usia?" }, { text: "Usia? (salinan)" }])).toBeNull();
  });

  it("survei lama yang SUDAH punya teks kembar tetap bisa disimpan; yang diblokir hanya kembaran baru", async () => {
    // Tanpa pengecualian ini survei lama tidak bisa disunting sama sekali — termasuk
    // sekadar ditutup untuk menahan biaya.
    const s = await prisma.survey.create({
      data: {
        title: `Lama ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        questions: {
          create: [
            { order: 0, text: "Alasannya?", type: "text" },
            { order: 1, text: "Usia?", type: "number" },
            { order: 2, text: "Alasannya?", type: "text" },
          ],
        },
      },
    });
    dibuat.push(s.id);
    const sama = [{ text: "Alasannya?" }, { text: "Usia?" }, { text: "Alasannya?" }];
    expect(await galatSimpanSurvei(s.id, s.title, sama)).toBeNull();
    expect(await galatSimpanSurvei(s.id, s.title, [...sama, { text: "Usia?" }])).toMatch(/"Usia\?"/);
  });

  it("dua permintaan gandakan BERSAMAAN tetap menghasilkan dua judul berbeda", async () => {
    // Klik ganda: tanpa kunci keduanya melihat "(salinan)" masih kosong dan sama-sama
    // memakainya — dua survei berbagi satu tab Google Sheets.
    const asli = await surveiAsli();
    const [a, b] = await Promise.all([gandakanSurvei(asli.id), gandakanSurvei(asli.id)]);
    dibuat.push(a!.id, b!.id);
    expect(new Set([a!.title, b!.title]).size).toBe(2);
  });
});
