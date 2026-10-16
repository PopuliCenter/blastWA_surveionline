import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { gunzipSync, gzipSync } from "node:zlib";

// Garis batas provinsi bisa satu–dua MB dan proxy di depan backend tidak mengompres respons
// API — jadi rute ini mengompres sendiri. Jawaban "belum tersedia" tidak boleh disimpan
// browser: kalau tidak, peta tetap kosong sehari penuh setelah datanya dipasang.

const keadaan = { tersedia: true };
vi.mock("../src/services/petaProvinsi.js", () => ({
  petaUntukLayar: async () => {
    const json = JSON.stringify(keadaan.tersedia ? { tersedia: true, fitur: [] } : { tersedia: false });
    return { tersedia: keadaan.tersedia, json, gzip: gzipSync(json) };
  },
}));

async function aplikasi() {
  const { petaRoutes } = await import("../src/routes/peta.js");
  const app = Fastify();
  app.decorate("authenticate", async () => {});
  await app.register(petaRoutes);
  return app;
}

describe("GET /api/peta/provinsi", () => {
  beforeEach(() => {
    keadaan.tersedia = true;
  });

  it("dikompres gzip bila browser menerimanya", async () => {
    const app = await aplikasi();
    const r = await app.inject({ url: "/api/peta/provinsi", headers: { "accept-encoding": "gzip, deflate, br" } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-encoding"]).toBe("gzip");
    expect(r.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(gunzipSync(r.rawPayload).toString())).toEqual({ tersedia: true, fitur: [] });
    expect(r.headers["cache-control"]).toBe("private, max-age=86400");
  });

  it("tanpa gzip: JSON biasa", async () => {
    const app = await aplikasi();
    const r = await app.inject({ url: "/api/peta/provinsi" });
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.json()).toEqual({ tersedia: true, fitur: [] });
  });

  it("'belum tersedia' tidak disimpan browser", async () => {
    keadaan.tersedia = false;
    const app = await aplikasi();
    const r = await app.inject({ url: "/api/peta/provinsi" });
    expect(r.json()).toEqual({ tersedia: false });
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});
