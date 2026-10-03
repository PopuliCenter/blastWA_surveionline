-- Profil penerbit invoice — pengaturan tunggal.
--
-- Menyimpan bagian invoice yang tidak pernah berganti: alamat lembaga penerbit beserta
-- NPWP, Account ID Meta, dan metode pembayaran. Sebelumnya semua itu diketik ulang di
-- setiap invoice, dan satu digit NPWP yang salah ketik pada invoice pajak bukan kesalahan
-- yang bisa diabaikan.
--
-- Data per klien sengaja TIDAK disimpan di sini. Menyimpannya akan membuat invoice untuk
-- klien berikutnya terisi data klien sebelumnya — kesalahan yang jauh lebih memalukan
-- daripada kolom kosong.
CREATE TABLE "ProfilInvoice" (
    "id" TEXT NOT NULL,
    "penerbit" TEXT,
    "accountId" TEXT,
    "metode" TEXT,
    "produk" TEXT NOT NULL DEFAULT 'WhatsApp Business Account',
    "status" TEXT NOT NULL DEFAULT 'Paid',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilInvoice_pkey" PRIMARY KEY ("id")
);
