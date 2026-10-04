// Ekspor kontak → berkas .xlsx/.csv. xlsx (SheetJS) dimuat lewat dynamic import saat
// ekspor saja, sama seperti exportSurvey.js — pustakanya 490 KB dan tak perlu ikut
// membebani muatan awal halaman Kontak.

// Atribut hasil impor berbeda-beda per segmen, jadi kolomnya dikumpulkan dari seluruh
// baris — bukan dari baris pertama. Satu kontak yang punya kolom tambahan tidak boleh
// membuat kolom itu hilang bagi semua.
export function kolomAtribut(contacts) {
  const set = new Set();
  for (const c of contacts) {
    const a = c?.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) for (const k of Object.keys(a)) set.add(k);
  }
  return [...set].sort();
}

// Excel memperlakukan teks berawalan = + - @ sebagai rumus. Nomor telepon "+62…" karena
// itu bisa terbaca sebagai rumus dan rusak — atau, pada berkas yang dibuka orang lain,
// jadi jalan masuk injeksi rumus. Diawali tanda kutip tunggal agar tetap teks.
function aman(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function buildContactRows(contacts, { date = new Date() } = {}) {
  void date;
  const atribut = kolomAtribut(contacts);
  const header = ["Nomor", "Nama", "Berlangganan", "Sumber consent", "Opt-out", "Dibuat", ...atribut];
  const rows = contacts.map((c) => [
    aman(c.phone),
    aman(c.name ?? ""),
    c.subscribed ? "Ya" : "Tidak",
    aman(c.consentSource ?? ""),
    c.optOutAt ? new Date(c.optOutAt).toISOString().slice(0, 10) : "",
    c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "",
    ...atribut.map((k) => aman(c.attributes?.[k] ?? "")),
  ]);
  return { header, rows };
}

export function exportKontakFilename(format, jumlah, date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
  return `kontak-${jumlah}-${stamp}.${format === "csv" ? "csv" : "xlsx"}`;
}

export async function exportContacts(contacts, format = "xlsx") {
  const XLSX = await import("xlsx");
  const { header, rows } = buildContactRows(contacts);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kontak");
  const name = exportKontakFilename(format, contacts.length);
  if (format === "csv") XLSX.writeFile(wb, name, { bookType: "csv" });
  else XLSX.writeFile(wb, name);
  return name;
}
