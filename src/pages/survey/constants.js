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
];
// Tipe yang memakai daftar pilihan (choices).
export const HAS_CHOICES = (t) => t === "choice" || t === "multichoice";

export function qSummary(q) {
  if (q.type === "rating") return `skala ${q.options?.min ?? 1}-${q.options?.max ?? 5}`;
  if (HAS_CHOICES(q.type))
    return `${(q.options?.choices || []).length} pilihan${q.type === "multichoice" ? " (multi)" : ""}`;
  return "";
}
