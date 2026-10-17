// ===== Peta sebaran lokasi responden — perhitungan MURNI =====
//
// Petanya digambar Leaflet di atas peta dasar OpenStreetMap (src/pages/survey/PetaSebaran.jsx).
// Di sini hanya perhitungan yang bisa diuji tanpa peta: ringkasan status, titik yang
// digabung, dan kotak zoom.

import { ditolakKuota } from "./exportSurvey";

// Kotak pembatas Indonesia [minBujur, minLintang, maksBujur, maksLintang] — termasuk
// wilayah laut provinsi menurut data batas OpenStreetMap.
export const INDONESIA = [94.7, -11.3, 141.1, 6.3];

// Urutan tampil ringkasan pemeriksaan wilayah. "tidak-diminta" tidak ikut: survei yang
// tidak meminta lokasi tidak punya apa-apa untuk diperiksa.
export const URUTAN_STATUS = [
  "sesuai",
  "tidak-sesuai",
  "tanpa-pembanding",
  "di-luar-batas",
  "belum-diperiksa",
  "belum-dibagikan",
];

// Titik di dalam kotak Indonesia. Hanya titik ini yang menentukan zoom peta: satu lokasi
// di Jeddah atau London membuat kotak sebaran melebar ke skala benua, dan Indonesia
// tinggal sebesar perangko dengan bagian timurnya terpotong.
export const dalamIndonesia = (t) =>
  t.lng >= INDONESIA[0] && t.lng <= INDONESIA[2] && t.lat >= INDONESIA[1] && t.lat <= INDONESIA[3];

// Ringkasan lokasi dari daftar respons: berapa yang dimintai, berapa yang membagikan,
// statusnya, dan titik-titik yang digabung per koordinat (yang sudah dibulatkan ±1 km
// di server, jadi banyak responden bisa jatuh di titik yang sama).
export function ringkasLokasi(responses) {
  const status = Object.fromEntries(URUTAN_STATUS.map((s) => [s, 0]));
  const perProvinsi = new Map();
  const perNama = new Map();
  const titik = new Map();
  let diminta = 0;
  for (const r of responses) {
    if (ditolakKuota(r) || !r.statusLokasi || r.statusLokasi === "tidak-diminta") continue;
    diminta++;
    if (r.statusLokasi in status) status[r.statusLokasi]++;
    const l = r.lokasi;
    if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
    if (l.kodeProvinsi) perProvinsi.set(l.kodeProvinsi, (perProvinsi.get(l.kodeProvinsi) ?? 0) + 1);
    const nama =
      l.provinsi ||
      (r.statusLokasi === "belum-diperiksa" ? "Provinsi belum dapat ditentukan" : "Di luar batas provinsi");
    perNama.set(nama, (perNama.get(nama) ?? 0) + 1);
    const k = `${l.lat},${l.lng}`;
    const t = titik.get(k);
    if (t) t.n++;
    else titik.set(k, { lat: l.lat, lng: l.lng, n: 1, provinsi: l.provinsi ?? null });
  }
  const dibagikan = diminta - status["belum-dibagikan"];
  // Bentuk [label, jumlah] terurut menurun — sama dengan distribusi lain di Laporan.
  const distribusiProvinsi = [...perNama.entries()].sort((a, b) => b[1] - a[1]);
  return { diminta, dibagikan, status, perProvinsi, distribusiProvinsi, titik: [...titik.values()] };
}

// Kotak tampilan untuk sebaran titik: rentang titiknya ditambah margin, paling sempit
// `minRentang` derajat (satu titik saja tidak boleh menjadi peta seluas satu desa).
export function bboxSebaran(titik, { minRentang = 1.2, margin = 0.15 } = {}) {
  if (!titik.length) return INDONESIA;
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const t of titik) {
    a = Math.min(a, t.lng);
    b = Math.min(b, t.lat);
    c = Math.max(c, t.lng);
    d = Math.max(d, t.lat);
  }
  const lx = Math.max(c - a, minRentang);
  const ly = Math.max(d - b, minRentang);
  const cx = (a + c) / 2;
  const cy = (b + d) / 2;
  return [
    cx - (lx / 2) * (1 + margin * 2),
    cy - (ly / 2) * (1 + margin * 2),
    cx + (lx / 2) * (1 + margin * 2),
    cy + (ly / 2) * (1 + margin * 2),
  ];
}

// Jari-jari titik menurut jumlah responden di koordinat itu: luas lingkaran sebanding
// jumlah, jadi jari-jarinya sebanding akar — kalau tidak, titik berisi 4 orang tampak 16 kali.
export const jariJari = (n, dasar = 4) => dasar * Math.sqrt(n);
