// Kuota responden — MURNI, tanpa database. Pengambilan angkanya ada di services/kuotaSurvei.ts.
//
// Dua tingkat, dan keduanya diperiksa:
//   • global   — batas untuk seluruh survei (Survey.targetResponden)
//   • provinsi — batas per provinsi (KuotaProvinsi), hanya bila provinsi responden DIKETAHUI
//
// Yang dihitung adalah responden SELESAI, bukan yang baru mulai. Formulir yang dikirim lalu
// tidak diisi tidak boleh memakan jatah orang lain — kalau dihitung, satu gelombang blast
// yang separuhnya diabaikan akan menutup survei padahal datanya belum terkumpul.

export type BatasKuota = {
  targetGlobal: number | null; // null = tanpa batas
  terisiGlobal: number;
  targetProvinsi: number | null; // null = provinsi tak diketahui ATAU tak diberi kuota
  terisiProvinsi: number;
};

export type HasilKuota =
  | { boleh: true }
  | { boleh: false; alasan: "global" | "provinsi"; target: number; terisi: number };

function penuh(target: number | null, terisi: number): boolean {
  return typeof target === "number" && target >= 0 && terisi >= target;
}

export function periksaKuota(b: BatasKuota): HasilKuota {
  // Global diperiksa LEBIH DULU: bila survei sudah penuh seluruhnya, alasan per provinsi
  // tidak lagi relevan dan pesan ke responden pun jadi membingungkan.
  if (penuh(b.targetGlobal, b.terisiGlobal))
    return { boleh: false, alasan: "global", target: b.targetGlobal as number, terisi: b.terisiGlobal };
  if (penuh(b.targetProvinsi, b.terisiProvinsi))
    return { boleh: false, alasan: "provinsi", target: b.targetProvinsi as number, terisi: b.terisiProvinsi };
  return { boleh: true };
}

// Sisa jatah — null berarti tanpa batas. Tidak pernah negatif: kelebihan karena pengisian
// berbarengan tetap ditampilkan sebagai 0, bukan angka minus yang membingungkan di layar.
export function sisaKuota(target: number | null, terisi: number): number | null {
  if (typeof target !== "number" || target < 0) return null;
  return Math.max(0, target - terisi);
}

// Persentase keterisian untuk bilah kemajuan. null bila tanpa batas.
export function persenKuota(target: number | null, terisi: number): number | null {
  if (typeof target !== "number" || target <= 0) return null;
  return Math.min(100, Math.round((terisi / target) * 100));
}

// ===== Apakah seluruh survei yang berjalan sudah penuh? =====
//
// Dipakai untuk menghentikan Agen AI saat tak ada lagi responden yang bisa diterima. Tiap
// balasan AI adalah pesan service berbayar; begitu kuota penuh, balasan itu tidak lagi
// membawa satu pun responden baru — hanya tagihan.
//
// Survei TANPA target tidak pernah dianggap penuh: batas yang tidak disetel berarti tak
// terbatas, bukan nol. Dan bila tak ada survei yang berjalan sama sekali, hasilnya juga
// false — Agen AI bisa saja dipakai untuk keperluan di luar survei, dan mematikannya
// karena tidak ada survei akan menghentikan sesuatu yang tidak diminta berhenti.
export type SurveiKuotaRingkas = { target: number | null; terisi: number };

export function semuaSurveiPenuh(daftar: readonly SurveiKuotaRingkas[]): boolean {
  if (!daftar.length) return false;
  return daftar.every((s) => s.target !== null && s.target >= 0 && s.terisi >= s.target);
}
