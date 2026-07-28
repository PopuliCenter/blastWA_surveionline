// ===== Util =====
// Cari variabel {{n}} di teks, kembalikan jumlah variabel tertinggi (mis. {{1}} {{3}} → 3)
export function maxVar(text = "") {
  let max = 0;
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, parseInt(m[1], 10));
  return max;
}
// Ganti {{n}} dengan contoh nilai (atau placeholder bila kosong)
export function fillVars(text = "", params = []) {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const v = params[parseInt(n, 10) - 1];
    return v && v.trim() ? v : `[contoh ${n}]`;
  });
}
export function normalizeName(name = "") {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const CATEGORIES = [
  { value: "MARKETING", label: "Marketing — promosi, undangan, survei" },
  { value: "UTILITY", label: "Utility — notifikasi/transaksi" },
  { value: "AUTHENTICATION", label: "Authentication — kode OTP" },
];
export const LANGS = [
  { value: "id", label: "Indonesia (id)" },
  { value: "en_US", label: "English (en_US)" },
];
export const HEADER_TYPES = [
  { value: "none", label: "Tanpa header" },
  { value: "text", label: "Teks" },
  { value: "image", label: "Gambar / Foto" },
  { value: "document", label: "Dokumen (PDF dll.)" },
  { value: "video", label: "Video" },
];
export const STATUS_TONE = { draft: "default", submitted: "yellow", approved: "green", rejected: "red" };
export const STATUS_LABEL = { draft: "Draf", submitted: "Menunggu Meta", approved: "Disetujui", rejected: "Ditolak" };

// ===== Status ASLI di Meta (sumber kebenaran; `status` di atas hanya label lokal) =====
export const META_STATUS = {
  APPROVED: { label: "Disetujui Meta", tone: "green" },
  PENDING: { label: "Menunggu review", tone: "yellow" },
  IN_REVIEW: { label: "Sedang direview", tone: "yellow" },
  PENDING_DELETION: { label: "Menunggu dihapus", tone: "yellow" },
  REJECTED: { label: "Ditolak Meta", tone: "red" },
  PAUSED: { label: "Dijeda Meta", tone: "red" },
  DISABLED: { label: "Dinonaktifkan Meta", tone: "red" },
};
// Quality rating Meta (dari usage & feedback penerima).
export const META_QUALITY = {
  GREEN: { label: "Kualitas tinggi", tone: "green" },
  YELLOW: { label: "Kualitas sedang", tone: "yellow" },
  RED: { label: "Kualitas rendah", tone: "red" },
  UNKNOWN: { label: "Kualitas belum dinilai", tone: "default" },
};

// Ringkasan status Meta sebuah template untuk ditampilkan di UI.
// Membedakan 3 keadaan yang sebelumnya tercampur: belum disinkron / tak ada di Meta / status asli.
export function metaState(t) {
  if (!t.metaSyncedAt) return { key: "unsynced", label: "Belum disinkron", tone: "default" };
  if (!t.metaStatus) return { key: "missing", label: "Tidak ada di Meta", tone: "red" };
  const m = META_STATUS[t.metaStatus];
  return { key: t.metaStatus, label: m?.label || t.metaStatus, tone: m?.tone || "default" };
}
// Boleh dipakai broadcast HANYA bila Meta bilang APPROVED.
export const isSendable = (t) => t.metaStatus === "APPROVED";
export const USECASE_LABEL = {
  survei: "Blast Survei",
  rilis: "Rilis ke Media",
  acara: "Undangan Acara",
  lainnya: "Lainnya",
};

// ===== Contoh template siap-pakai (bisa diedit sebelum disimpan) =====
export const PRESETS = [
  {
    key: "survei",
    title: "Blast Survei",
    desc: "Mengajak responden ikut survei singkat.",
    icon: "survey",
    data: {
      name: "undangan_survei",
      category: "MARKETING",
      language: "id",
      useCase: "survei",
      headerType: "text",
      headerText: "Undangan Survei",
      headerMediaUrl: "",
      bodyText:
        "Halo {{1}}, kami dari {{2}} sedang mengadakan survei singkat (±3 menit). Pendapat Anda sangat berarti bagi kami.\n\nBalas *MULAI* untuk ikut serta, atau abaikan pesan ini bila sedang tidak berkenan.",
      footerText: "Balas BERHENTI untuk tidak menerima pesan lagi.",
      buttons: [
        { type: "QUICK_REPLY", text: "Mulai Survei" },
        { type: "QUICK_REPLY", text: "Tidak, terima kasih" },
      ],
      sampleParams: ["Bapak/Ibu", "Populi Center"],
      status: "draft",
    },
  },
  {
    key: "rilis",
    title: "Rilis Survei ke Media",
    desc: "Kirim siaran pers hasil survei + dokumen PDF.",
    icon: "doc",
    data: {
      name: "rilis_hasil_survei",
      category: "MARKETING",
      language: "id",
      useCase: "rilis",
      headerType: "document",
      headerText: "",
      headerMediaUrl: "https://contoh.com/rilis-survei.pdf",
      bodyText:
        "Yth. Rekan Media {{1}},\n\nBersama ini kami sampaikan rilis hasil survei *{{2}}* periode {{3}}. Dokumen lengkap terlampir pada pesan ini.\n\nUntuk wawancara atau konfirmasi data, silakan hubungi narahubung kami.",
      footerText: "Tim Media — Populi Center",
      buttons: [
        { type: "URL", text: "Unduh Rilis", url: "https://contoh.com/rilis-survei.pdf" },
        { type: "PHONE_NUMBER", text: "Hubungi Narahubung", phone: "+628123456789" },
      ],
      sampleParams: ["Redaksi", "Persepsi Publik terhadap Ekonomi", "Juni 2026"],
      status: "draft",
    },
  },
  {
    key: "acara",
    title: "Undangan Acara ke Media",
    desc: "Undang media ke konferensi pers/acara + foto.",
    icon: "image",
    data: {
      name: "undangan_acara_media",
      category: "MARKETING",
      language: "id",
      useCase: "acara",
      headerType: "image",
      headerText: "",
      headerMediaUrl: "https://contoh.com/undangan-acara.jpg",
      bodyText:
        "Yth. Rekan Media {{1}},\n\nKami mengundang Anda menghadiri *{{2}}* yang akan diselenggarakan pada:\n🗓️ {{3}}\n📍 {{4}}\n\nMohon konfirmasi kehadiran Anda. Terima kasih.",
      footerText: "Populi Center",
      buttons: [
        { type: "QUICK_REPLY", text: "Konfirmasi Hadir" },
        { type: "URL", text: "Detail Acara", url: "https://contoh.com/acara" },
      ],
      sampleParams: [
        "Redaksi",
        "Konferensi Pers Hasil Survei Nasional",
        "Jumat, 10 Juli 2026 • 10.00 WIB",
        "Kantor Populi Center, Jakarta",
      ],
      status: "draft",
    },
  },
];

export const blankTemplate = () => ({
  name: "",
  category: "MARKETING",
  language: "id",
  useCase: "lainnya",
  headerType: "none",
  headerText: "",
  headerMediaUrl: "",
  bodyText: "",
  footerText: "",
  buttons: [],
  sampleParams: [],
  status: "draft",
});
