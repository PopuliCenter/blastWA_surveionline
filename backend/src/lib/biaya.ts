// Perhitungan biaya pesan WhatsApp — MURNI, tanpa database dan tanpa jaringan.
// Pengumpulan datanya ada di routes/biaya.ts; di sini hanya aritmetikanya supaya bisa diuji.

export type Tarif = {
  mataUang: string;
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
  gratisServicePerBulan: number;
  // Angka yang DITULIS di invoice.
  pajakPersen: number;
  // Angka yang benar-benar DIKALIKAN. null/undefined = sama dengan pajakPersen.
  // Di Indonesia keduanya berbeda: PPN 12% dikenakan atas dasar pengenaan pajak 11/12
  // nilai, sehingga efektifnya 11% — persis seperti invoice Meta.
  pajakEfektifPersen?: number | null;
};

export type TarifBerversi = Tarif & { id: string; berlakuSejak: Date };

export type JumlahPesan = {
  marketing: number;
  utility: number;
  authentication: number;
  // Pesan service dipecah per BULAN KALENDER (kunci "YYYY-MM") karena jatah gratisnya
  // disetel ulang tiap bulan dan tidak diakumulasi. Menjumlahkannya lebih dulu lalu
  // mengurangi satu kali jatah akan salah untuk periode yang melintasi pergantian bulan.
  servicePerBulan: Record<string, number>;
};

// `kode` menyertai `label` supaya penyaji bisa menamai ulang komponennya tanpa mencocokkan
// teks Indonesia. Invoice ke klien ditulis dalam bahasa Inggris, dan pencocokan berbasis
// kalimat akan patah diam-diam begitu redaksi labelnya diubah di sini.
export type KodeBiaya = "marketing" | "utility" | "authentication" | "service";
export type BarisBiaya = { kode: KodeBiaya; label: string; jumlah: number; tarif: number; subtotal: number };

export type RincianBiaya = {
  mataUang: string;
  baris: BarisBiaya[];
  serviceTerkirim: number;
  serviceGratis: number;
  serviceDitagih: number;
  subtotal: number;
  marginPersen: number;
  margin: number;
  pajakPersen: number;
  pajakEfektifPersen: number;
  pajak: number;
  total: number;
};

// Pembulatan 2 desimal per baris, lalu dijumlahkan — praktik invoice yang lazim, dan
// mencegah selisih satuan terkecil antara jumlah baris dan totalnya.
function bulat2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Set tarif yang berlaku pada sebuah tanggal: yang berlakuSejak-nya paling akhir namun
// tidak melewati tanggal itu. null bila belum ada tarif yang berlaku saat itu — lebih baik
// menolak menghitung daripada memakai tarif yang belum berlaku.
export function pilihTarif<T extends { berlakuSejak: Date }>(daftar: readonly T[], tanggal: Date): T | null {
  let pilihan: T | null = null;
  for (const t of daftar) {
    if (t.berlakuSejak.getTime() > tanggal.getTime()) continue;
    if (!pilihan || t.berlakuSejak.getTime() > pilihan.berlakuSejak.getTime()) pilihan = t;
  }
  return pilihan;
}

// Kunci bulan kalender untuk pengelompokan jatah gratis.
export function kunciBulan(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Jatah gratis dipakai per bulan, bukan sekali untuk seluruh periode.
export function serviceGratisTerpakai(servicePerBulan: Record<string, number>, jatahPerBulan: number): number {
  const jatah = Math.max(0, Math.floor(jatahPerBulan));
  let total = 0;
  for (const n of Object.values(servicePerBulan)) total += Math.min(jatah, Math.max(0, n));
  return total;
}

export function hitungBiaya(input: {
  jumlah: JumlahPesan;
  tarif: Tarif;
  marginPersen?: number;
}): RincianBiaya {
  const { jumlah, tarif } = input;
  const marginPersen = Number.isFinite(input.marginPersen) ? Math.max(0, input.marginPersen!) : 0;

  const serviceTerkirim = Object.values(jumlah.servicePerBulan).reduce((a, b) => a + Math.max(0, b), 0);
  const serviceGratis = serviceGratisTerpakai(jumlah.servicePerBulan, tarif.gratisServicePerBulan);
  const serviceDitagih = Math.max(0, serviceTerkirim - serviceGratis);

  const baris: BarisBiaya[] = [];
  const tambah = (kode: KodeBiaya, label: string, n: number, t: number): void => {
    if (n > 0) baris.push({ kode, label, jumlah: n, tarif: t, subtotal: bulat2(n * t) });
  };
  tambah("marketing", "Pesan template — Marketing", jumlah.marketing, tarif.marketing);
  tambah("utility", "Pesan template — Utility", jumlah.utility, tarif.utility);
  tambah("authentication", "Pesan template — Authentication", jumlah.authentication, tarif.authentication);
  // Label menyebut jatah gratis HANYA bila memang ada yang dipotong. Dengan jatah 0,
  // "di luar jatah gratis" menyesatkan — seolah ada potongan yang tidak pernah terjadi.
  tambah(
    "service",
    serviceGratis > 0 ? "Pesan service (di luar jatah gratis)" : "Pesan service",
    serviceDitagih,
    tarif.service,
  );

  const subtotal = bulat2(baris.reduce((a, b) => a + b.subtotal, 0));
  // Margin dihitung dari subtotal biaya Meta, dan ditampilkan sebagai baris TERPISAH —
  // supaya di pembukuan tetap terlihat mana biaya pihak ketiga dan mana imbalan jasa.
  const margin = bulat2((subtotal * marginPersen) / 100);
  // Pajak dikenakan atas nilai yang ditagihkan ke klien (biaya + margin). Setel 0 bila
  // pajaknya diurus terpisah atau mengikuti invoice Meta apa adanya.
  //
  // Yang DITULIS dan yang DIKALIKAN sengaja dipisah. Invoice Meta untuk Indonesia menulis
  // "Tax (12%)" lalu menagih 11% dari subtotal, karena PPN 12% dikenakan atas dasar
  // pengenaan pajak 11/12 nilai. Memakai 12% penuh membuat angka pajaknya meleset sekitar
  // 9% dan invoice ke klien tidak lagi cocok dengan invoice Meta yang direkonsiliasi.
  const pajakPersen = Math.max(0, tarif.pajakPersen || 0);
  const pajakEfektifPersen =
    Number.isFinite(tarif.pajakEfektifPersen) && (tarif.pajakEfektifPersen as number) >= 0
      ? (tarif.pajakEfektifPersen as number)
      : pajakPersen;
  const pajak = bulat2(((subtotal + margin) * pajakEfektifPersen) / 100);

  return {
    mataUang: tarif.mataUang,
    baris,
    serviceTerkirim,
    serviceGratis,
    serviceDitagih,
    subtotal,
    marginPersen,
    margin,
    pajakPersen,
    pajakEfektifPersen,
    pajak,
    total: bulat2(subtotal + margin + pajak),
  };
}
