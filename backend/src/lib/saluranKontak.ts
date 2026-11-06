// ===== Alamat kontak per saluran — aturan MURNI =====
//
// Kontak Instagram disimpan di tabel Contact yang sama dengan kontak WhatsApp, dengan
// `phone` = "ig:<IGSID>". Contact.phone wajib dan unik, dan dipakai di puluhan tempat
// (sesi survei, sekali-isi, kuota, Auto Reply, Agen AI, Bot diam, Chat, Sheets). Dengan
// alamat berawalan, semua itu langsung berlaku untuk Instagram tanpa membuat kolomnya
// boleh kosong — dan awalannya menjamin IGSID tidak pernah bertabrakan dengan nomor HP.
//
// Aturan yang wajib dipegang: alamat IG TIDAK PERNAH melewati normalizePhone. Penormal
// membuang awalan "ig:" dan menambah "62" pada ID yang diawali 8, sehingga ID Instagram
// berubah menjadi "nomor" yang bisa ikut blast WhatsApp.

export const ALAMAT_IG = "ig:";

export type Saluran = "whatsapp" | "instagram";

// Awalan dikenali tanpa peduli huruf besar dan spasi di depan: "IG:123" atau " ig:123" yang
// lolos sebagai "bukan Instagram" akan dinormalkan menjadi nomor HP palsu "123".
const AWALAN_IG = /^\s*ig:/i;

// IGSID polos → alamat kontak kanonik (huruf kecil). Alamat yang sudah berawalan ditulis
// ulang, supaya pemanggil tidak perlu tahu bentuk mana yang ia pegang.
export function alamatInstagram(igsid: string): string {
  return `${ALAMAT_IG}${idInstagram(igsid)}`;
}

export function apakahInstagram(phone: string | null | undefined): boolean {
  return typeof phone === "string" && AWALAN_IG.test(phone);
}

// Alamat → IGSID polos (untuk memanggil API Instagram). Masukan tanpa awalan dianggap
// sudah polos.
export function idInstagram(phone: string): string {
  return String(phone ?? "")
    .replace(AWALAN_IG, "")
    .trim();
}

export function saluranDari(phone: string | null | undefined): Saluran {
  return apakahInstagram(phone) ? "instagram" : "whatsapp";
}
