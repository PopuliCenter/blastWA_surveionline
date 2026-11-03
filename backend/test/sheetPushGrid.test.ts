import { describe, it, expect, vi, afterEach } from "vitest";

// Grid tab Google Sheets punya jumlah kolom tetap; menulis ke sel yang mulai di luar batas
// itu ditolak ("exceeds grid limits"). Kejadian nyata: judul kolom lokasi gagal ditulis di AJ
// pada tab yang berhenti di kolom AI. Fetch ke Google ditiru.
vi.mock("../src/lib/googleAuth.js", async (asli) => ({
  ...(await asli<typeof import("../src/lib/googleAuth.js")>()),
  getAccessToken: async () => "token",
}));

import { ensureTab, invalidateEnsuredTabs, lebarkanKolom } from "../src/services/sheetPush.js";

type Panggilan = { url: string; method: string; body?: unknown };
const asli = globalThis.fetch;
const sa = {} as Parameters<typeof lebarkanKolom>[0];

function tiruGoogle(kolomGrid: number, judulTab: string[]): Panggilan[] {
  const panggilan: Panggilan[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = decodeURIComponent(String(url));
    panggilan.push({
      url: u,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const jawab = (b: unknown) => new Response(JSON.stringify(b));
    if (u.includes("gridProperties"))
      return jawab({
        sheets: [{ properties: { sheetId: 0, title: "Tab A", gridProperties: { columnCount: kolomGrid } } }],
      });
    if (u.includes("fields=properties.title"))
      return jawab({ properties: { title: "S" }, sheets: [{ properties: { title: "Tab A" } }] });
    if (u.includes("/values/") && (init?.method ?? "GET") === "GET") return jawab({ values: [judulTab] });
    return jawab({});
  }) as never;
  return panggilan;
}

afterEach(() => {
  globalThis.fetch = asli;
  invalidateEnsuredTabs();
});

describe("lebarkanKolom", () => {
  it("menambah kolom sebanyak yang kurang saja; tab pertama (sheetId 0) tetap dikenali", async () => {
    const p = tiruGoogle(35, []);
    await lebarkanKolom(sa, "id", "Tab A", 37);
    const tambah = p.find((x) => x.method === "POST");
    expect(tambah?.body).toEqual({
      requests: [{ appendDimension: { sheetId: 0, dimension: "COLUMNS", length: 2 } }],
    });
  });

  it("grid yang sudah cukup tidak diubah", async () => {
    const p = tiruGoogle(40, []);
    await lebarkanKolom(sa, "id", "Tab A", 37);
    expect(p.some((x) => x.method === "POST")).toBe(false);
  });
});

describe("ensureTab — judul baru di luar grid", () => {
  it("grid dilebarkan DULU, baru judulnya ditulis", async () => {
    const lama = Array.from({ length: 35 }, (_, i) => `K${i}`);
    const p = tiruGoogle(35, lama);
    const judul = await ensureTab(sa, "id", "Tab A", [...lama, "Provinsi Lokasi", "Status Lokasi"]);
    expect(judul.slice(-2)).toEqual(["Provinsi Lokasi", "Status Lokasi"]);
    const iLebar = p.findIndex((x) => x.method === "POST" && JSON.stringify(x.body).includes("appendDimension"));
    const iTulis = p.findIndex((x) => x.method === "PUT" && x.url.includes("!AJ1"));
    expect(iLebar).toBeGreaterThanOrEqual(0);
    expect(iTulis).toBeGreaterThan(iLebar);
  });
});

describe("ensureTab — kolom sesudah Lama Pengisian", () => {
  const AWAL = ["Nomor", "Q1", "Durasi (menit)", "Asesmen Durasi", "Lama Pengisian"];
  const ASAL = ["Saluran", "Jalur Masuk", "Metode", "ID Iklan"];
  const LOKASI = ["Provinsi Lokasi", "Status Lokasi"];

  it("tab yang sudah punya asal mendapat judul lokasi di ujung kanan", async () => {
    const lama = [...AWAL, ...ASAL];
    const p = tiruGoogle(40, lama);
    expect(await ensureTab(sa, "id", "Tab A", [...AWAL, ...LOKASI, ...ASAL])).toEqual([...lama, ...LOKASI]);
    const tulis = p.find((x) => x.method === "PUT");
    expect(tulis?.url).toContain("!J1");
    expect(tulis?.body).toEqual({ values: [LOKASI] });
  });

  it("menulis judul gagal → yang dikembalikan judul SEBENARNYA, nilai asal tidak tumpah", async () => {
    const lama = [...AWAL, "Catatan QC"];
    const p = tiruGoogle(40, lama);
    const fetchAsli = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "PUT" ? new Response("{}", { status: 403 }) : fetchAsli(url, init),
    ) as never;
    expect(await ensureTab(sa, "id", "Tab A", [...AWAL, ...ASAL])).toEqual(lama);
    // Tidak mencoba lagi pada baris berikutnya sampai cache habis.
    const sebelum = p.length;
    expect(await ensureTab(sa, "id", "Tab A", [...AWAL, ...ASAL])).toEqual(lama);
    expect(p.length).toBe(sebelum);
  });

  it("membaca judul gagal → kolom sesudah Lama Pengisian dilewati, dan tidak disimpan di cache", async () => {
    tiruGoogle(40, AWAL);
    const fetchAsli = globalThis.fetch;
    let gagal = true;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) =>
      gagal && decodeURIComponent(String(url)).includes("!1:1")
        ? new Response("{}", { status: 500 })
        : fetchAsli(url, init),
    ) as never;
    expect(await ensureTab(sa, "id", "Tab A", [...AWAL, ...ASAL])).toEqual(AWAL);
    gagal = false;
    expect(await ensureTab(sa, "id", "Tab A", [...AWAL, ...ASAL])).toEqual([...AWAL, ...ASAL]);
  });
});
