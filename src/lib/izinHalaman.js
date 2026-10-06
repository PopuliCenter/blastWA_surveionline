// Aturan halaman mana yang boleh dibuka tiap peran.
//
// Berdiri sendiri dari PopuliApp supaya bisa diuji tanpa menarik seluruh aplikasi — ini
// aturan izin, dan aturan izin yang tidak diuji adalah aturan izin yang pelan-pelan
// meleset tanpa ada yang tahu.

// Halaman yang boleh dibuka peran "viewer" — DAFTAR-IZIN, bukan daftar-larangan:
// menu baru otomatis tertutup untuk viewer sampai sengaja dimasukkan ke sini.
// Backend sudah menolak semua metode pengubah data untuk viewer (requireWriter),
// jadi ini lapis kedua: menghilangkan menu & tombol yang memang tak akan berhasil,
// supaya tak ada yang mengklik lalu kebingungan dapat galat.
export const VIEWER_PAGES = new Set(["dashboard", "contacts", "chat", "reports"]);

// Halaman yang hanya boleh dibuka superadmin. Isinya memegang KUNCI atau UANG: kredensial
// vendor WhatsApp, kunci service account Google beserta tujuan ekspor data responden, serta
// tarif, margin, dan invoice ke klien.
//
// Daftar ini hanya menyembunyikan menu dan mencegah pendaratan. Pembatas sebenarnya ada di
// server (requireSuperadmin): endpoint-nya tetap bisa dipanggil langsung dengan token admin
// yang sah, dan kredensial Meta adalah hal paling berharga di aplikasi ini.
export const SUPERADMIN_PAGES = new Set(["admin", "log", "wa-account", "sheets", "invoice"]);

export const canSeePage = (role, id) =>
  (role !== "viewer" || VIEWER_PAGES.has(id)) && (!SUPERADMIN_PAGES.has(id) || role === "superadmin");
