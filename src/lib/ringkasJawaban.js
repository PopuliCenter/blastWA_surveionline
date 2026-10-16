// Mengubah jawaban satu pertanyaan menjadi distribusi untuk grafik Laporan — MURNI.
//
// Dulu hanya pilihan tunggal, ya/tidak, dan rating yang digambar sebagai grafik. Wilayah,
// pilihan ganda, dan persetujuan jatuh ke mode "contoh jawaban": delapan baris mentah
// ("Jawa Barat (32)", "Jawa Barat (32)", …) disusul "…dan 409 jawaban lain" — tidak bisa
// dibaca sebagai sebaran sama sekali, padahal provinsi justru yang paling sering ditanyakan.

import { bersihkanKodeWilayah } from "./exportSurvey";

// [[label, jumlah], …] urut dari yang terbanyak.
export function tally(values) {
  const m = new Map();
  values.forEach((v) => {
    const k = String(v);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// "Kab. Bandung, Jawa Barat (32.04)" → "Jawa Barat"; "Jawa Barat (32)" → "Jawa Barat".
// Jawaban tingkat kabupaten/kota selalu ditulis "<kab/kota>, <provinsi> (<kode>)".
export function provinsiDariJawaban(v) {
  const b = bersihkanKodeWilayah(String(v));
  const i = b.lastIndexOf(", ");
  return i >= 0 ? b.slice(i + 2) : b;
}

// Distribusi Wilayah: selalu per provinsi; per kabupaten/kota juga bila jawabannya sampai
// tingkat itu. Kode resmi dibuang — sama seperti di berkas ekspor.
export function distribusiWilayah(values) {
  const bersih = values.map((v) => bersihkanKodeWilayah(String(v)));
  const adaKabKota = bersih.some((v) => v.includes(", "));
  return {
    provinsi: tally(values.map(provinsiDariJawaban)),
    kabKota: adaKabKota ? tally(bersih.filter((v) => v.includes(", "))) : null,
  };
}

// Pilihan ganda (boleh lebih dari satu) disimpan sebagai pilihan-pilihan yang digabung ", ".
// Dihitung PER PILIHAN, dicocokkan ke daftar pilihan pertanyaan — bukan dipecah di setiap
// koma, karena teks pilihan itu sendiri bisa berkoma ("Harga, kualitas").
// Persentasenya terhadap jumlah responden yang menjawab, jadi totalnya bisa melebihi 100%.
export function distribusiPilihanGanda(q, values) {
  const pilihan = Array.isArray(q?.options?.choices) ? q.options.choices.map(String) : [];
  const m = new Map();
  const tambah = (k) => m.set(k, (m.get(k) || 0) + 1);
  for (const v of values) {
    const s = `, ${String(v)}, `;
    const cocok = pilihan.filter((o) => s.includes(`, ${o}, `));
    if (cocok.length) cocok.forEach(tambah);
    // Tanpa daftar pilihan (atau jawaban di luar daftar): pecah apa adanya.
    else
      String(v)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach(tambah);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// Nilai jawaban untuk tabulasi silang: Wilayah tanpa kode resminya.
export const nilaiTampil = (q, v) => (q?.type === "wilayah" ? bersihkanKodeWilayah(String(v)) : String(v));
