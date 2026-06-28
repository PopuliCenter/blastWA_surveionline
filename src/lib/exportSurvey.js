import * as XLSX from "xlsx";

// Atribut internal chat yang tidak ikut diekspor sebagai kolom pembobot
export const INTERNAL_ATTRS = new Set(["chatResolved", "chatResolvedAt", "notes"]);

// Ekspor respons survei → tabel ramping: pembobot (dari kontak) + jawaban chatbot.
// Hanya identitas + pembobot + 1 kolom/pertanyaan (tanpa status/tanggal) agar siap diolah sendiri.
// opts.upper = ubah semua nilai jadi HURUF KAPITAL. Spasi berlebih selalu dirapikan (cleaning ringan).
export function exportResponses(survey, responses, format, opts = {}) {
  const questions = (survey.questions || []).map((q) => q.text);
  // Kumpulkan kolom pembobot sesuai urutan kemunculan
  const attrKeys = [];
  responses.forEach((r) => Object.keys(r.attributes || {}).forEach((k) => { if (!INTERNAL_ATTRS.has(k) && !attrKeys.includes(k)) attrKeys.push(k); }));

  // Cleaning ringan: rapikan spasi (trim + ganda→tunggal). Opsional: huruf kapital.
  const clean = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    s = s.replace(/\s+/g, " ").trim();
    if (opts.upper) s = s.toUpperCase();
    return s;
  };

  const header = ["Nomor", "Nama", ...attrKeys, ...questions];
  const rows = responses.map((r) => {
    const map = {};
    (r.answers || []).forEach((a) => { map[a.question] = a.value; });
    const attrs = r.attributes || {};
    return [
      clean(r.phone),
      clean(r.name || ""),
      ...attrKeys.map((k) => clean(attrs[k] ?? "")),
      ...questions.map((q) => clean(map[q] ?? "")),
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Respons");
  const slug = (survey.title || "survei").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const base = `survei-${slug}-${responses.length}responden`;
  if (format === "csv") XLSX.writeFile(wb, `${base}.csv`, { bookType: "csv" });
  else XLSX.writeFile(wb, `${base}.xlsx`);
}
