// ===== Penyaring nama profil WhatsApp (push name) =====
//
// Nama profil itu teks yang diatur SENDIRI oleh pemilik nomor. Tidak ada yang
// memverifikasinya, jadi jangan pernah dipakai sebagai bukti identitas maupun sebagai
// variabel pembobot survei (nama tak punya patokan populasi). Gunanya satu: menyapa
// responden dengan namanya, yang menaikkan respons tanpa memakan satu pertanyaan.
//
// Isi di lapangan bermacam-macam: kosong, satu titik, emoji saja, nama toko, atau
// kalimat promosi. Yang jelas bukan nama disaring di sini agar tidak masuk
// Contact.name — sebab dari situ ia mengalir ke variabel template blast
// (blastService: `c.name ?? "Pelanggan"`), dan sapaan yang ngawur lebih buruk
// daripada sapaan generik.
//
// Sengaja MENOLAK, bukan memotong, teks yang kelewat panjang: memotong kalimat
// promosi di tengah menghasilkan sapaan rusak, sedangkan menolaknya membuat blast
// jatuh kembali ke "Pelanggan" yang selalu aman.

// Nama Indonesia berikut gelar bisa panjang ("Dr. Hj. Siti Nurhaliza binti Abdullah"
// = 37 karakter), jadi plafonnya dilonggarkan. Di atas ini hampir pasti bukan nama.
export const MAX_PROFILE_NAME = 60;

export function cleanProfileName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;

  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return undefined;
  if (name.length > MAX_PROFILE_NAME) return undefined;

  // Wajib ada minimal satu huruf (huruf apa pun, termasuk non-Latin). Ini sekaligus
  // menyaring nama berisi emoji saja, tanda baca saja, dan nomor telepon sebagai nama.
  if (!/\p{L}/u.test(name)) return undefined;

  return name;
}
