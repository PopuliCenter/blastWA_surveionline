// ===== Jembatan dialog konfirmasi =====
// Modul ini sengaja tanpa dependensi UI supaya ui.jsx bisa memanggil confirmDialog
// tanpa membuat impor melingkar dengan confirm.jsx (yang mengimpor komponen dari ui.jsx).
//
// confirm.jsx memasang host tunggal lewat registerConfirm(); pemakai memanggil confirmDialog().

let openRef = null; // opener yang didaftarkan <ConfirmHost/>
let pending = 0; // jumlah dialog yang sedang menunggu jawaban

export function registerConfirm(fn) {
  openRef = fn;
  return () => {
    openRef = null;
  };
}

// True bila ada dialog konfirmasi terbuka. Dipakai Modal agar satu tekan Esc
// tidak sekaligus membatalkan konfirmasi dan menutup modal di belakangnya.
export function isConfirmOpen() {
  return pending > 0;
}

export function confirmDialog(opts) {
  const options = typeof opts === "string" ? { message: opts } : opts || {};
  return new Promise((resolve) => {
    // Fallback aman bila host belum termuat → jangan sampai aksi terblokir.
    if (!openRef) {
      resolve(window.confirm(options.message || "Lanjutkan?"));
      return;
    }
    pending++;
    openRef({
      options,
      resolve: (v) => {
        pending = Math.max(0, pending - 1);
        resolve(v);
      },
    });
  });
}
