import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Uji penutupan respons terhadap PostgreSQL SUNGGUHAN — kunci advisory, transaksi, dan
// pengisian bersamaan tidak bisa dibuktikan dengan tiruan.
//
// Dilewati kecuali KUOTA_DB_URL diisi, karena butuh basis data yang boleh ditulisi:
//   KUOTA_DB_URL=postgresql://populi:populi@localhost:5433/populi_uji npx vitest run kuotaTerkunci
// Pakai basis data TERSENDIRI yang sudah di-`prisma migrate deploy` — uji ini membuat dan
// menghapus survei, kontak, dan respons.
const URL_UJI = process.env.KUOTA_DB_URL;

type Modul = {
  prisma: typeof import("../src/db.js").prisma;
  tutupRespons: typeof import("../src/services/kuotaSurvei.js").tutupRespons;
  pulihkanRespons: typeof import("../src/services/kuotaSurvei.js").pulihkanRespons;
  angkaKuota: typeof import("../src/services/kuotaSurvei.js").angkaKuota;
};

describe.skipIf(!URL_UJI)("tutupRespons — pengisian bersamaan pada Postgres sungguhan", () => {
  let m: Modul;
  const surveiDibuat: string[] = [];
  const kontakDibuat: string[] = [];

  beforeAll(async () => {
    // Diimpor SETELAH DATABASE_URL diganti: klien Prisma membaca alamatnya saat dimuat.
    process.env.DATABASE_URL = URL_UJI;
    const db = await import("../src/db.js");
    const k = await import("../src/services/kuotaSurvei.js");
    m = {
      prisma: db.prisma,
      tutupRespons: k.tutupRespons,
      pulihkanRespons: k.pulihkanRespons,
      angkaKuota: k.angkaKuota,
    };
  });

  afterAll(async () => {
    if (!m) return;
    await m.prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await m.prisma.contact.deleteMany({ where: { id: { in: kontakDibuat } } });
    await m.prisma.$disconnect();
  });

  // Satu survei dengan N respons yang sedang berjalan, masing-masing dari kontak berbeda.
  async function siapkan(opsi: { n: number; targetGlobal?: number; provinsi?: { kode: string; target: number } }) {
    const s = await m.prisma.survey.create({
      data: {
        title: `uji-kuota-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetResponden: opsi.targetGlobal ?? null,
        ...(opsi.provinsi
          ? { kuotaProvinsi: { create: { kodeProvinsi: opsi.provinsi.kode, target: opsi.provinsi.target } } }
          : {}),
      },
    });
    surveiDibuat.push(s.id);
    const ids: string[] = [];
    for (let i = 0; i < opsi.n; i++) {
      const c = await m.prisma.contact.create({
        data: {
          phone: `62899${Date.now().toString().slice(-6)}${String(i).padStart(3, "0")}${Math.floor(Math.random() * 1000)}`,
        },
      });
      kontakDibuat.push(c.id);
      const r = await m.prisma.surveyResponse.create({
        data: { surveyId: s.id, contactId: c.id, kodeProvinsi: opsi.provinsi?.kode ?? null },
      });
      ids.push(r.id);
    }
    return { surveyId: s.id, ids };
  }

  it("kuota provinsi 2, sepuluh responden selesai BERSAMAAN → tepat dua diterima", async () => {
    const { surveyId, ids } = await siapkan({ n: 10, provinsi: { kode: "32", target: 2 } });

    const hasil = await Promise.all(ids.map((id) => m.tutupRespons(id, { currentStep: 5 })));

    expect(hasil.filter((h) => h.diterima)).toHaveLength(2);
    const ditolak = await m.prisma.surveyResponse.findMany({
      where: { surveyId, ditolakKuotaPada: { not: null } },
      select: { alasanDitolakKuota: true, completedAt: true, currentStep: true },
    });
    expect(ditolak).toHaveLength(8);
    // Yang ditolak tetap "selesai" — kalau tidak, kontaknya terkunci di sesi yang takkan diterima.
    for (const r of ditolak) {
      expect(r.alasanDitolakKuota).toBe("provinsi");
      expect(r.completedAt).not.toBeNull();
      expect(r.currentStep).toBe(5);
    }
    expect((await m.angkaKuota(surveyId, "32")).terisiProvinsi).toBe(2);
  });

  it("kuota global 3 tanpa provinsi, dua belas bersamaan → tepat tiga diterima", async () => {
    const { surveyId, ids } = await siapkan({ n: 12, targetGlobal: 3 });

    const hasil = await Promise.all(ids.map((id) => m.tutupRespons(id)));

    expect(hasil.filter((h) => h.diterima)).toHaveLength(3);
    const alasan = await m.prisma.surveyResponse.groupBy({
      by: ["alasanDitolakKuota"],
      where: { surveyId, ditolakKuotaPada: { not: null } },
      _count: { _all: true },
    });
    expect(alasan).toEqual([{ alasanDitolakKuota: "global", _count: { _all: 9 } }]);
  });

  it("jatah terakhir tetap diterima — respons yang diputuskan tidak menghitung dirinya sendiri", async () => {
    const { ids } = await siapkan({ n: 2, targetGlobal: 2 });
    expect(await m.tutupRespons(ids[0]!)).toEqual({ diterima: true });
    expect(await m.tutupRespons(ids[1]!)).toEqual({ diterima: true });
  });

  it("penolak consent tidak pernah ditandai ditolak kuota, walau kuotanya penuh", async () => {
    const { surveyId, ids } = await siapkan({ n: 2, targetGlobal: 1 });
    expect(await m.tutupRespons(ids[0]!)).toEqual({ diterima: true });

    expect(await m.tutupRespons(ids[1]!, { consentDitolak: true })).toEqual({ diterima: true });
    const r = await m.prisma.surveyResponse.findUnique({ where: { id: ids[1]! } });
    expect(r?.consentDitolak).toBe(true);
    expect(r?.ditolakKuotaPada).toBeNull();
    // Dan tetap tidak dihitung, jadi survei masih berisi satu.
    expect((await m.angkaKuota(surveyId, null)).terisiGlobal).toBe(1);
  });

  it("menutup ulang respons yang sama tidak mengubah keputusan pertama", async () => {
    const { ids } = await siapkan({ n: 2, targetGlobal: 1 });
    await m.tutupRespons(ids[0]!);
    expect(await m.tutupRespons(ids[1]!)).toEqual({ diterima: false });
    const sebelum = await m.prisma.surveyResponse.findUnique({ where: { id: ids[1]! } });

    // Webhook yang dikirim ulang Meta: dua kali, bersamaan.
    const ulang = await Promise.all([m.tutupRespons(ids[1]!), m.tutupRespons(ids[1]!)]);
    expect(ulang).toEqual([{ diterima: false }, { diterima: false }]);
    const sesudah = await m.prisma.surveyResponse.findUnique({ where: { id: ids[1]! } });
    expect(sesudah?.ditolakKuotaPada?.getTime()).toBe(sebelum?.ditolakKuotaPada?.getTime());
  });

  it("pemulihan tunduk pada kuota yang baru, dan berebut jatah dengan aman", async () => {
    const { surveyId, ids } = await siapkan({ n: 6, provinsi: { kode: "33", target: 1 } });
    for (const id of ids) await m.tutupRespons(id, { currentStep: 4 });
    expect((await m.angkaKuota(surveyId, "33")).terisiProvinsi).toBe(1);

    // Target dinaikkan ke 3: hanya dua jatah baru, padahal lima yang menunggu.
    await m.prisma.kuotaProvinsi.update({
      where: { surveyId_kodeProvinsi: { surveyId, kodeProvinsi: "33" } },
      data: { target: 3 },
    });
    const ditolak = ids.slice(1);
    const hasil = await Promise.all(ditolak.map((id) => m.pulihkanRespons(id)));

    expect(hasil.filter((h) => h === "dipulihkan")).toHaveLength(2);
    expect(hasil.filter((h) => h === "masih-penuh")).toHaveLength(3);
    expect((await m.angkaKuota(surveyId, "33")).terisiProvinsi).toBe(3);
    // Respons yang memang diterima sejak awal bukan tolakan.
    expect(await m.pulihkanRespons(ids[0]!)).toBe("bukan-tolakan");
  });

  it("survei berbeda tidak saling menunggu kunci", async () => {
    const a = await siapkan({ n: 3, targetGlobal: 1 });
    const b = await siapkan({ n: 3, targetGlobal: 1 });
    const hasil = await Promise.all([...a.ids, ...b.ids].map((id) => m.tutupRespons(id)));
    // Satu diterima PER survei — kuncinya per survei, bukan satu kunci global.
    expect(hasil.slice(0, 3).filter((h) => h.diterima)).toHaveLength(1);
    expect(hasil.slice(3).filter((h) => h.diterima)).toHaveLength(1);
  });

  it("pemulihan melewati respons milik orang yang sudah diterima lewat pengisian ulang", async () => {
    // Ditolak, lalu kuota dinaikkan, lalu orangnya mengisi ulang dan DITERIMA sebelum skrip
    // pemulihan dijalankan. Memulihkan yang lama membuatnya tercatat dua kali.
    const { surveyId, ids } = await siapkan({ n: 2, targetGlobal: 1 });
    await m.tutupRespons(ids[0]!);
    expect(await m.tutupRespons(ids[1]!)).toEqual({ diterima: false });
    const lama = await m.prisma.surveyResponse.findUnique({ where: { id: ids[1]! } });

    await m.prisma.survey.update({ where: { id: surveyId }, data: { targetResponden: 5 } });
    const ulang = await m.prisma.surveyResponse.create({ data: { surveyId, contactId: lama!.contactId } });
    expect(await m.tutupRespons(ulang.id)).toEqual({ diterima: true });

    expect(await m.pulihkanRespons(ids[1]!)).toBe("sudah-diterima");
    expect((await m.angkaKuota(surveyId, null)).terisiGlobal).toBe(2);
  });

  it("menolak di tengah tidak pernah membalik respons yang sudah diputuskan", async () => {
    // Dua pesan yang sama datang bersamaan: yang pertama sudah menutup dan MENERIMA
    // respons ini; yang kedua tidak boleh membaliknya jadi ditolak.
    const { ids } = await siapkan({ n: 1, targetGlobal: 1 });
    expect(await m.tutupRespons(ids[0]!)).toEqual({ diterima: true });
    const { tolakKarenaKuota } = await import("../src/services/kuotaSurvei.js");

    expect(await tolakKarenaKuota(ids[0]!, "global")).toBe(false);
    const r = await m.prisma.surveyResponse.findUnique({ where: { id: ids[0]! } });
    expect(r?.ditolakKuotaPada).toBeNull();
  });
});
