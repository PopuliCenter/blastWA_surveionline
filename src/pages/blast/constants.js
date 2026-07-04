// Simulasi biaya kirim (perkiraan). Tarif per pesan bisa diedit & disimpan (localStorage),
// karena tarif resmi Meta berubah & berbeda per negara.
export const RATE_KEY = "populi.waRates";
export const DEFAULT_RATES = { marketing: 800, utility: 350, authentication: 300 }; // Rp/pesan (perkiraan Indonesia)
export const CAT_LABEL = {
  marketing: "Marketing (promosi/undangan/survei)",
  utility: "Utility (notifikasi/transaksi)",
  authentication: "Authentication (OTP)",
};
export const rupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

export function loadRates() {
  try {
    const r = JSON.parse(localStorage.getItem(RATE_KEY));
    if (r && typeof r === "object") return { ...DEFAULT_RATES, ...r };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_RATES };
}
