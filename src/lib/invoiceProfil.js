// Bidang invoice dipisah menurut sifatnya, bukan menurut tampilannya di dokumen.
//
// TETAP   — tidak pernah berganti antar invoice: alamat penerbit beserta NPWP, Account ID,
//           metode pembayaran, jenis produk, status. Semuanya datang dari profil tersimpan.
// BERGANTI— berbeda tiap invoice: nama klien, alamat penagihan, Reference Number,
//           Transaction ID, catatan. Semuanya SELALU dimulai kosong.
//
// Pemisahan ini yang mencegah kesalahan paling memalukan pada dokumen tagihan: invoice
// untuk klien baru yang masih memuat nama atau alamat klien sebelumnya.

export const BIDANG_TETAP = ["penerbit", "accountId", "metode", "produk", "status"];
export const BIDANG_BERGANTI = ["nama", "alamatKlien", "referensi", "transaksi", "catatan"];

// Nilai awal formulir invoice: bidang tetap diisi dari profil, bidang berganti dikosongkan.
// `tanggal` default hari ini, tapi tetap bisa diubah pemakai.
export function invoiceAwal(profil, tanggal) {
  const p = profil || {};
  return {
    nama: "",
    alamatKlien: "",
    referensi: "",
    transaksi: "",
    catatan: "",
    tanggal: tanggal || "",
    penerbit: p.penerbit || "",
    accountId: p.accountId || "",
    metode: p.metode || "",
    // Dua ini punya bawaan yang masuk akal walau profil belum pernah diisi, supaya
    // invoice pertama tidak kosong di bagian yang jawabannya sudah pasti.
    produk: p.produk || "WhatsApp Business Account",
    status: p.status || "Paid",
  };
}

// Profil yang akan disimpan dari isian formulir — hanya bidang tetap yang ikut.
export function profilDariInvoice(inv) {
  const out = {};
  for (const k of BIDANG_TETAP) out[k] = inv?.[k] ?? "";
  return out;
}
