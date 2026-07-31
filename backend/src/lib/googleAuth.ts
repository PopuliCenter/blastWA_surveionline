import { createHash, createSign } from "node:crypto";

// ===== Service account Google → access token (tanpa dependensi baru) =====
//
// Alur JWT Bearer (RFC 7523): susun JWT RS256 dengan private key service account,
// tukarkan di endpoint token Google. node:crypto bisa menandatangani RS256 sendiri,
// jadi tidak perlu googleapis/google-auth-library — konsisten dengan pola repo yang
// memanggil REST provider langsung lewat fetch (lihat providers/meta.ts, lib/ai.ts).
//
// Catatan biaya: Sheets API gratis (kuota per-menit, bukan berbayar) — TIDAK seperti
// Gemini yang menuntut billing. Tidak perlu kartu/prepay.

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type ServiceAccount = { client_email: string; private_key: string };

// Terima JSON kunci service account utuh (hasil unduhan dari Google Cloud) dan ambil
// dua field yang dipakai. Pesan galat dibuat menunjuk penyebab, karena kesalahan di
// sini paling sering "yang ditempel bukan file JSON kunci" — bukan masalah jaringan.
export function parseServiceAccount(raw: string): ServiceAccount {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("Bukan JSON yang sah. Tempel seluruh isi file kunci service account (.json).");
  }
  const sa = obj as Partial<ServiceAccount> & { type?: string };
  if (!sa.client_email || !sa.private_key) {
    throw new Error(
      'JSON tidak memuat "client_email"/"private_key". Pastikan yang ditempel file KUNCI service account, bukan file konfigurasi lain.',
    );
  }
  if (sa.type && sa.type !== "service_account") {
    throw new Error(`Tipe kredensial "${sa.type}" — yang dibutuhkan kunci bertipe "service_account".`);
  }
  return { client_email: sa.client_email, private_key: sa.private_key };
}

const b64url = (input: Buffer | string): string => Buffer.from(input).toString("base64url");

// Susun JWT RS256. nowSec dipisah sebagai parameter agar bisa diuji deterministik.
export function buildJwt(sa: ServiceAccount, scope: string, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope, aud: GOOGLE_TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  return `${unsigned}.${b64url(signature)}`;
}

// Token berlaku 1 jam — simpan di memori supaya tiap baris respons tidak memicu
// bolak-balik OAuth. Sidik jari kredensial ikut disimpan agar ganti service account
// (atau rotasi kunci) langsung membatalkan cache.
let cached: { token: string; expSec: number; fingerprint: string } | null = null;

const fingerprintOf = (sa: ServiceAccount): string =>
  createHash("sha256").update(sa.client_email).update(sa.private_key).digest("hex");

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fp = fingerprintOf(sa);
  if (cached && cached.fingerprint === fp && cached.expSec - 300 > nowSec) return cached.token;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildJwt(sa, SHEETS_SCOPE, nowSec),
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 1000);
    throw new Error(`Token Google gagal (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Token Google kosong — respons tak memuat access_token.");
  cached = { token: json.access_token, expSec: nowSec + (json.expires_in ?? 3600), fingerprint: fp };
  return json.access_token;
}
