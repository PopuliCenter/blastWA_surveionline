# WhatsApp Langsung (Scan QR / Baileys) — tanpa Meta API

Jalur **alternatif** mengirim & menerima WhatsApp **tanpa** Meta Cloud API: login dengan **scan QR** memakai nomor HP biasa (seperti WhatsApp Web), berbasis library **Baileys**.

## ⚠️ Risiko (baca dulu)
- **Tidak resmi** — melanggar Ketentuan Layanan WhatsApp.
- **Nomor bisa diblokir/banned**, terutama untuk blast massal atau pola tak wajar.
- Tidak ada SLA/dukungan resmi; bisa putus saat WhatsApp berubah.
- **Gunakan nomor uji / non-kritis**, mulai volume kecil, patuhi **Pengaman Pengiriman** (batas harian + jeda) di menu Akun WhatsApp.

Untuk produksi/skala besar, gunakan **Meta Cloud API** (resmi) atau **Qontak** (BSP).

## Cara pakai
1. Menu **Akun WhatsApp** → kartu **WhatsApp Langsung (Scan QR)** → klik **Hubungkan / Tampilkan QR**.
2. Di HP: **WhatsApp → Perangkat Tertaut → Tautkan Perangkat** → scan QR di layar.
3. Status berubah jadi **terhubung**. Klik **Aktifkan** bila ingin jadikan vendor aktif.
4. **Terima**: pesan masuk otomatis muncul di **Chat**; balasan/auto-reply/survei dengan pemicu kata kunci ikut jalan.
5. **Kirim manual**: balas dari **Chat** (otomatis lewat jalur yang sama dengan pesan masuk kontak).
6. **Broadcast**: menu **Broadcast → Buat Blast → Vendor: WhatsApp Langsung (QR)** → tulis **Isi Pesan** (boleh `{{1}}` untuk nama) → kirim. Tidak perlu template/approval.

Sesi login tersimpan, jadi **tidak perlu scan ulang** setelah restart (selama sesi belum logout/di-unlink dari HP).

## Catatan teknis (untuk developer)
- Socket Baileys hanya hidup di proses **backend** (pemilik). Pesan masuk → `handleInboundEvents` (survei/auto-reply). Lihat `backend/src/providers/baileys.ts`.
- **Worker** (pengirim blast) tak punya socket → meneruskan kirim ke backend via `POST /internal/baileys/send` (tidak diekspos publik oleh nginx). Atur `INTERNAL_API_URL=http://wa_backend:3000` di worker.
- Sesi disimpan di `BAILEYS_AUTH_DIR` (default `./.baileys-auth`). Di Docker di-mount ke volume `baileys_auth` agar bertahan.
- Vendor bersifat **templateless**: blast mengirim teks `messageText` apa adanya (placeholder `{{n}}` diganti `bodyParams`).
- Amankan endpoint internal dengan `BAILEYS_INTERNAL_TOKEN` (opsional) di produksi.

Lihat juga: `docs/SETUP-META-TESTER.md` (jalur resmi Meta) dan `docs/SETUP-META-QONTAK.md`.
