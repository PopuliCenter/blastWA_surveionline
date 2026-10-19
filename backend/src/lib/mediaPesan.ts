// ===== Gambar & stiker di kotak masuk — aturan MURNI =====
//
// Isi gambar tidak ikut terkirim ke webhook: Meta hanya mengirim ID medianya, dan filenya
// tetap di server Meta (disimpan sementara). Kotak masuk mengambilnya SAAT DIBUKA lewat
// GET /api/messages/:id/media — tidak ada foto responden yang disimpan di server kita.

export type JenisMedia = "image" | "sticker";
export type MediaPesan = { jenis: JenisMedia; id: string };

// ID media Meta berupa deretan angka. Diperiksa sebelum ditempel ke URL Graph API, supaya
// payload yang aneh tidak bisa membelokkan permintaan ke jalur lain.
const ID_MEDIA = /^\d{1,32}$/;

// Media gambar/stiker dari payload pesan masuk yang tersimpan (Message.payload — pesan Meta
// apa adanya: { type: "image", image: { id, mime_type, … } }). null bila bukan gambar/stiker.
export function mediaDariPayload(payload: unknown): MediaPesan | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const jenis of ["image", "sticker"] as const) {
    const m = p[jenis];
    const id = m && typeof m === "object" ? (m as Record<string, unknown>).id : undefined;
    if (typeof id === "string" && ID_MEDIA.test(id)) return { jenis, id };
  }
  return null;
}

// Hanya format gambar yang aman ditampilkan apa adanya. SVG sengaja TIDAK termasuk: SVG bisa
// membawa skrip, dan respons ini disajikan dari domain aplikasi.
export const MIME_GAMBAR = new Set(["image/jpeg", "image/png", "image/webp"]);

// Batas ukuran yang diambil. Gambar WhatsApp maksimal 5 MB, stiker jauh lebih kecil.
export const MAKS_BYTE_MEDIA = 5 * 1024 * 1024;

// Vendor ini bisa mengunduh ulang media? Vendor yang tidak dikenal (pesan lama dari vendor
// yang sudah dicopot) dianggap tidak bisa — bukan galat yang menggagalkan seluruh daftar.
export function bisaUnduhMedia(ambil: () => { downloadMedia?: unknown } | undefined): boolean {
  try {
    return typeof ambil()?.downloadMedia === "function";
  } catch {
    return false;
  }
}

export const mimeBersih = (m: unknown) =>
  String(m ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
