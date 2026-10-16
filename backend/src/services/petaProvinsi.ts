import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { bboxDari, provinsiDariKoordinat, type FiturProvinsi, type Poligon } from "../lib/batasWilayah.js";
import type { Koordinat } from "../lib/lokasi.js";
import { PROVINSI } from "../lib/wilayah.js";
import { logError } from "../lib/errorLog.js";

// Data batas provinsi untuk mengubah titik lokasi menjadi provinsi, dan untuk peta sebaran.
//
// Berkasnya backend/data/batas-provinsi.json — dihasilkan scripts/siapkan-batas-provinsi.ts
// dari data batas wilayah sumber, memakai kode Kepmendagri. Dibaca SEKALI, saat pertama
// dibutuhkan, lalu disimpan di memori.
//
// Bila berkasnya belum ada, lokasi tetap disimpan (dibulatkan) dan provinsinya kosong —
// statusnya "Provinsi belum dapat ditentukan" (belum-diperiksa). Tidak ada yang gagal.
// Setelah berkasnya dipasang dan backend dijalankan ulang, provinsi lokasi lama dihitung
// saat daftar respons dibuka; skrip lengkapi:lokasi menyimpannya permanen.
// Jalur relatif dari src/services maupun dist/services sama-sama menunjuk backend/data.
const BERKAS = new URL("../../data/batas-provinsi.json", import.meta.url);

export type BerkasBatas = {
  sumber: string;
  lisensi: string;
  fitur: { kode: string; poligon: Poligon[] }[];
};

type Batas = { sumber: string; lisensi: string; fitur: FiturProvinsi[] };

let muat: Promise<Batas | null> | null = null;

function batas(): Promise<Batas | null> {
  muat ??= (async () => {
    let isi: string;
    try {
      isi = await readFile(BERKAS, "utf8");
    } catch {
      return null; // belum dipasang — bukan galat
    }
    try {
      const j = JSON.parse(isi) as BerkasBatas;
      return {
        sumber: j.sumber,
        lisensi: j.lisensi,
        fitur: j.fitur.map((f) => ({ kode: f.kode, poligon: f.poligon, bbox: bboxDari(f.poligon) })),
      };
    } catch (err) {
      logError("backend", err, { scope: "batasProvinsi", catatan: "berkas data batas provinsi rusak" });
      return null;
    }
  })();
  return muat;
}

export async function batasTerpasang(): Promise<boolean> {
  return Boolean(await batas());
}

export async function provinsiDariTitik(k: Koordinat): Promise<string | null> {
  const b = await batas();
  return b ? provinsiDariKoordinat(k.lat, k.lng, b.fitur) : null;
}

// Untuk layar cukup tiga desimal (±110 m). Titik yang sama di tepi bersama dua provinsi
// membulat ke angka yang sama, jadi tidak muncul celah; titik berurutan yang menjadi kembar
// setelah dibulatkan dibuang. Penyederhanaan bentuknya sudah dilakukan saat menyiapkan
// berkas (scripts/siapkan-batas-provinsi.ts), dengan topologi terjaga.
const bulat3 = (n: number) => Math.round(n * 1000) / 1000;

function cincinLayar(c: readonly (readonly [number, number])[]): [number, number][] {
  const hasil: [number, number][] = [];
  for (const [x, y] of c) {
    const t: [number, number] = [bulat3(x), bulat3(y)];
    const akhir = hasil[hasil.length - 1];
    if (!akhir || akhir[0] !== t[0] || akhir[1] !== t[1]) hasil.push(t);
  }
  return hasil;
}

export type PetaLayar =
  | { tersedia: false }
  | {
      tersedia: true;
      sumber: string;
      lisensi: string;
      fitur: { kode: string; nama: string; poligon: [number, number][][][] }[];
    };

// Disimpan sebagai teks JSON dan versi gzip-nya: isinya bisa satu–dua MB dan proxy di
// depan backend tidak mengompres respons API.
let layar: Promise<{ tersedia: boolean; json: string; gzip: Buffer }> | null = null;

export function petaUntukLayar(): Promise<{ tersedia: boolean; json: string; gzip: Buffer }> {
  layar ??= batas().then((b) => {
    const peta: PetaLayar = b
      ? {
          tersedia: true,
          sumber: b.sumber,
          lisensi: b.lisensi,
          fitur: b.fitur.map((f) => ({
            kode: f.kode,
            nama: PROVINSI.find((p) => p.kode === f.kode)?.nama ?? f.kode,
            poligon: f.poligon.map((p) => p.map(cincinLayar).filter((c) => c.length >= 4)).filter((p) => p.length > 0),
          })),
        }
      : { tersedia: false };
    const json = JSON.stringify(peta);
    return { tersedia: peta.tersedia, json, gzip: gzipSync(json) };
  });
  return layar;
}
