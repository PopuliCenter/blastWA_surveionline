// ===== Peta sebaran lokasi responden — perhitungan MURNI =====
//
// Peta digambar sendiri sebagai SVG dari garis batas provinsi yang dikirim backend, bukan
// lewat ubin peta pihak ketiga (Google Maps, OpenStreetMap): setiap ubin yang dimuat
// memberi tahu server luar wilayah mana yang sedang dilihat, dan titik responden tidak
// perlu meninggalkan aplikasi ini hanya untuk digambar.

import { ditolakKuota } from "./exportSurvey";

// Kotak pembatas Indonesia [minBujur, minLintang, maksBujur, maksLintang].
export const INDONESIA = [94.8, -11.2, 141.2, 6.2];

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

// Lebarkan kotak supaya perbandingan tinggi:lebarnya `aspek` (setelah koreksi lintang),
// dengan titik tengah tetap. Tanpa ini sebaran yang memanjang ke utara memaksa peta
// setinggi layar, dan sebaran yang memanjang ke timur menjadi garis tipis.
export function pasAspek(bbox, aspek) {
  const [a, b, c, d] = bbox;
  const kx = Math.cos((((b + d) / 2) * Math.PI) / 180);
  const lebar = (c - a) * kx;
  const tinggi = d - b;
  const cx = (a + c) / 2;
  const cy = (b + d) / 2;
  if (tinggi / lebar > aspek) {
    const l = tinggi / aspek / kx / 2;
    return [cx - l, b, cx + l, d];
  }
  const t = (lebar * aspek) / 2;
  return [a, cy - t, c, cy + t];
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

// Proyeksi ekuirektangular ke kotak `lebar` × `lebar*aspek`. Indonesia melintang khatulistiwa,
// jadi distorsinya kecil; koreksi kosinus lintang tetap dipakai agar peta yang diperbesar
// ke satu provinsi tidak melebar.
export function proyeksi(bbox, lebar) {
  const [a, b, c, d] = bbox;
  const kx = Math.cos((((b + d) / 2) * Math.PI) / 180);
  const skala = lebar / ((c - a) * kx);
  const tinggi = (d - b) * skala;
  return { tinggi, xy: (lng, lat) => [(lng - a) * kx * skala, (d - lat) * skala] };
}

const r1 = (n) => Math.round(n * 10) / 10;

// Jalur SVG untuk MultiPolygon. Lubang ikut digambar; aturan isi "evenodd" yang
// melubanginya.
export function jalurPoligon(poligon, xy) {
  let d = "";
  for (const p of poligon)
    for (const cincin of p) {
      cincin.forEach(([lng, lat], i) => {
        const [x, y] = xy(lng, lat);
        d += `${i ? "L" : "M"}${r1(x)} ${r1(y)}`;
      });
      d += "Z";
    }
  return d;
}

// Kotak pembatas sebuah provinsi (cincin luar semua pulaunya).
export function bboxPoligon(poligon) {
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of poligon)
    for (const [x, y] of p[0] ?? []) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > d) d = y;
    }
  return [a, b, c, d];
}

// Dua kotak bersinggungan? Dipakai untuk melewati provinsi di luar layar. Sengaja memakai
// kotak, bukan titik tepi: ruas tepi lurus yang panjang bisa memotong sudut tampilan tanpa
// satu titik pun di dalamnya, dan sudut itu lalu tampil kosong. Provinsi yang lolos tapi
// ternyata tak terlihat cukup terpotong oleh viewBox.
export const bersinggungan = (k, l) => k[0] <= l[2] && k[2] >= l[0] && k[1] <= l[3] && k[3] >= l[1];

// Jari-jari titik menurut jumlah responden di koordinat itu: luas lingkaran sebanding
// jumlah, jadi jari-jarinya sebanding akar — kalau tidak, titik berisi 4 orang tampak 16 kali.
export const jariJari = (n, dasar = 4) => dasar * Math.sqrt(n);
