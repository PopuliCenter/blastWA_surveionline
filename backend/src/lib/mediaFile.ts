import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";

// Ambil isi file media dari sebuah URL header template.
// File milik sendiri (/uploads/<nama>) DIBACA LANGSUNG dari disk — lebih andal daripada
// mengunduh URL publiknya sendiri (tak melewati Cloudflare/nginx, jalan walau domain
// belum bisa diakses dari dalam container). URL luar diunduh biasa.

export type MediaFile = { buffer: Buffer; mime: string; filename: string };

// Tipe yang diterima Resumable Upload API Meta untuk header template.
// CATATAN: WebP & dokumen Office TIDAK termasuk — hanya JPEG/PNG, PDF, MP4.
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  mp4: "video/mp4",
};

export const SUPPORTED_TEMPLATE_MEDIA = Object.values(EXT_MIME);

export function mimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

// Nama file dari URL (segmen akhir tanpa query).
export function fileNameFromUrl(url: string): string {
  try {
    const last = url.split("/").pop()?.split("?")[0] ?? "";
    return decodeURIComponent(last) || "file";
  } catch {
    return "file";
  }
}

export async function readMediaFromUrl(url: string): Promise<MediaFile> {
  const filename = fileNameFromUrl(url);
  const idx = url.indexOf("/uploads/");

  if (idx >= 0) {
    // Milik sendiri → baca dari UPLOAD_DIR. Pakai basename saja agar segmen path
    // dari URL tak bisa keluar dari folder upload (anti path traversal).
    const safe = path.basename(filename);
    const buffer = await readFile(path.join(path.resolve(env.UPLOAD_DIR), safe));
    const mime = mimeFromName(safe);
    if (!mime) throw new Error(`Tipe file "${safe}" tidak didukung Meta untuk header template.`);
    return { buffer, mime, filename: safe };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal mengunduh media header (HTTP ${res.status}) dari ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // Percayai ekstensi dulu; bila tak dikenal, pakai Content-Type dari server.
  const mime = mimeFromName(filename) ?? (res.headers.get("content-type") || "").split(";")[0]!.trim();
  if (!SUPPORTED_TEMPLATE_MEDIA.includes(mime))
    throw new Error(`Tipe media "${mime || "tidak dikenal"}" tidak didukung Meta untuk header template.`);
  return { buffer, mime, filename };
}
