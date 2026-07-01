import { appendFile, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../env.js";

// Log error terstruktur ke file (1 baris JSON per error) — mudah di-grep, tanpa layanan luar.
// Path diatur via env ERROR_LOG_FILE (di prod dipisah per proses: backend.log / worker.log).

let dirReady = false;
function ensureDir(): void {
  if (dirReady) return;
  try {
    mkdirSync(dirname(env.ERROR_LOG_FILE), { recursive: true });
  } catch {
    /* abaikan — best-effort */
  }
  dirReady = true;
}

function serialize(source: string, err: unknown, context?: Record<string, unknown>): string {
  const base =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { message: typeof err === "string" ? err : JSON.stringify(err) };
  return JSON.stringify({ ts: new Date().toISOString(), source, ...base, ...(context ? { context } : {}) }) + "\n";
}

// Async, best-effort — untuk jalur normal (hook error request).
export function logError(source: string, err: unknown, context?: Record<string, unknown>): void {
  ensureDir();
  appendFile(env.ERROR_LOG_FILE, serialize(source, err, context), () => {});
}

// Sinkron — dipakai sebelum proses keluar (uncaughtException) agar dijamin tertulis.
export function logErrorSync(source: string, err: unknown, context?: Record<string, unknown>): void {
  ensureDir();
  try {
    appendFileSync(env.ERROR_LOG_FILE, serialize(source, err, context));
  } catch {
    /* abaikan */
  }
}

// Tangkap error tingkat proses (promise gagal tanpa catch, exception tak tertangani).
export function installProcessErrorHandlers(source: string): void {
  process.on("unhandledRejection", (reason) => logError(source, reason, { kind: "unhandledRejection" }));
  process.on("uncaughtException", (err) => {
    logErrorSync(source, err, { kind: "uncaughtException" });
    // Keluar agar Docker (restart: unless-stopped) menyalakan ulang dengan state bersih.
    process.exit(1);
  });
}
