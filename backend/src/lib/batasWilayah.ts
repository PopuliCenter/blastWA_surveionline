// ===== Titik → provinsi (point-in-polygon) — MURNI =====
//
// Dihitung di server sendiri dari data batas wilayah, BUKAN lewat API geocoding pihak
// ketiga: mengirim koordinat responden ke layanan luar negeri berarti satu transfer data
// pribadi lagi (UU PDP Pasal 56), dan satu ketergantungan lagi yang bisa mati atau
// membatasi kuota di tengah lapangan.
//
// Koordinat GeoJSON: [bujur, lintang] — urutan yang sering tertukar.

export type Cincin = readonly (readonly [number, number])[];
export type Poligon = readonly Cincin[]; // cincin luar, lalu lubang-lubangnya
export type FiturProvinsi = {
  kode: string; // kode Kepmendagri 2 digit
  poligon: readonly Poligon[]; // MultiPolygon: pulau-pulau satu provinsi
  bbox: readonly [number, number, number, number]; // [minBujur, minLintang, maksBujur, maksLintang]
};

// Ray casting: tarik garis ke timur dari titik, hitung berapa kali memotong tepi cincin.
// Ganjil = di dalam.
export function titikDalamCincin(lng: number, lat: number, cincin: Cincin): boolean {
  let dalam = false;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const [xi, yi] = cincin[i]!;
    const [xj, yj] = cincin[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export function titikDalamPoligon(lng: number, lat: number, poligon: Poligon): boolean {
  const [luar, ...lubang] = poligon;
  if (!luar || !titikDalamCincin(lng, lat, luar)) return false;
  return !lubang.some((l) => titikDalamCincin(lng, lat, l));
}

export function bboxDari(poligon: readonly Poligon[]): [number, number, number, number] {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (const p of poligon)
    for (const [x, y] of p[0] ?? []) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > d) d = y;
    }
  return [a, b, c, d];
}

// Titik di luar semua poligon tapi sedekat ini (derajat, ±1,1 km) ke tepi sebuah provinsi
// tetap dianggap di provinsi itu: responden di pesisir, dermaga, atau pulau karang kecil
// yang hilang saat garis pantainya disederhanakan bisa jatuh sedikit di "laut".
//
// Sengaja kecil. Cadangan ini tidak bisa membedakan garis pantai dari perbatasan DARAT
// dengan Malaysia, Timor-Leste, dan Papua Nugini, jadi titik di negara tetangga yang
// sedekat ini ke perbatasan ikut mendapat provinsi Indonesia. Dengan ambang ±1,1 km,
// yang terkena hanya titik yang praktis berada di garis perbatasan.
export const AMBANG_PESISIR = 0.01;

function jarakKeRuas(p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Kode provinsi yang memuat titik ini, atau null bila di luar semua provinsi (laut,
// luar negeri). Kotak pembatas diperiksa dulu: kebanyakan provinsi tersingkir tanpa
// menelusuri ribuan titik tepinya.
export function provinsiDariKoordinat(
  lat: number,
  lng: number,
  fitur: readonly FiturProvinsi[],
  ambang = AMBANG_PESISIR,
): string | null {
  for (const f of fitur) {
    const [a, b, c, d] = f.bbox;
    if (lng < a || lng > c || lat < b || lat > d) continue;
    if (f.poligon.some((p) => titikDalamPoligon(lng, lat, p))) return f.kode;
  }
  // Tidak di dalam mana pun: cari tepi provinsi terdekat dalam ambang.
  let terdekat: string | null = null;
  let jarak = ambang;
  const titik = [lng, lat] as const;
  for (const f of fitur) {
    const [a, b, c, d] = f.bbox;
    if (lng < a - ambang || lng > c + ambang || lat < b - ambang || lat > d + ambang) continue;
    for (const p of f.poligon)
      for (const cincin of p)
        for (let i = 1; i < cincin.length; i++) {
          const j = jarakKeRuas(titik, cincin[i - 1]!, cincin[i]!);
          if (j <= jarak) {
            jarak = j;
            terdekat = f.kode;
          }
        }
  }
  return terdekat;
}
