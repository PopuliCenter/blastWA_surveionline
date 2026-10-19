import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import { MAKS_BYTE_MEDIA, MIME_GAMBAR, bisaUnduhMedia, mediaDariPayload, mimeBersih } from "../lib/mediaPesan.js";
import { logError } from "../lib/errorLog.js";
import type { HasilUnduhMedia } from "../providers/types.js";

const GAGAL_MENGHUBUNGI = "Gagal mengambil gambar dari Meta. Coba lagi sebentar lagi.";

// Gambar/stiker yang dikirim responden, diambil dari vendor SAAT DIBUKA di kotak masuk.
// Tidak disimpan di server: tiap pembukaan meminta ulang ke vendor (lihat lib/mediaPesan.ts).
//
// Yang diminta adalah ID PESAN kita, bukan ID media mentah — kalau ID media diterima
// langsung, rute ini menjadi proksi terbuka untuk media apa pun dengan token kita.
export async function mediaRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/messages/:id/media", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const pesan = await prisma.message.findUnique({
      where: { id },
      select: { direction: true, vendor: true, payload: true },
    });
    const media = pesan?.direction === "in" ? mediaDariPayload(pesan.payload) : null;
    if (!pesan || !media) return reply.code(404).send({ error: "Pesan ini bukan gambar atau stiker." });

    if (!bisaUnduhMedia(() => getProvider(pesan.vendor)))
      return reply
        .code(422)
        .send({ error: "Gambar hanya bisa dilihat untuk pesan yang masuk lewat nomor WhatsApp Business (Meta)." });

    let hasil: HasilUnduhMedia | undefined;
    try {
      hasil = await getProvider(pesan.vendor).downloadMedia?.(media.id, MAKS_BYTE_MEDIA);
    } catch (err) {
      logError("backend", err, { scope: "mediaPesan", messageId: id });
      return reply.code(502).send({ error: GAGAL_MENGHUBUNGI });
    }
    if (!hasil || "gagal" in hasil) {
      const gagal = hasil?.gagal ?? "galat-vendor";
      if (gagal === "kedaluwarsa")
        return reply
          .code(410)
          .send({ error: "Gambar ini sudah tidak tersedia di Meta — media hanya disimpan sementara oleh WhatsApp." });
      if (gagal === "terlalu-besar")
        return reply.code(413).send({ error: "Gambar ini terlalu besar untuk ditampilkan di sini." });
      // Token kedaluwarsa, batas permintaan, atau gangguan Meta: dicatat, supaya token yang
      // rusak tidak hanya terlihat sebagai "gambar hilang" di layar operator.
      logError("backend", new Error("Unduhan media dari vendor gagal"), {
        scope: "mediaPesan",
        messageId: id,
        status: hasil && "status" in hasil ? hasil.status : undefined,
        rincian: hasil && "rincian" in hasil ? hasil.rincian : undefined,
      });
      return reply.code(502).send({ error: GAGAL_MENGHUBUNGI });
    }

    const mime = mimeBersih(hasil.mimeType);
    if (!MIME_GAMBAR.has(mime)) return reply.code(415).send({ error: "Format media ini tidak bisa ditampilkan." });

    return (
      reply
        .header("Cache-Control", "private, max-age=86400")
        .header("Content-Disposition", "inline")
        // Dibuka langsung di tab pun tetap hanya gambar: tanpa skrip, tanpa sumber lain.
        .header("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
        .type(mime)
        .send(hasil.data)
    );
  });
}
