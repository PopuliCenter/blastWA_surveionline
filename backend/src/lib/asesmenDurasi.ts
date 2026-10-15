// ===== Asesmen durasi pengisian — aturan MURNI =====
//
// Lama pengisian adalah petunjuk mutu jawaban yang murah dan sudah ada datanya: respons
// yang selesai dalam hitungan detik hampir pasti diisi asal-asalan, sedangkan yang
// menggantung berjam-jam biasanya ditinggal lalu dilanjutkan.
//
// Aturannya bisa diatur per survei (Survey.aturanDurasi), karena lama yang wajar bergantung
// pada panjang instrumennya. Bentuknya sederhana dan tidak mungkin berlubang:
//
//   batas:      [{ sampai: 3, label: "Terlalu cepat" }, { sampai: 10, label: "Normal" }]
//   selebihnya: "Lambat"
//
// dibaca "sampai 3 menit → Terlalu cepat; sampai 10 menit → Normal; selebihnya → Lambat".
// Setiap durasi jatuh ke tepat satu label: batas pertama yang belum terlampaui, atau
// "selebihnya".
//
// DIBANDINGKAN DENGAN ANGKA YANG DITAMPILKAN. Kolom "Durasi (menit)" dibulatkan ke satu
// desimal, dan labelnya diputuskan dari angka bulat itu juga — kalau tidak, baris bertulisan
// "3,0 menit" bisa berlabel "Aman" (aslinya 3,04) sementara baris "3,0" lain berlabel
// "Terlalu cepat". Kolom penilaian yang tak cocok dengan angka di sebelahnya tidak bisa
// diaudit.
//
// Kembaran persisnya ada di src/lib/exportSurvey.js (frontend tidak berbagi modul dengan
// backend); backend/test/asesmenDurasi.test.ts membandingkan keduanya langsung.

export type BatasDurasi = { sampai: number; label: string };
export type AturanDurasi = { batas: BatasDurasi[]; selebihnya: string };

export const ATURAN_DURASI_BAWAAN: AturanDurasi = {
  batas: [
    { sampai: 2, label: "Terlalu cepat" },
    { sampai: 10, label: "Normal" },
    { sampai: 30, label: "Lambat" },
  ],
  selebihnya: "Terlalu lama",
};

export const MAKS_BATAS_DURASI = 9;
export const MAKS_LABEL_DURASI = 40;

// Menit pengisian dibulatkan ke satu desimal — angka yang ditulis ke kolom "Durasi (menit)".
export const bulatkanMenit = (menit: number): number => Math.round(menit * 10) / 10;

// Batas menit dari isian: angka, atau teks dengan koma ATAU titik desimal ("2,5" = "2.5").
// Kolom angka bawaan peramban tidak mengenali koma di banyak lokal — "2,5" sampai sebagai
// isian kosong — jadi penyunting memakai kolom teks, dan teksnya dibaca di sini.
// Teks kosong = NaN, bukan 0 (Number("") bernilai 0 dan akan lolos sebagai batas sah).
//
// "2:30" juga diterima sebagai MENIT:DETIK = 2,5 menit. Orang yang bermaksud "2 menit 30
// detik" wajar mengetik 2:30 — atau 2,30, yang berarti 2,3 menit (2 menit 18 detik); karena
// itu penyunting selalu menuliskan arti isiannya dalam menit dan detik.
export function menitDari(v: unknown): number {
  if (typeof v === "number") return v;
  const t = typeof v === "string" ? v.trim() : "";
  const md = /^(\d+)\s*:\s*(\d{1,2})$/.exec(t);
  if (md) return Number(md[2]) < 60 ? Number(md[1]) + Number(md[2]) / 60 : NaN;
  const d = t.replace(",", ".");
  return d === "" ? NaN : Number(d);
}

// "1 menit 54 detik" — durasi yang bisa dibaca tanpa menghitung. Kolom "Durasi (menit)"
// berupa menit DESIMAL (1,9 = 1 menit 54 detik, bukan 1 menit 90 detik) supaya bisa
// diurutkan dan dirata-ratakan; kolom ini menuliskan arti angka itu.
export function formatLamaPengisian(menit: number | null): string {
  if (menit === null || !Number.isFinite(menit) || menit < 0) return "";
  const total = Math.round(menit * 60);
  const jam = Math.floor(total / 3600);
  const mnt = Math.floor((total % 3600) / 60);
  const dtk = total % 60;
  const bagian = [jam ? `${jam} jam` : "", mnt ? `${mnt} menit` : "", dtk ? `${dtk} detik` : ""].filter(Boolean);
  return bagian.length ? bagian.join(" ") : "0 detik";
}

// Kesalahan pada aturan, atau null bila sah. Dipakai validasi simpan (server) dan saat
// membaca nilai tersimpan: aturan yang rusak tidak boleh diam-diam menghasilkan label aneh.
export function galatAturanDurasi(a: unknown): string | null {
  if (!a || typeof a !== "object") return "Aturan asesmen durasi tidak terbaca.";
  const { batas, selebihnya } = a as { batas?: unknown; selebihnya?: unknown };
  if (!Array.isArray(batas) || !batas.length) return "Isi paling sedikit satu batas menit.";
  if (batas.length > MAKS_BATAS_DURASI) return `Paling banyak ${MAKS_BATAS_DURASI} batas.`;
  let sebelumnya = 0;
  for (const b of batas as { sampai?: unknown; label?: unknown }[]) {
    const n = menitDari(b?.sampai);
    if (!Number.isFinite(n) || n <= 0) return "Setiap batas harus berupa menit lebih dari 0.";
    if (n <= sebelumnya) return "Batas menit harus makin besar dari atas ke bawah.";
    const e = galatLabel(b?.label);
    if (e) return e;
    sebelumnya = n;
  }
  return galatLabel(selebihnya);
}

function galatLabel(label: unknown): string | null {
  const t = typeof label === "string" ? label.trim() : "";
  if (!t) return "Setiap label asesmen harus diisi.";
  if (t.length > MAKS_LABEL_DURASI) return `Label asesmen paling panjang ${MAKS_LABEL_DURASI} karakter.`;
  // Diawali = + - @ dibaca sebagai rumus saat berkas CSV dibuka di Excel ("-Aman" tampil #NAME?).
  if (/^[=+\-@]/.test(t)) return "Label asesmen tidak boleh diawali =, +, -, atau @.";
  return null;
}

// Aturan yang berlaku: milik survei bila sah, selain itu bawaan.
export function aturanBerlaku(a: unknown): AturanDurasi {
  return a && !galatAturanDurasi(a) ? (a as AturanDurasi) : ATURAN_DURASI_BAWAAN;
}

// Label asesmen untuk sebuah durasi. "" bila durasinya tak dapat dihitung — "tidak
// diketahui" bukan "terlalu cepat", dan menebaknya mencemari kolom yang dibuat untuk
// membersihkan data.
export function asesmenDurasi(menit: number | null, aturan?: unknown): string {
  if (menit === null || !Number.isFinite(menit)) return "";
  const a = aturanBerlaku(aturan);
  const m = bulatkanMenit(menit);
  for (const b of a.batas) if (m <= menitDari(b.sampai)) return b.label.trim();
  return a.selebihnya.trim();
}

// ===== Kode wilayah di ekspor =====
//
// Jawaban pertanyaan Wilayah DISIMPAN dengan kode resminya — "Jawa Barat (32)",
// "Kab. Bandung, Jawa Barat (32.04)" — karena kode itulah yang dipakai kuota provinsi dan
// yang membedakan nama kembar. Di ekspor, kode itu derau bagi pembaca dan mengganggu
// pengolahan (mencocokkan "Jawa Barat" ke data lain gagal karena "(32)"-nya).
//
// Hanya untuk pertanyaan bertipe Wilayah: jawaban teks bebas yang kebetulan berakhiran
// angka dalam kurung ("Anak (2)") tidak boleh ikut terpotong.
export function bersihkanKodeWilayah(nilai: string): string {
  return nilai.replace(/\s*\(\d{2}(?:\.\d{2})?\)\s*$/, "");
}
