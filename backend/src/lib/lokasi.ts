// ===== Lokasi responden — aturan MURNI =====
//
// Alurnya: setelah responden SELESAI dan diterima, bot mengirim pesan dengan tombol
// "Kirim lokasi" (Meta: interactive.type = "location_request_message"). Bila responden
// membagikan lokasi, webhook mengirim pesan type "location" berisi latitude/longitude —
// bentuknya sama dengan lokasi yang dibagikan sendiri lewat lampiran.
//
// WhatsApp Flows tidak punya komponen lokasi, jadi untuk survei Flow pun permintaan ini
// selalu pesan TERPISAH setelah formulir.
//
// Prinsip privasi (UU No. 27/2022): titik GPS mentah tidak pernah disimpan. Provinsi
// dihitung dari titik aslinya, lalu yang disimpan hanya titik yang dibulatkan ke dua
// desimal — kira-kira 1,1 km di ekuator: cukup untuk peta sebaran, tidak menunjuk rumah.
// Log webhook dan payload pesan ikut disaring dengan aturan yang sama.

export type Koordinat = { lat: number; lng: number };

export const DESIMAL_KOORDINAT = 2;

export function bulatkanKoordinat(k: Koordinat): Koordinat {
  const f = 10 ** DESIMAL_KOORDINAT;
  return { lat: Math.round(k.lat * f) / f, lng: Math.round(k.lng * f) / f };
}

// Koordinat dari isian vendor: angka atau teks angka, di rentang bumi yang sah.
export function koordinatDari(lat: unknown, lng: unknown): Koordinat | null {
  const a = typeof lat === "number" ? lat : Number(lat);
  const b = typeof lng === "number" ? lng : Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  // (0, 0) di Teluk Guinea adalah tanda "tidak ada lokasi" pada banyak klien, bukan titik nyata.
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

// Nama kolom koordinat yang dikenali — SATU daftar untuk pembaca (koordinatDariObjek) dan
// penyaring (saringLokasi). Dua daftar terpisah pasti berselisih: bentuk yang diterima
// pembaca tapi tak dikenal penyaring berarti titik mentahnya tersimpan apa adanya di log.
//   Meta: location { latitude, longitude }
//   Baileys: locationMessage { degreesLatitude, degreesLongitude }
//   Qontak: bentuknya tidak terdokumentasi — beberapa ejaan umum ikut dikenali.
const KUNCI_LINTANG = ["latitude", "lat", "degreesLatitude"] as const;
const KUNCI_BUJUR = ["longitude", "lng", "long", "degreesLongitude"] as const;
// Rincian yang bisa menunjuk tempat secara persis, atau tidak dibutuhkan sama sekali.
const DIBUANG = ["name", "address", "url", "comment", "jpegThumbnail", "caption"];

const kunciPertama = (o: Record<string, unknown>, daftar: readonly string[]) => daftar.find((k) => k in o);

// Koordinat dari objek lokasi vendor dengan ejaan kolom mana pun yang dikenali.
export function koordinatDariObjek(o: unknown): Koordinat | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const kLat = kunciPertama(r, KUNCI_LINTANG);
  const kLng = kunciPertama(r, KUNCI_BUJUR);
  return kLat && kLng ? koordinatDari(r[kLat], r[kLng]) : null;
}

const bulat = (x: unknown): unknown => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  if (!Number.isFinite(n)) return x;
  const f = 10 ** DESIMAL_KOORDINAT;
  return Math.round(n * f) / f;
};

// Salinan payload yang lokasinya sudah disaring: koordinat dibulatkan, nama tempat dan
// alamat dibuang. Dipakai sebelum payload webhook ditulis ke WebhookLog maupun
// Message.payload — kalau tidak, titik GPS mentah tetap tersimpan 30 hari di log meskipun
// kolom lokasi di respons sudah dibulatkan.
export function saringLokasi<T>(payload: T): T {
  const jalan = (v: unknown): unknown => {
    // Objek dengan toJSON (pesan protobuf Baileys, Buffer, Date) diubah lebih dulu, persis
    // seperti yang dilakukan Prisma saat menulis kolom Json. Tanpa ini, bytes di pesan
    // Baileys tertelusuri sebagai {"0":..,"1":..} dan payload membengkak ±6 kali.
    if (v && typeof v === "object" && typeof (v as { toJSON?: unknown }).toJSON === "function")
      v = (v as { toJSON: () => unknown }).toJSON();
    if (Array.isArray(v)) return v.map(jalan);
    // Larik biner tanpa toJSON (Uint8Array) dibiarkan apa adanya — tidak mungkin lokasi.
    if (!v || typeof v !== "object" || ArrayBuffer.isView(v)) return v;
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = jalan(x);
    // Objek lokasi = punya kolom lintang DAN kolom bujur, ejaan apa pun. Semua kolom
    // koordinatnya dibulatkan, termasuk ejaan kembar (mis. lat dan latitude sekaligus).
    if (kunciPertama(o, KUNCI_LINTANG) && kunciPertama(o, KUNCI_BUJUR)) {
      for (const k of [...KUNCI_LINTANG, ...KUNCI_BUJUR]) if (k in o) o[k] = bulat(o[k]);
      for (const d of DIBUANG) delete o[d];
    }
    return o;
  };
  return jalan(payload) as T;
}

// Teks bawaan permintaan lokasi. Ditulis jujur: disebutkan untuk apa lokasinya dipakai,
// seberapa teliti disimpan, dan bahwa permintaan ini boleh diabaikan — persetujuan atas
// lokasi harus terpisah dan sukarela (UU PDP Pasal 22), bukan ikut tersirat dari mengisi
// survei.
export const PESAN_MINTA_LOKASI_BAWAAN =
  "Satu langkah lagi, boleh dilewati: bagikan lokasi Anda saat ini dengan menekan tombol di bawah. " +
  "Lokasi hanya dipakai untuk memastikan sebaran wilayah responden dan disimpan dengan ketelitian sekitar 1 km. " +
  "Abaikan pesan ini bila Anda tidak bersedia.";

// Cadangan bila pesan bertombol ditolak vendor: petunjuk berbagi lewat lampiran.
export const PETUNJUK_LOKASI_TANPA_TOMBOL = "Caranya: tekan 📎 (lampiran), pilih Lokasi, lalu Kirim lokasi saat ini.";

export const TERIMA_KASIH_LOKASI = "Terima kasih, lokasi Anda sudah kami terima. 🙏";

// Permintaan lokasi berlaku 24 jam — sama dengan jendela layanan WhatsApp. Lokasi yang
// datang sesudahnya tidak lagi dianggap jawaban atas permintaan itu.
export const BERLAKU_PERMINTAAN_MS = 24 * 60 * 60 * 1000;

export type StatusLokasi =
  | "tidak-diminta"
  | "belum-dibagikan"
  | "belum-diperiksa"
  | "di-luar-batas"
  | "sesuai"
  | "tidak-sesuai"
  | "tanpa-pembanding";

// Kesesuaian lokasi dengan provinsi yang DISEBUT responden (SurveyResponse.kodeProvinsi).
//
// batasTerpasang = data batas provinsi tersedia. Tanpanya, lokasi yang provinsinya kosong
// BELUM diperiksa — bukan "di luar batas": label itu membuat responden di Bandung terbaca
// seolah berada di laut atau luar negeri.
export function statusLokasi(
  r: {
    lokasiDimintaPada: Date | string | null;
    lokasiDiterimaPada: Date | string | null;
    kodeProvinsiLokasi: string | null;
    kodeProvinsi: string | null;
  },
  batasTerpasang = true,
): StatusLokasi {
  if (!r.lokasiDimintaPada && !r.lokasiDiterimaPada) return "tidak-diminta";
  if (!r.lokasiDiterimaPada) return "belum-dibagikan";
  // Titik di laut atau di luar negeri — atau data batasnya belum ada untuk memeriksanya.
  if (!r.kodeProvinsiLokasi) return batasTerpasang ? "di-luar-batas" : "belum-diperiksa";
  if (!r.kodeProvinsi) return "tanpa-pembanding";
  return r.kodeProvinsiLokasi === r.kodeProvinsi ? "sesuai" : "tidak-sesuai";
}

export const LABEL_STATUS_LOKASI: Record<StatusLokasi, string> = {
  "tidak-diminta": "",
  "belum-dibagikan": "Tidak dibagikan",
  "belum-diperiksa": "Provinsi belum dapat ditentukan",
  "di-luar-batas": "Di luar batas provinsi",
  sesuai: "Sesuai",
  "tidak-sesuai": "Beda provinsi",
  "tanpa-pembanding": "Provinsi tidak ditanyakan",
};
