// ===== Penjagaan isian belum tersimpan =====
// Dipisah dari komponen agar bisa diuji tanpa merender React.

// Apakah isian sekarang berbeda dari kondisi awal?
// Perbandingan lewat JSON: cukup untuk draf form (nilai primitif, array, objek datar)
// dan urutan kunci selalu sama karena keduanya berasal dari bentuk objek yang sama.
export function isChanged(current, initial) {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

// Prop `dirty` milik Modal boleh berupa boolean atau fungsi. Fungsi dipakai supaya
// nilainya dibaca saat modal hendak ditutup, bukan saat modal dirender.
export function needsDiscardConfirm(dirty) {
  return typeof dirty === "function" ? Boolean(dirty()) : Boolean(dirty);
}
