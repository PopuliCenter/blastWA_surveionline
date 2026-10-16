// ===== GeoJSON sumber → isi backend/data/batas-provinsi.json — MURNI =====
//
// Dipakai scripts/siapkan-batas-provinsi.ts. Dipisah agar aturannya bisa diuji tanpa
// berkas: kunci provinsi mana yang dibaca, apa yang ditolak, dan bentuk keluarannya.

import { kodeProvinsiDari, PROVINSI, type Provinsi } from "./wilayah.js";
import type { Poligon } from "./batasWilayah.js";

type Posisi = readonly number[]; // [bujur, lintang] atau [bujur, lintang, tinggi]
type Geometri =
  | { type: "Polygon"; coordinates: Posisi[][] }
  | { type: "MultiPolygon"; coordinates: Posisi[][][] }
  | { type: string; coordinates?: unknown };
export type FiturSumber = { properties?: Record<string, unknown> | null; geometry: Geometri | null };

export type HasilSusun = {
  fitur: { kode: string; poligon: Poligon[] }[];
  takCocok: string[]; // nilai kunci fitur yang tidak dikenali sebagai provinsi
  hilang: Provinsi[]; // provinsi yang tidak ada di sumber
  belumDilebur: [string, number][]; // provinsi yang terdiri atas lebih dari satu fitur
};

const bulat5 = (n: number) => Math.round(n * 1e5) / 1e5;

// Koordinat ketiga (tinggi) dibuang; lima desimal ≈ 1 m. Tidak disederhanakan lagi di
// sini: penyederhanaan per cincin menggeser tepi bersama dua provinsi secara berbeda dan
// meninggalkan celah serta tumpang tindih. Sederhanakan di praolah dengan alat yang
// menjaga topologi (mapshaper -simplify), lihat skripnya.
const cincin2d = (c: Posisi[]) => c.map((p) => [bulat5(Number(p[0])), bulat5(Number(p[1]))] as [number, number]);

export function susunBatas(sumber: readonly FiturSumber[], opsi: { propKode?: string; propNama?: string }): HasilSusun {
  const per = new Map<string, Poligon[]>();
  const jumlahFitur = new Map<string, number>();
  const takCocok: string[] = [];
  for (const f of sumber) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    const nilai = f.properties?.[opsi.propKode ?? opsi.propNama ?? ""];
    let kode: string | null;
    if (opsi.propKode) {
      // "32" maupun kode bertitik yang diawali kode provinsi ("32.04").
      const m = String(nilai ?? "").match(/^\s*(\d{2})(?!\d)/);
      kode = m && PROVINSI.some((p) => p.kode === m[1]) ? m[1]! : null;
    } else {
      kode = kodeProvinsiDari(nilai);
    }
    if (!kode) {
      takCocok.push(nilai == null || nilai === "" ? "(kosong)" : String(nilai));
      continue;
    }
    const poligon =
      g.type === "Polygon"
        ? [(g.coordinates as Posisi[][]).map(cincin2d)]
        : (g.coordinates as Posisi[][][]).map((p) => p.map(cincin2d));
    per.set(kode, [...(per.get(kode) ?? []), ...poligon]);
    jumlahFitur.set(kode, (jumlahFitur.get(kode) ?? 0) + 1);
  }
  return {
    fitur: [...per.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kode, poligon]) => ({ kode, poligon })),
    takCocok,
    hilang: PROVINSI.filter((p) => !per.has(p.kode)),
    belumDilebur: [...jumlahFitur.entries()].filter(([, n]) => n > 1),
  };
}
