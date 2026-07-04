// xlsx (SheetJS) dimuat lewat dynamic import saat ekspor saja (code-splitting).

// Atribut internal chat yang tidak ikut diekspor sebagai kolom pembobot
export const INTERNAL_ATTRS = new Set(["chatResolved", "chatResolvedAt", "notes"]);

// Bentuk tabel respons (MURNI — tanpa I/O, mudah diuji): header + baris.
// Kolom = Nomor, Nama, pembobot (urut kemunculan), lalu 1 kolom/pertanyaan.
// opts.upper = HURUF KAPITAL. Spasi berlebih selalu dirapikan (cleaning ringan).
export function buildResponseRows(survey, responses, opts = {}) {
  const questions = (survey.questions || []).map((q) => q.text);
  const attrKeys = [];
  responses.forEach((r) =>
    Object.keys(r.attributes || {}).forEach((k) => {
      if (!INTERNAL_ATTRS.has(k) && !attrKeys.includes(k)) attrKeys.push(k);
    }),
  );
  const clean = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    s = s.replace(/\s+/g, " ").trim();
    if (opts.upper) s = s.toUpperCase();
    return s;
  };
  const header = ["Nomor", "Nama", ...attrKeys, ...questions];
  const rows = responses.map((r) => {
    const map = {};
    (r.answers || []).forEach((a) => {
      map[a.question] = a.value;
    });
    const attrs = r.attributes || {};
    return [
      clean(r.phone),
      clean(r.name || ""),
      ...attrKeys.map((k) => clean(attrs[k] ?? "")),
      ...questions.map((q) => clean(map[q] ?? "")),
    ];
  });
  return { header, rows };
}

// Nama file = judul survei + tanggal_jam (mudah dilacak, tak saling menimpa). MURNI (date bisa di-inject).
export function exportFilename(survey, format, date = new Date()) {
  const slug = (survey.title || "survei")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
  return `survei-${slug}-${stamp}.${format === "csv" ? "csv" : "xlsx"}`;
}

// Ekspor respons survei → unduh file .xlsx/.csv.
export async function exportResponses(survey, responses, format, opts = {}) {
  const XLSX = await import("xlsx");
  const { header, rows } = buildResponseRows(survey, responses, opts);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Respons");
  const name = exportFilename(survey, format);
  if (format === "csv") XLSX.writeFile(wb, name, { bookType: "csv" });
  else XLSX.writeFile(wb, name);
}
