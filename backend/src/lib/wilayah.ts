import { PROVINSI, KAB_KOTA, type Provinsi, type KabKota } from "../data/wilayah.js";

export { PROVINSI, KAB_KOTA };
export type { Provinsi, KabKota };

// Pertanyaan tipe "wilayah" — provinsi lalu kabupaten/kota, memakai kode resmi Kepmendagri.
//
// Satu pertanyaan menghasilkan DUA pilihan, jadi ia memakai lebih dari satu field Flow.
// Itu memecah asumsi "satu pertanyaan = satu field" yang berlaku untuk tipe lain, sehingga
// penamaan field dan pembacaan jawabannya dikumpulkan di sini, bukan tersebar.

const KAB_PER_PROV = new Map<string, KabKota[]>();
for (const k of KAB_KOTA) {
  const arr = KAB_PER_PROV.get(k.kodeProvinsi);
  if (arr) arr.push(k);
  else KAB_PER_PROV.set(k.kodeProvinsi, [k]);
}
for (const arr of KAB_PER_PROV.values()) arr.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

const KAB_BY_KODE = new Map(KAB_KOTA.map((k) => [k.kode, k]));
const PROV_BY_KODE = new Map(PROVINSI.map((p) => [p.kode, p]));

export function kabKotaDari(kodeProvinsi: string): KabKota[] {
  return KAB_PER_PROV.get(kodeProvinsi) ?? [];
}

// Nama field Flow. Keduanya tetap berawalan "q_" supaya terbaca oleh answerKeys().
export function fieldProvinsi(base: string): string {
  return `${base}_p`;
}
export function fieldKabKota(base: string, kodeProvinsi: string): string {
  return `${base}_k${kodeProvinsi}`;
}

// Nilai yang disimpan sebagai jawaban. Kodenya SENGAJA ikut: seluruh alasan memakai data
// Kepmendagri adalah agar hasil survei bisa dicocokkan dengan tabel pembobot, dan nama
// saja tidak menjamin itu. Bentuknya tetap terbaca manusia di spreadsheet.
export function formatWilayah(kodeKab: string): string | null {
  const kab = KAB_BY_KODE.get(kodeKab);
  if (!kab) return null;
  const prov = PROV_BY_KODE.get(kab.kodeProvinsi);
  if (!prov) return null;
  return `${kab.nama}, ${prov.nama} (${kab.kode})`;
}

// Baca jawaban wilayah dari response_json. Hanya SATU dropdown kabupaten yang dirender
// (sisanya berada di dalam If yang bernilai salah), jadi tinggal dicari yang terisi.
export function readWilayahAnswer(base: string, response: Record<string, unknown>): string | null {
  const kodeProv = String(response[fieldProvinsi(base)] ?? "").trim();
  if (!kodeProv) return null;
  const kodeKab = String(response[fieldKabKota(base, kodeProv)] ?? "").trim();
  if (kodeKab) {
    const v = formatWilayah(kodeKab);
    if (v) return v;
  }
  // Provinsi terpilih tapi kabupaten/kota tidak — jawaban tetap disimpan setengah,
  // karena provinsinya saja sudah data pembobot yang berguna. Lebih baik daripada hilang.
  const prov = PROV_BY_KODE.get(kodeProv);
  return prov ? `${prov.nama} (${prov.kode})` : null;
}

// Pencocokan teks untuk mode chat, tempat responden MENGETIK nama wilayahnya.
// Mengembalikan null bila tidak dikenali, dan daftar kandidat bila ambigu — menebak di
// antara dua kabupaten bernama mirip akan merusak data tanpa jejak.
export function cariWilayah(teks: string): { ok: true; value: string } | { ok: false; kandidat: string[] } {
  const t = teks.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return { ok: false, kandidat: [] };

  // Kode persis, mis. "11.01" atau "11".
  const kabKode = KAB_BY_KODE.get(t);
  if (kabKode) return { ok: true, value: formatWilayah(kabKode.kode)! };

  // Nama LENGKAP yang eksplisit selalu menang lebih dulu. Tanpa urutan ini, "Kota Bandung"
  // ikut terjaring pencocokan tanpa-awalan bersama "Kabupaten Bandung" lalu dianggap
  // ambigu — padahal responden sudah menyebutkannya dengan jelas.
  const penuh = KAB_KOTA.filter((k) => k.nama.toLowerCase() === t);
  if (penuh.length === 1) return { ok: true, value: formatWilayah(penuh[0]!.kode)! };

  const tanpaAwalan = t.replace(/^(kabupaten|kab\.?|kota|kotamadya)\s+/, "");
  const persis = KAB_KOTA.filter((k) => k.nama.toLowerCase().replace(/^(kabupaten|kota)\s+/, "") === tanpaAwalan);
  if (persis.length === 1) return { ok: true, value: formatWilayah(persis[0]!.kode)! };
  if (persis.length > 1) return { ok: false, kandidat: persis.map((k) => formatWilayah(k.kode)!) };

  // Cocok sebagian, hanya bila TIDAK ambigu. Minimal 4 huruf agar "kot" atau "ban"
  // tidak menjaring puluhan wilayah.
  if (tanpaAwalan.length >= 4) {
    const sebagian = KAB_KOTA.filter((k) => k.nama.toLowerCase().replace(/^(kabupaten|kota)\s+/, "").includes(tanpaAwalan));
    if (sebagian.length === 1) return { ok: true, value: formatWilayah(sebagian[0]!.kode)! };
    if (sebagian.length > 1 && sebagian.length <= 8)
      return { ok: false, kandidat: sebagian.map((k) => formatWilayah(k.kode)!) };
  }
  return { ok: false, kandidat: [] };
}

// Kode provinsi (2 digit) dari berbagai bentuk masukan yang nyata ada di sistem ini:
// kode provinsi itu sendiri, kode kabupaten/kota ("34.04"), nama provinsi dari atribut
// kontak hasil impor, atau nilai jawaban wilayah yang tersimpan
// ("Kabupaten Sleman, DI Yogyakarta (34.04)").
//
// Satu pintu untuk semuanya, karena kuota per provinsi harus memberi angka yang SAMA
// apa pun asal datanya — kalau tidak, kuota Jawa Barat dari impor dan dari jawaban akan
// terhitung sebagai dua provinsi berbeda.
export function kodeProvinsiDari(nilai: unknown): string | null {
  const t = String(nilai ?? "").trim();
  if (!t) return null;

  // Kode dalam tanda kurung di akhir nilai jawaban tersimpan.
  const kurung = t.match(/\((\d{2})(?:\.\d{2})?\)\s*$/);
  if (kurung) return PROV_BY_KODE.has(kurung[1]!) ? kurung[1]! : null;

  // Kode polos: "34" atau "34.04".
  const polos = t.match(/^(\d{2})(?:\.\d{2})?$/);
  if (polos) return PROV_BY_KODE.has(polos[1]!) ? polos[1]! : null;

  const lc = t.toLowerCase();

  // Sinonim yang HARUS dikenali, bukan hasil tebakan.
  //
  // Dua provinsi di daftar ini memakai label pendek (DKI Jakarta, DI Yogyakarta), sedangkan
  // berkas impor dan data pemerintah lazim memakai bentuk panjangnya. Tanpa pemetaan ini,
  // kontak dari Jakarta atau Yogyakarta tidak terhitung ke kuota provinsinya — dan salah
  // hitung seperti itu tidak menimbulkan galat apa pun, cuma angka kuota yang keliru.
  const SINONIM: Record<string, string> = {
    "daerah khusus ibukota jakarta": "31",
    "daerah khusus ibu kota jakarta": "31",
    "daerah khusus jakarta": "31", // nama resmi sejak UU 2/2024
    dki: "31",
    jakarta: "31",
    "daerah istimewa yogyakarta": "34",
    diy: "34",
    yogyakarta: "34",
    jogjakarta: "34",
    jogja: "34",
  };

  // Nama provinsi — dicocokkan ke bentuk resmi maupun label pendek yang dipakai di sini.
  const persis = PROVINSI.find((p) => p.nama.toLowerCase() === lc);
  if (persis) return persis.kode;

  // Toleransi penulisan atribut impor: "DKI Jakarta" vs "Daerah Khusus Ibukota Jakarta",
  // "Jawa Barat" vs "Prov. Jawa Barat". Hanya diterima bila TIDAK ambigu.
  const bersih = lc.replace(/^(provinsi|prov\.?)\s+/, "").trim();
  if (SINONIM[bersih]) return SINONIM[bersih]!;
  const cocok = PROVINSI.filter((p) => {
    const n = p.nama.toLowerCase();
    return n === bersih || n.includes(bersih) || bersih.includes(n);
  });
  return cocok.length === 1 ? cocok[0]!.kode : null;
}
