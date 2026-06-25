import * as XLSX from "xlsx";
import { fmtDate } from "./ui";

// Atribut internal chat yang tidak ikut diekspor sebagai kolom pembobot
export const INTERNAL_ATTRS = new Set(["chatResolved", "chatResolvedAt", "notes"]);

// Ekspor respons survei → tabel lebar: identitas + pembobot (dari kontak) + 1 kolom/pertanyaan
export function exportResponses(survey, responses, format) {
  const questions = (survey.questions || []).map((q) => q.text);
  // Kumpulkan kolom pembobot sesuai urutan kemunculan
  const attrKeys = [];
  responses.forEach((r) => Object.keys(r.attributes || {}).forEach((k) => { if (!INTERNAL_ATTRS.has(k) && !attrKeys.includes(k)) attrKeys.push(k); }));

  const header = ["Nomor", "Nama", ...attrKeys, "Status", "Mulai", "Selesai", ...questions];
  const rows = responses.map((r) => {
    const map = {};
    (r.answers || []).forEach((a) => { map[a.question] = a.value; });
    const attrs = r.attributes || {};
    return [
      r.phone,
      r.name || "",
      ...attrKeys.map((k) => attrs[k] ?? ""),
      r.completedAt ? "Selesai" : "Berlangsung",
      fmtDate(r.startedAt),
      r.completedAt ? fmtDate(r.completedAt) : "",
      ...questions.map((q) => map[q] ?? ""),
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
