import type { FastifyInstance } from "fastify";
import { petaUntukLayar } from "../services/petaProvinsi.js";

// Garis batas provinsi untuk peta sebaran responden di Laporan. Data publik, tapi tetap di
// balik login seperti halaman lain — yang memakainya hanya layar Laporan.
export async function petaRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/peta/provinsi", async (req, reply) => {
    const { tersedia, json, gzip } = await petaUntukLayar();
    // Isinya baru berubah bila berkas datanya diganti (dan server dijalankan ulang). Jawaban
    // "belum tersedia" tidak disimpan browser, supaya peta langsung muncul begitu dipasang.
    reply.header("Cache-Control", tersedia ? "private, max-age=86400" : "no-store").header("Vary", "Accept-Encoding");
    reply.type("application/json; charset=utf-8");
    // Dikompres sendiri: proxy di depan backend tidak mengompres respons API, dan tanpa
    // kompresi seluruh garis batas Indonesia terkirim beberapa kali lebih besar.
    if (/\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
      reply.header("Content-Encoding", "gzip");
      return reply.send(gzip);
    }
    return reply.send(json);
  });
}
