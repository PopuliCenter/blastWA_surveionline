// ===== Parameter pagination daftar (MURNI — tanpa I/O, mudah diuji) =====
//
// Dipakai rute daftar kontak & percakapan. Nilainya datang dari query string, jadi
// tidak boleh dipercaya: halaman negatif, angka ngawur, atau bukan-angka semuanya
// harus jatuh ke nilai yang aman.

// Pilihan baris per halaman di halaman Kontak — sesuai permintaan pemakai.
export const CONTACT_PAGE_SIZES = [100, 500, 1000, 1500] as const;

// Inbox Chat: ukuran halamannya tidak dipilih dari UI, tapi tetap dibatasi daftar-izin.
export const CONVO_PAGE_SIZES = [100, 200, 500] as const;

export function parsePage(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// pageSize di luar daftar pilihan jatuh ke bawaan — SENGAJA bukan dibulatkan ke yang
// terdekat, supaya query string rakitan tangan tidak bisa memesan jutaan baris.
export function parsePageSize(raw: unknown, allowed: readonly number[], fallback: number): number {
  const n = Math.trunc(Number(raw));
  return allowed.includes(n) ? n : fallback;
}
