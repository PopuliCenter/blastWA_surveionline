import type { FastifyInstance } from "fastify";
import { readdir, stat, open, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { env } from "../env.js";

// Pembaca log galat terstruktur (1 baris JSON per galat, lihat lib/errorLog.ts).
//
// Kenapa ada halamannya: sebelum ini log hanya bisa dibaca lewat SSH lalu grep, dan
// akibatnya terbukti mahal. Satu galat "Banner Flow ditolak" tercatat 17 September dan
// baru terbaca 17 hari kemudian — kebetulan, saat menelusuri hal lain.
//
// Yang dibaca BUKAN hanya isinya, tapi juga apakah pencatatnya hidup. Halaman kosong
// karena tidak ada galat dan halaman kosong karena pencatatnya mati tampak persis sama,
// dan yang kedua justru muncul saat paling dibutuhkan. Karena itu respons selalu membawa
// keadaan berkasnya: ukuran, waktu tulis terakhir, dan apakah foldernya bisa ditulisi.

// Hanya ekor berkas yang dibaca. Log tumbuh tanpa batas atas; menarik seluruhnya ke memori
// akan membunuh proses persis saat keadaan sedang buruk — yaitu saat log paling panjang.
const MAKS_BYTE = 512 * 1024;

export type EntriLog = {
  ts: string;
  source: string;
  name?: string;
  message: string;
  stack?: string;
  context?: unknown;
  berkas: string;
};

async function bacaEkor(path: string): Promise<string> {
  const fh = await open(path, "r");
  try {
    const { size } = await fh.stat();
    const mulai = Math.max(0, size - MAKS_BYTE);
    const buf = Buffer.alloc(size - mulai);
    if (buf.length) await fh.read(buf, 0, buf.length, mulai);
    const teks = buf.toString("utf8");
    // Pemotongan di tengah baris: baris pertama hampir pasti sepotong, jadi dibuang.
    return mulai > 0 ? teks.slice(teks.indexOf("\n") + 1) : teks;
  } finally {
    await fh.close();
  }
}

function uraikan(teks: string, berkas: string): EntriLog[] {
  const out: EntriLog[] = [];
  for (const baris of teks.split("\n")) {
    const t = baris.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as Partial<EntriLog>;
      if (!o.ts || typeof o.message !== "string") continue;
      out.push({
        ts: String(o.ts),
        source: String(o.source ?? "-"),
        name: o.name ? String(o.name) : undefined,
        message: o.message,
        stack: o.stack ? String(o.stack) : undefined,
        context: o.context,
        berkas,
      });
    } catch {
      // Baris rusak (tulis terpotong saat proses mati) dilewati, bukan menggagalkan semua.
    }
  }
  return out;
}

export async function logRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  // Log memuat jejak tumpukan, URL internal, dan ALAMAT IP pemanggil — data pribadi.
  // Dibatasi superadmin, sama seperti halaman Admin.
  app.addHook("preHandler", async (req, reply) => {
    if (req.user.role !== "superadmin") return reply.code(403).send({ error: "forbidden" });
  });

  app.get("/api/log", async (req) => {
    const { limit, sumber, cari } = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).default(200),
        sumber: z.string().trim().optional(),
        cari: z.string().trim().optional(),
      })
      .parse(req.query);

    const dir = dirname(env.ERROR_LOG_FILE);

    let bisaDitulis = false;
    try {
      await access(dir, constants.W_OK);
      bisaDitulis = true;
    } catch {
      /* folder tak ada atau tak bisa ditulis — dilaporkan apa adanya di bawah */
    }

    let nama: string[] = [];
    try {
      nama = (await readdir(dir)).filter((f) => f.endsWith(".log")).sort();
    } catch {
      return { dir, bisaDitulis, berkas: [], entri: [], sumberTersedia: [], adaLagi: false };
    }

    const berkas: { nama: string; ukuran: number; terakhir: string | null }[] = [];
    let semua: EntriLog[] = [];
    for (const n of nama) {
      const p = join(dir, n);
      try {
        const st = await stat(p);
        berkas.push({ nama: n, ukuran: st.size, terakhir: st.mtime.toISOString() });
        if (st.size) semua = semua.concat(uraikan(await bacaEkor(p), n));
      } catch {
        /* berkas hilang di tengah jalan — lewati, jangan jatuhkan seluruh respons */
      }
    }

    // Daftar sumber dihitung SEBELUM penyaringan, supaya pilihannya tidak ikut menyusut
    // menjadi satu begitu sebuah sumber dipilih.
    const sumberTersedia = [...new Set(semua.map((e) => e.source))].sort();

    const kata = cari?.toLowerCase();
    const tersaring = semua.filter(
      (e) =>
        (!sumber || e.source === sumber) &&
        (!kata ||
          e.message.toLowerCase().includes(kata) ||
          (e.stack ?? "").toLowerCase().includes(kata) ||
          JSON.stringify(e.context ?? "")
            .toLowerCase()
            .includes(kata)),
    );
    tersaring.sort((a, b) => b.ts.localeCompare(a.ts));

    return {
      dir,
      bisaDitulis,
      berkas,
      sumberTersedia,
      adaLagi: tersaring.length > limit,
      entri: tersaring.slice(0, limit),
    };
  });
}
