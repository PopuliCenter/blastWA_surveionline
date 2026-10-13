export const TYPE_LABEL = {
  text: "Teks",
  rating: "Rating",
  number: "Angka",
  choice: "Pilihan",
  multichoice: "Pilihan (>1)",
  boolean: "Ya/Tidak",
  date: "Tanggal",
  consent: "Persetujuan",
  image: "Gambar",
  wilayah: "Wilayah",
};
export const QTYPE_OPTIONS = [
  { value: "text", label: "Teks bebas" },
  { value: "rating", label: "Rating (skala angka)" },
  { value: "number", label: "Angka" },
  { value: "choice", label: "Pilihan ganda (1 jawaban)" },
  { value: "multichoice", label: "Pilihan ganda (boleh >1)" },
  { value: "boolean", label: "Ya / Tidak" },
  { value: "date", label: "Tanggal (pemilih tanggal di Flow)" },
  { value: "consent", label: "Persetujuan / informed consent" },
  { value: "image", label: "Gambar / foto" },
  { value: "wilayah", label: "Wilayah (provinsi → kabupaten/kota)" },
];
// Tipe yang memakai daftar pilihan (choices).
export const HAS_CHOICES = (t) => t === "choice" || t === "multichoice";

export function qSummary(q) {
  // Daftarnya bawaan dari kode resmi Kepmendagri, jadi pembuat survei tak perlu (dan tak
  // bisa) mengisinya sendiri — disebutkan agar jelas tanpa harus membuka pratinjau.
  if (q.type === "wilayah") return q.options?.tingkat === "kabkota" ? "38 provinsi → 514 kab/kota" : "38 provinsi";
  if (q.type === "rating") return `skala ${q.options?.min ?? 1}-${q.options?.max ?? 5}`;
  if (HAS_CHOICES(q.type))
    return `${(q.options?.choices || []).length} pilihan${q.type === "multichoice" ? " (multi)" : ""}`;
  return "";
}

// Teks bawaan pesan kuota penuh — HANYA untuk placeholder di builder. Sumber aslinya
// PESAN_KUOTA_PENUH_BAWAAN di backend/src/services/kuotaSurvei.ts; bila salah satu diubah,
// ubah juga yang lain. Kolom yang dikosongkan tetap memakai teks dari backend, jadi selisih
// di sini hanya membuat contoh di layar keliru, bukan pesan yang terkirim.
export const PESAN_KUOTA_PENUH_BAWAAN =
  "Terima kasih atas kesediaan Anda. Kuota responden survei ini sudah terpenuhi, sehingga kami tidak dapat mengikutsertakan jawaban baru. 🙏";
