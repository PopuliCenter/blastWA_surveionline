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
// Aturannya bisa diatur per survei (survey.aturanDurasi):
//   { batas: [{ sampai: 3, label: "Terlalu cepat" }, ...], selebihnya: "Aman" }
// dibaca "sampai 3 menit → Terlalu cepat; …; selebihnya → Aman". Bentuk ini tidak mungkin
// berlubang maupun tumpang tindih: setiap durasi jatuh ke tepat satu label.
//
// KEMBARAN PERSIS dari backend/src/lib/asesmenDurasi.ts — ekspor Excel dihitung di sini,
// Google Sheets di sana. backend/test/asesmenDurasi.test.ts menguji keduanya berdampingan.
export const ATURAN_DURASI_BAWAAN = {
  batas: [
    { sampai: 2, label: "Terlalu cepat" },
    { sampai: 10, label: "Normal" },
    { sampai: 30, label: "Lambat" },
  ],
  selebihnya: "Terlalu lama",
};
export const MAKS_BATAS_DURASI = 9;
export const MAKS_LABEL_DURASI = 40;

// Menit dibulatkan ke satu desimal — angka yang tertulis di kolom "Durasi (menit)". Label
// diputuskan dari angka yang SAMA, supaya baris "3,0 menit" tidak berlabel berbeda-beda.
export const bulatkanMenit = (menit) => Math.round(menit * 10) / 10;

// Batas menit dari isian: angka, atau teks dengan koma ATAU titik ("2,5" = "2.5"). Kolom
// angka bawaan peramban tidak mengenali koma di banyak lokal; teks kosong = NaN, bukan 0.
// "2:30" juga diterima sebagai MENIT:DETIK = 2,5 menit (sedangkan "2,30" = 2,3 menit).
export function menitDari(v) {
  if (typeof v === "number") return v;
  const t = typeof v === "string" ? v.trim() : "";
  const md = /^(\d+)\s*:\s*(\d{1,2})$/.exec(t);
  if (md) return Number(md[2]) < 60 ? Number(md[1]) + Number(md[2]) / 60 : NaN;
  const d = t.replace(",", ".");
  return d === "" ? NaN : Number(d);
}

// "1 menit 54 detik". Kolom "Durasi (menit)" berupa menit DESIMAL — 1,9 = 1 menit 54 detik,
// bukan 1 menit 90 detik — supaya bisa diurutkan dan dirata-ratakan; ini artinya.
export function formatLamaPengisian(menit) {
  if (menit === null || menit === undefined || !Number.isFinite(menit) || menit < 0) return "";
  const total = Math.round(menit * 60);
  const jam = Math.floor(total / 3600);
  const mnt = Math.floor((total % 3600) / 60);
  const dtk = total % 60;
  const bagian = [jam ? `${jam} jam` : "", mnt ? `${mnt} menit` : "", dtk ? `${dtk} detik` : ""].filter(Boolean);
  return bagian.length ? bagian.join(" ") : "0 detik";
}

function galatLabel(label) {
  const t = typeof label === "string" ? label.trim() : "";
  if (!t) return "Setiap label asesmen harus diisi.";
  if (t.length > MAKS_LABEL_DURASI) return `Label asesmen paling panjang ${MAKS_LABEL_DURASI} karakter.`;
  // Diawali = + - @ dibaca sebagai rumus saat berkas CSV dibuka di Excel ("-Aman" tampil #NAME?).
  if (/^[=+\-@]/.test(t)) return "Label asesmen tidak boleh diawali =, +, -, atau @.";
  return null;
}

// Kesalahan pada aturan, atau null bila sah. Pesannya sama dengan yang dikirim server.
export function galatAturanDurasi(a) {
  if (!a || typeof a !== "object") return "Aturan asesmen durasi tidak terbaca.";
  const { batas, selebihnya } = a;
  if (!Array.isArray(batas) || !batas.length) return "Isi paling sedikit satu batas menit.";
  if (batas.length > MAKS_BATAS_DURASI) return `Paling banyak ${MAKS_BATAS_DURASI} batas.`;
  let sebelumnya = 0;
  for (const b of batas) {
    const n = menitDari(b?.sampai);
    if (!Number.isFinite(n) || n <= 0) return "Setiap batas harus berupa menit lebih dari 0.";
    if (n <= sebelumnya) return "Batas menit harus makin besar dari atas ke bawah.";
    const e = galatLabel(b?.label);
    if (e) return e;
    sebelumnya = n;
  }
  return galatLabel(selebihnya);
}

// Aturan yang berlaku: milik survei bila sah, selain itu bawaan.
export const aturanBerlaku = (a) => (a && !galatAturanDurasi(a) ? a : ATURAN_DURASI_BAWAAN);

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

export function asesmenDurasi(menit, aturan) {
  if (menit === null || menit === undefined || !Number.isFinite(menit)) return "";
  const a = aturanBerlaku(aturan);
  const m = bulatkanMenit(menit);
  for (const b of a.batas) if (m <= menitDari(b.sampai)) return b.label.trim();
  return a.selebihnya.trim();
}

// Jawaban Wilayah DISIMPAN dengan kode resminya ("Jawa Barat (32)") karena kode itulah yang
// dipakai kuota provinsi. Di berkas ekspor kode itu derau, dan mengganggu pencocokan nama
// provinsi ke data lain. Hanya untuk pertanyaan Wilayah — jawaban teks bebas berakhiran
// angka dalam kurung ("Anak (2)") tidak boleh ikut terpotong.
export const bersihkanKodeWilayah = (nilai) => String(nilai).replace(/\s*\(\d{2}(?:\.\d{2})?\)\s*$/, "");

// Respons yang ditolak karena kuotanya sudah penuh. Jawabannya tetap tersimpan dan tampil di
// daftar respons, tetapi tidak dihitung — jadi tidak boleh ikut ekspor maupun analisis.
// Satu fungsi untuk semua halaman, supaya angka di layar dan isi berkas tidak berselisih.
export const ditolakKuota = (r) => Boolean(r?.ditolakKuotaPada);

// Bentuk tabel respons (MURNI — tanpa I/O, mudah diuji): header + baris.
// Kolom = Nomor, Nama, Sumber Kontak, pembobot (urut kemunculan), lalu 1 kolom/pertanyaan.
// Pengenal dan metadata di depan, variabel analisis di belakang, agar kolom pembobot dan
// jawaban tetap bersebelahan saat diolah.
// opts.upper = HURUF KAPITAL. Spasi berlebih selalu dirapikan (cleaning ringan).
export function buildResponseRows(survey, semuaRespons, opts = {}) {
  // Jaring terakhir: pemanggil sudah menyaringnya, tapi berkas yang terunduh tidak boleh
  // bergantung pada setiap pemanggil ingat. Disaring SEBELUM kolom pembobot dikumpulkan —
  // kalau sesudahnya, atribut milik responden yang ditolak meninggalkan kolom kosong.
  const responses = semuaRespons.filter((r) => !ditolakKuota(r));
  const questions = (survey.questions || []).map((q) => q.text);
  const wilayah = new Set((survey.questions || []).filter((q) => q.type === "wilayah").map((q) => q.text));
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
  // Urutan tiga kolom durasi sama dengan di Google Sheets, supaya mudah dicocokkan.
  const header = [
    "Nomor",
    "Nama",
    "Sumber Kontak",
    "Durasi (menit)",
    "Asesmen Durasi",
    "Lama Pengisian",
    ...attrKeys,
    ...questions,
  ];
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
      menit === null ? "" : bulatkanMenit(menit),
      clean(asesmenDurasi(menit, survey.aturanDurasi)),
      // "1 menit 54 detik": kolom Durasi berupa menit DESIMAL (1,9 = 1 menit 54 detik).
      // Dari angka yang sama dengan kolom Durasi (sudah dibulatkan), supaya 1,9 terbaca
      // 1 menit 54 detik — bukan 1 menit 53 detik dari detik aslinya.
      clean(formatLamaPengisian(menit === null ? null : bulatkanMenit(menit))),
      ...attrKeys.map((k) => clean(attrs[k] ?? "")),
      ...questions.map((q) => clean(wilayah.has(q) ? bersihkanKodeWilayah(map[q] ?? "") : (map[q] ?? ""))),
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
