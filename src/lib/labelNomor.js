// Tampilan "nomor" kontak di layar.
//
// Kontak Instagram disimpan di tabel kontak yang sama dengan alamat `ig:<IGSID>` di kolom
// nomor (lihat backend/src/lib/saluranKontak.ts): mesin survei, chat, dan Sheets jadi
// berlaku apa adanya. Tapi IGSID adalah angka panjang tanpa makna bagi operator, dan
// sekilas mirip nomor HP — padahal kontak ini TIDAK bisa ditelepon atau di-blast. Maka di
// layar ia ditandai jelas sebagai Instagram. Hanya tampilan: data yang dikirim ke API dan
// ekspor tetap memakai alamat aslinya, karena alamat itulah kunci yang stabil.

export const ALAMAT_IG = "ig:";

export const apakahInstagram = (phone) => typeof phone === "string" && phone.startsWith(ALAMAT_IG);

// Username Instagram ("@siti.ig") didahulukan bila diketahui: itulah yang dikenali operator
// dan yang bisa dicari di aplikasi Instagram. Disimpan tanpa "@" (Contact.igUsername).
export const labelUsername = (igUsername) => {
  const u = typeof igUsername === "string" ? igUsername.trim().replace(/^@+/, "") : "";
  return u ? `@${u}` : "";
};

// Tanpa username: enam digit terakhir ID cukup untuk membedakan dua kontak IG tanpa nama di
// daftar yang sama, tanpa memenuhi baris dengan 17 digit yang tak akan dibaca siapa pun.
export function labelNomor(phone, igUsername) {
  const username = labelUsername(igUsername);
  if (username) return username;
  if (!apakahInstagram(phone)) return phone ?? "";
  const id = phone.slice(ALAMAT_IG.length);
  return id ? `Instagram · …${id.slice(-6)}` : "Instagram";
}

// Nama untuk judul baris/percakapan: nama kontak, atau label nomor bila belum bernama.
export const namaAtauNomor = (c) => c?.name || labelNomor(c?.phone, c?.igUsername);
