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

// Indeks kolom (0-based) → huruf A1. Bijektif, jadi benar melewati Z: 26 → AA.
// Survei 27 pertanyaan sudah melampaui kolom Z, dan pemetaan naif akan menulis judul
// ke tempat yang salah persis pada survei terbesar.
export function kolomA1(i: number): string {
  let s = "";
  for (let x = i + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

// Judul kolom yang perlu DITAMBAHKAN di kanan, atau null bila tidak boleh menyentuh apa pun.
//
// Hanya menambah, tidak pernah menimpa: kalau header yang ada bukan awalan persis dari
// header yang diharapkan, berarti tabnya sudah berbeda bentuk (pertanyaan diubah, kolom
// disusun ulang tim) — dan menulis judul baru di atasnya akan memberi nama salah pada data
// lama. Kolom tanpa judul jauh lebih tidak berbahaya daripada kolom dengan judul keliru.
export function judulYangKurang(ada: string[], diharapkan: string[]): { mulai: number; nilai: string[] } | null {
  if (!ada.length) return null; // tab kosong — biarkan; baris pertama akan mengisinya sendiri
  if (ada.length >= diharapkan.length) return null;
  for (let i = 0; i < ada.length; i++) if ((ada[i] ?? "").trim() !== diharapkan[i]) return null;
  return { mulai: ada.length, nilai: diharapkan.slice(ada.length) };
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
    ensured.add(key);
    return;
  }

  // Tab lama: kolom yang ditambahkan belakangan (asesmen durasi) belum punya judul di
  // sana. Judulnya ditambahkan di kanan — tanpa itu kolomnya terisi tapi tak bernama, dan
  // pembaca spreadsheet tidak punya cara menebak isinya.
  try {
    const r = await call<{ values?: string[][] }>(
      sa,
      "GET",
      `/${spreadsheetId}/values/${rangeOf(tab, "1:1")}`,
    );
    const kurang = judulYangKurang(r.values?.[0] ?? [], header);
    if (kurang) {
      const sel = `${kolomA1(kurang.mulai)}1`;
      await call(sa, "PUT", `/${spreadsheetId}/values/${rangeOf(tab, sel)}?valueInputOption=RAW`, {
        values: [kurang.nilai],
      });
    }
  } catch {
    // Gagal melengkapi judul TIDAK boleh menggagalkan penulisan barisnya: datanya jauh
    // lebih penting daripada labelnya, dan baris yang hilang tidak bisa dipulihkan.
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
