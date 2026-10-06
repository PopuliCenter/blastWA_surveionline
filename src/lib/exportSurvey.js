// xlsx (SheetJS) dimuat lewat dynamic import saat ekspor saja (code-splitting).

// Atribut internal chat yang tidak ikut diekspor sebagai kolom pembobot
export const INTERNAL_ATTRS = new Set(["chatResolved", "chatResolvedAt", "notes"]);

// Label kolom "Sumber Kontak". Nilai mentahnya dari Contact.consentSource, yang terisi
// otomatis: "import" saat impor kontak/segmen, "manual" dari dashboard, dan "inbound"
// saat kontak baru mengirim pesan.
//
// Kolom Nama tidak bisa menjawab pertanyaan ini karena nama impor dan nama profil WA
// menempati kolom yang sama. Padahal bedanya penting untuk laporan: rekrutan surveyor
// (impor) adalah sampel terencana, sedangkan responden organik (pesan masuk) masuk
// sendiri — dan komposisi keduanyalah yang dilaporkan di bagian metodologi.
export const CONTACT_SOURCE_LABELS = {
  import: "Impor",
  manual: "Manual",
  inbound: "Pesan masuk",
  form: "Formulir",
};

// Nilai tak dikenal SENGAJA diteruskan apa adanya, bukan dijadikan "(tidak diketahui)":
// kalau kelak ada sumber baru, ia harus terlihat di ekspor, bukan tersembunyi.
export function contactSourceLabel(source) {
  const s = typeof source === "string" ? source.trim() : "";
  if (!s) return "(tidak diketahui)";
  return CONTACT_SOURCE_LABELS[s] ?? s;
}

// ===== Asesmen durasi pengisian =====
//
// Lama pengisian adalah petunjuk mutu jawaban yang murah dan sudah ada datanya: respons
// yang selesai dalam hitungan detik hampir pasti diisi asal-asalan, sedangkan yang
// menggantung berjam-jam biasanya ditinggal lalu dilanjutkan — keduanya perlu dilihat
// terpisah sebelum ikut dianalisis.
//
// AMBANGNYA menutup seluruh garis waktu tanpa celah maupun tumpang tindih. Rentang yang
// diminta ("<2", "3-10", "11-30") menyisakan lubang di 2–3 menit; lubang itu dimasukkan ke
// "Normal", bukan ke "Terlalu cepat", karena menaikkan batas curiga berarti menuduh lebih
// banyak responden — dan itu keputusan metodologis, bukan keputusan pembuat berkas.
export const AMBANG_DURASI = { cepat: 2, normal: 10, lambat: 30 };

// Menit pengisian, atau null bila tak dapat dihitung: respons belum selesai, atau stempel
// waktunya terbalik. Null SENGAJA tidak jatuh ke salah satu kategori — "tidak diketahui"
// bukan "terlalu cepat", dan menebaknya akan mencemari justru kolom yang dibuat untuk
// membersihkan data.
export function durasiMenit(r) {
  const a = r?.startedAt ? new Date(r.startedAt).getTime() : NaN;
  const b = r?.completedAt ? new Date(r.completedAt).getTime() : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60000;
}

export function asesmenDurasi(menit, ambang = AMBANG_DURASI) {
  if (menit === null || menit === undefined || !Number.isFinite(menit)) return "";
  if (menit < ambang.cepat) return "Terlalu cepat";
  if (menit <= ambang.normal) return "Normal";
  if (menit <= ambang.lambat) return "Lambat";
  return "Terlalu lama";
}

// Bentuk tabel respons (MURNI — tanpa I/O, mudah diuji): header + baris.
// Kolom = Nomor, Nama, Sumber Kontak, pembobot (urut kemunculan), lalu 1 kolom/pertanyaan.
// Pengenal dan metadata di depan, variabel analisis di belakang, agar kolom pembobot dan
// jawaban tetap bersebelahan saat diolah.
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
  // Durasi ikut dicetak di samping asesmennya supaya labelnya bisa diperiksa, bukan
  // dipercaya begitu saja — kolom penilaian tanpa angka asalnya tidak bisa diaudit.
  const header = ["Nomor", "Nama", "Sumber Kontak", "Durasi (menit)", "Asesmen Durasi", ...attrKeys, ...questions];
  const rows = responses.map((r) => {
    const map = {};
    (r.answers || []).forEach((a) => {
      map[a.question] = a.value;
    });
    const attrs = r.attributes || {};
    const menit = durasiMenit(r);
    return [
      clean(r.phone),
      clean(r.name || ""),
      clean(contactSourceLabel(r.consentSource)),
      // Angka, bukan teks: supaya bisa langsung disortir dan dirata-ratakan di spreadsheet.
      menit === null ? "" : Math.round(menit * 10) / 10,
      clean(asesmenDurasi(menit)),
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
