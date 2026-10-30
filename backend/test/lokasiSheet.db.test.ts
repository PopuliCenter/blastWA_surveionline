import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Kolom lokasi di Google Sheets diperbarui SETELAH barisnya terkirim (job "lokasi"):
// barisnya dicari lewat Nomor + Mulai, dan hanya dua sel lokasinya yang ditulis — di kolom
// menurut judul SEGAR, tidak pernah menurut cache judul.
//
// Google Sheets ditiru sebagai satu tab di memori; basis datanya PostgreSQL sungguhan.
// Dilewati kecuali KUOTA_DB_URL diisi (lihat kuotaTerkunci.db.test.ts).
const URL_UJI = process.env.KUOTA_DB_URL;

const tab = {
  ada: true,
  header: [] as string[],
  baris: [] as string[][],
  tulis: [] as { a1: string; nilai: string | number }[],
  bacaLebar: [] as string[],
};
vi.mock("../src/services/sheetPush.js", async (asli) => {
  const a = await asli<typeof import("../src/services/sheetPush.js")>();
  return {
    ...a,
    // Job ini tidak boleh membuat tab maupun memakai cache judul.
    ensureTab: async () => {
      throw new Error("ensureTab tidak boleh dipanggil job lokasi");
    },
    readRanges: async () => {
      if (!tab.ada) throw new Error("Sheets API 400 GET /uji/values:batchGet: Unable to parse range: 'x'!1:1");
      return [[tab.header], tab.baris.map((b) => b.slice(0, 5))];
    },
    readRange: async (_sa: unknown, _id: string, _tab: string, a1: string) => {
      tab.bacaLebar.push(a1);
      return tab.baris;
    },
    writeCells: async (_sa: unknown, _id: string, _tab: string, sel: { a1: string; nilai: string | number }[]) => {
      tab.tulis.push(...sel);
    },
  };
});
vi.mock("../src/lib/crypto.js", async (asli) => ({
  ...(await asli<typeof import("../src/lib/crypto.js")>()),
  decryptJson: () => "{}",
}));
vi.mock("../src/lib/googleAuth.js", async (asli) => ({
  ...(await asli<typeof import("../src/lib/googleAuth.js")>()),
  parseServiceAccount: () => ({}),
}));

type Db = typeof import("../src/db.js");
type Layanan = typeof import("../src/services/lokasiSheet.js");
type Baris = typeof import("../src/lib/sheetRows.js");

describe.skipIf(!URL_UJI)("perbaruiLokasiDiSheet", () => {
  let prisma: Db["prisma"];
  let L: Layanan;
  let S: Baris;
  let kolomA1: (i: number) => string;
  let konfigAsli: Awaited<ReturnType<Db["prisma"]["sheetConfig"]["findUnique"]>> = null;
  const surveiDibuat: string[] = [];
  const nomorDibuat: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_UJI;
    prisma = (await import("../src/db.js")).prisma;
    L = await import("../src/services/lokasiSheet.js");
    S = await import("../src/lib/sheetRows.js");
    kolomA1 = (await import("../src/services/sheetPush.js")).kolomA1;
    konfigAsli = await prisma.sheetConfig.findUnique({ where: { id: "default" } });
    await prisma.sheetConfig.upsert({
      where: { id: "default" },
      create: { id: "default", enabled: true, spreadsheetId: "uji", serviceAccountJson: "x" },
      update: { enabled: true, spreadsheetId: "uji", serviceAccountJson: "x" },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.survey.deleteMany({ where: { id: { in: surveiDibuat } } });
    await prisma.contact.deleteMany({ where: { phone: { in: nomorDibuat } } });
    if (konfigAsli) {
      const { id: _id, updatedAt: _u, ...isi } = konfigAsli;
      await prisma.sheetConfig.update({ where: { id: "default" }, data: isi });
    } else await prisma.sheetConfig.deleteMany({ where: { id: "default" } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    tab.ada = true;
    tab.header = [];
    tab.baris = [];
    tab.tulis = [];
    tab.bacaLebar = [];
  });

  const MULAI = new Date("2026-10-01T03:00:00Z");

  async function respons(opsi: { tersinkron?: boolean; lokasi?: boolean } = {}) {
    const phone = `62877${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
    nomorDibuat.push(phone);
    const s = await prisma.survey.create({
      data: {
        title: `uji-lokasi-sheet-${Math.random().toString(36).slice(2, 8)}`,
        status: "active",
        mintaLokasi: true,
        questions: { create: [{ order: 0, text: "Provinsi tinggal?", type: "wilayah", required: true }] },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    surveiDibuat.push(s.id);
    const kontak = await prisma.contact.create({ data: { phone } });
    const r = await prisma.surveyResponse.create({
      data: {
        surveyId: s.id,
        contactId: kontak.id,
        startedAt: MULAI,
        completedAt: new Date(MULAI.getTime() + 5 * 60000),
        currentStep: 1,
        kodeProvinsi: "32",
        sheetSyncedAt: opsi.tersinkron === false ? null : new Date(),
        lokasiDimintaPada: MULAI,
        ...(opsi.lokasi === false
          ? {}
          : { lokasiDiterimaPada: new Date(), lokasiLat: -6.2, lokasiLng: 106.85, kodeProvinsiLokasi: "31" }),
      },
    });
    return { s, r, phone, mulai: S.fmtJakarta(MULAI) };
  }

  it("menulis dua sel lokasi pada baris yang cocok (Nomor + Mulai)", async () => {
    const { s, r, phone, mulai } = await respons();
    tab.header = S.sheetHeader(s.questions, { lokasi: true });
    tab.baris = [
      ["6280000000001", "", "", mulai],
      [phone, "", "", "2026-09-30 10:00"],
      [phone, "", "", mulai],
    ];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("ok");
    const iProv = tab.header.length - 2;
    expect(tab.tulis).toEqual([
      { a1: `${kolomA1(iProv)}4`, nilai: "DKI Jakarta" }, // baris data ke-3 = baris 4
      { a1: `${kolomA1(iProv + 1)}4`, nilai: "Beda provinsi" },
    ]);
  });

  it("kolom yang disisipkan tim: letak kolom lokasi diambil dari judul TERKINI", async () => {
    const { s, r, phone, mulai } = await respons();
    const asli = S.sheetHeader(s.questions, { lokasi: true });
    tab.header = [...asli.slice(0, 5), "Catatan QC", ...asli.slice(5)];
    tab.baris = [[phone, "", "", mulai]];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("ok");
    expect(tab.tulis.map((t) => t.a1)).toEqual([
      `${kolomA1(tab.header.indexOf("Provinsi Lokasi"))}2`,
      `${kolomA1(tab.header.indexOf("Status Lokasi"))}2`,
    ]);
  });

  it("Nomor/Mulai di luar kolom A–E: kolom kuncinya dibaca lebih lebar", async () => {
    const { s, r, phone, mulai } = await respons();
    const asli = S.sheetHeader(s.questions, { lokasi: true });
    tab.header = ["Catatan 1", "Catatan 2", "Catatan 3", ...asli];
    tab.baris = [["", "", "", phone, "", "", mulai]];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("ok");
    expect(tab.bacaLebar).toEqual([`A2:${kolomA1(tab.header.indexOf("Mulai"))}`]);
    expect(tab.tulis).toHaveLength(2);
  });

  it("diminta tapi belum dibagikan → status 'Tidak dibagikan'", async () => {
    const { s, r, phone, mulai } = await respons({ lokasi: false });
    tab.header = S.sheetHeader(s.questions, { lokasi: true });
    tab.baris = [[phone, "", "", mulai]];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("ok");
    expect(tab.tulis.map((t) => t.nilai)).toEqual(["", "Tidak dibagikan"]);
  });

  it("yang tidak pasti dilewati, tidak ditebak — dan tab tidak pernah dibuat", async () => {
    // Baris belum terkirim: job sinkron nanti menulis keadaan terkini sendiri.
    const belum = await respons({ tersinkron: false });
    expect(await L.perbaruiLokasiDiSheet(belum.r.id)).toBe("skip-belum-ada-baris");

    const { s, r, phone, mulai } = await respons();
    // Tab lama tanpa judul lokasi: diisi skrip lengkapi:sheets, bukan ditebak di sini.
    tab.header = S.sheetHeader(s.questions);
    tab.baris = [[phone, "", "", mulai]];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("skip-tanpa-kolom");

    tab.header = S.sheetHeader(s.questions, { lokasi: true });
    tab.baris = [["6280000000001", "", "", mulai]];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("skip-baris-tak-ditemukan");
    tab.baris = [
      [phone, "", "", mulai],
      [phone, "", "", mulai],
    ];
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("skip-baris-ganda");

    // Tab sudah dihapus/diganti nama (atau judul survei diganti): tidak dibuatkan yang baru.
    tab.ada = false;
    expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("skip-tab-tidak-ada");
    expect(tab.tulis).toEqual([]);
  });

  it("integrasi Sheets nonaktif → tidak menyentuh apa pun", async () => {
    const { r } = await respons();
    await prisma.sheetConfig.update({ where: { id: "default" }, data: { enabled: false } });
    try {
      expect(await L.perbaruiLokasiDiSheet(r.id)).toBe("skip-nonaktif");
    } finally {
      await prisma.sheetConfig.update({ where: { id: "default" }, data: { enabled: true } });
    }
    expect(tab.tulis).toEqual([]);
  });
});
