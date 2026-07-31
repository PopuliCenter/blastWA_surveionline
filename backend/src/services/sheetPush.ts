import { getAccessToken, type ServiceAccount } from "../lib/googleAuth.js";

// ===== Penulis Google Sheets (REST v4, tanpa dependensi baru) =====
//
// Dipakai worker antrean "sheets": satu baris per respons survei selesai.
// Semua galat dilempar apa adanya (dengan potongan body respons Google) supaya
// BullMQ me-retry dan penyebabnya terbaca di log — bukan ditelan diam-diam.

const API = "https://sheets.googleapis.com/v4/spreadsheets";

async function call<T>(sa: ServiceAccount, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken(sa);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    // 1000 karakter — cukup untuk pesan galat Google yang menyebut sebab (403 belum
    // di-share, 404 ID salah, dst). Pemotongan terlalu pendek pernah menyembunyikan
    // bagian diagnostiknya (pelajaran dari galat Gemini).
    const detail = (await res.text()).slice(0, 1000);
    throw new Error(`Sheets API ${res.status} ${method} ${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

// Notasi A1 membutuhkan kutip tunggal bila nama tab berspasi; kutip di dalam nama
// sudah dibuang sheetTabName, tapi tetap di-escape untuk berjaga.
const rangeOf = (tab: string, cells: string): string => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${cells}`);

type SpreadsheetMeta = { properties?: { title?: string }; sheets?: { properties?: { title?: string } }[] };

export async function readSpreadsheetMeta(
  sa: ServiceAccount,
  spreadsheetId: string,
): Promise<{ title: string; tabs: string[] }> {
  const meta = await call<SpreadsheetMeta>(
    sa,
    "GET",
    `/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
  );
  return {
    title: meta.properties?.title ?? "(tanpa judul)",
    tabs: (meta.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean),
  };
}

// Tab yang sudah dipastikan ada — worker berjalan serial (concurrency 1), jadi Set
// sederhana cukup; kalau tab dihapus orang saat proses berjalan, append gagal dan
// retry BullMQ memaksa pemeriksaan ulang lewat ensureTab (cache di-invalidate).
const ensured = new Set<string>();

export function invalidateEnsuredTabs(): void {
  ensured.clear();
}

export async function ensureTab(
  sa: ServiceAccount,
  spreadsheetId: string,
  tab: string,
  header: string[],
): Promise<void> {
  const key = `${spreadsheetId}::${tab}`;
  if (ensured.has(key)) return;

  const { tabs } = await readSpreadsheetMeta(sa, spreadsheetId);
  if (!tabs.includes(tab)) {
    await call(sa, "POST", `/${spreadsheetId}:batchUpdate`, {
      requests: [{ addSheet: { properties: { title: tab } } }],
    });
    // Header hanya ditulis saat KITA yang membuat tabnya. Tab yang sudah ada tidak
    // ditimpa — bisa jadi tim sudah mengatur lebar kolom/filter di sana.
    await call(sa, "PUT", `/${spreadsheetId}/values/${rangeOf(tab, "A1")}?valueInputOption=RAW`, {
      values: [header],
    });
  }
  ensured.add(key);
}

export async function appendRow(
  sa: ServiceAccount,
  spreadsheetId: string,
  tab: string,
  row: (string | number)[],
): Promise<void> {
  try {
    await call(
      sa,
      "POST",
      `/${spreadsheetId}/values/${rangeOf(tab, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [row] },
    );
  } catch (err) {
    // Tab mungkin dihapus/diganti nama setelah masuk cache → paksa ensureTab ulang
    // pada percobaan retry berikutnya.
    ensured.delete(`${spreadsheetId}::${tab}`);
    throw err;
  }
}
