# Panduan Meta dari NOL → bisa jadi Tester

Tujuan: dari belum punya apa-apa di Meta for Developers, sampai bisa **kirim & terima** pesan WhatsApp lewat aplikasi Populi WA memakai **nomor uji GRATIS** dari Meta.

> **Penting:** untuk fase tester, Anda **tidak perlu** mendaftarkan/verifikasi nomor HP sendiri. Meta menyediakan **nomor uji** yang tidak butuh OTP. Nomor asli baru diperlukan saat mau kirim ke publik luas (lihat §8).

---

## Peta singkat: 2 situs Meta yang berbeda

| Situs | Untuk apa |
|---|---|
| **business.facebook.com** (Business Settings) | Verifikasi bisnis, WABA, System User, izin aset |
| **developers.facebook.com** (App dashboard) | **API Setup**: nomor uji, token, penerima uji, App Secret, Webhook |

Screenshot "WhatsApp accounts / Test WhatsApp Business Account" yang Anda lihat = **Business Settings**. Untuk mulai tes, sebagian besar kerja ada di **developers.facebook.com**.

---

## 1. Buat / buka App di Meta for Developers

1. Buka https://developers.facebook.com/apps/
2. Kalau belum ada app: **Create App** → tipe **Business** → isi nama (mis. "Populi WA") → pilih Business portfolio (Populi Center) → **Create**.
3. Di dashboard app: **Add product** → cari **WhatsApp** → **Set up**.

Setelah itu Meta otomatis membuatkan **Test WhatsApp Business Account** + **nomor uji** (inilah "Test WhatsApp Business Account" yang Anda lihat).

---

## 2. API Setup — ambil nomor uji, token, & daftar penerima

Menu: **WhatsApp → API Setup** (di app dashboard).

Di halaman ini ada 3 hal penting:

1. **From (nomor uji)** — gratis, sudah jadi. Di bawahnya ada **Phone number ID** → **CATAT** (angka panjang; ini BUKAN nomor telepon).
   - Catat juga **WhatsApp Business Account ID** (WABA ID) bila ditampilkan.
2. **Temporary access token** — token sementara **berlaku 24 jam**. **CATAT** untuk tes cepat hari ini.
3. **To (recipient)** — klik **Manage phone number list** → tambahkan **nomor HP Anda** sebagai penerima uji → Meta kirim OTP ke WhatsApp HP itu → masukkan kode. Bisa sampai **5 nomor**.
   - ⚠️ Selama fase tes, nomor uji **hanya bisa kirim ke nomor yang ada di daftar To ini**.

> Kalau muncul "requested verification code too many times" saat menambah penerima: itu rate-limit Meta. **Tunggu beberapa jam** (jangan klik Resend berulang), lalu coba lagi. Ini tidak menghalangi langkah lain.

---

## 3. App Secret & Verify Token

1. **App Secret**: App dashboard → **Settings → Basic** → baris **App Secret** → klik **Show** → CATAT. (Dipakai memverifikasi tanda tangan webhook.)
2. **Verify Token**: string bebas buatan Anda (mis. hasil `openssl rand -hex 16`). Pakai nilai yang sudah Anda taruh di `.env` sebagai `META_WEBHOOK_VERIFY_TOKEN`. Harus **sama persis** dengan yang nanti diisi di Meta saat daftar webhook.

---

## 4. Isi kredensial di aplikasi Populi WA

Buka aplikasi (mis. `https://wa.risetcenter.com`) → login admin → menu **Akun WhatsApp** (Vendor / Meta).

Isi:

| Field di app | Diisi dengan |
|---|---|
| Access Token | Temporary token (24 jam) untuk tes, atau token permanen (§7) |
| Phone Number ID | dari §2 |
| App Secret | dari §3 |
| Verify Token | dari §3 (sama dengan `.env`) |

Klik **Simpan**, lalu **Cek Koneksi** / **Cek Status** → harus **hijau** (menampilkan nama & rating nomor uji). Kalau merah, lihat §9.

---

## 5. Daftarkan Webhook (supaya balasan masuk)

Menu: **WhatsApp → Configuration → Webhook → Edit**.

1. **Callback URL:** `https://wa.risetcenter.com/webhook/meta`
2. **Verify token:** sama dengan §3.
3. Klik **Verify and save** → Meta memanggil backend Anda; kalau verify token cocok, tersimpan.
4. Di daftar field, klik **Manage** → **Subscribe** field **`messages`** (wajib). Boleh tambah `message_template_status_update` (status approval template).

> Webhook butuh HTTPS publik yang sudah jalan. Pastikan app sudah live & `/webhook/meta` bisa diakses sebelum langkah ini.

---

## 6. Tes pertama: kirim `hello_world` lalu balas

Template **`hello_world`** sudah pre-approved (tak perlu menunggu approval).

**Opsi A — dari app:** Broadcast → Buat Blast → pilih segmen berisi **nomor To** Anda → template `hello_world` (bahasa `en_US`) → kirim.

**Opsi B — cek cepat via curl** (pakai nilai Anda):
```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "628xxxxxxxxxx",
    "type": "template",
    "template": { "name": "hello_world", "language": { "code": "en_US" } }
  }'
```

Lalu **balas** pesan itu dari WhatsApp di HP Anda → masuk lewat webhook → muncul di menu **Chat**. Kalau Anda buat survei dengan **pemicu kata kunci** dan membalas kata kuncinya, bot survei akan jalan.

✅ Sampai sini Anda sudah resmi jadi **tester**.

---

## 7. Token permanen (untuk seterusnya, bukan cuma 24 jam)

Token sementara mati tiap 24 jam. Untuk operasional:

1. **business.facebook.com → Business Settings → System Users → Add** (role **Admin**).
2. **Assign assets**: pilih **App** Anda + **WABA** → beri akses penuh.
3. **Generate new token** → pilih App → centang permission:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. **Salin token** (muncul sekali) → ganti Access Token di menu **Akun WhatsApp** app dengan token ini.

---

## 8. Naik ke produksi (kirim ke publik luas)

Saat tes lancar dan mau kirim ke banyak nomor (bukan cuma 5 penerima uji):

1. **Tambahkan nomor asli** ke WABA (WhatsApp Manager → Add phone number) → verifikasi OTP.
   - Nomor harus **belum aktif** di app WhatsApp / WhatsApp Business biasa, atau didaftarkan-ulang.
2. **Tambahkan metode pembayaran** (WhatsApp Manager → Billing) — pesan berbayar per percakapan.
3. **Ajukan template Anda sendiri** (WhatsApp Manager → Message Templates) sesuai kategori (UTILITY/MARKETING) → tunggu approval.
4. Naikkan limit pengiriman bertahap (tier mulai 250/1k/10k... lihat **SendingPolicy** di app agar tidak kena banned).

---

## 9. Kalau "Cek Koneksi" gagal / 502 / webhook tak verified

- **Token salah/kadaluarsa** → pakai token baru dari API Setup atau System User.
- **Phone Number ID tertukar dengan WABA ID** → keduanya angka panjang tapi beda; ambil yang di bawah "From" di API Setup.
- **Webhook "verify failed"** → Verify Token di Meta ≠ `META_WEBHOOK_VERIFY_TOKEN` di `.env`, atau `/webhook/meta` belum bisa diakses publik (cek app live & nginx).
- **502 saat tes URL** → masalah routing/deploy, bukan Meta. Cek kontainer backend & jaringan nginx (lihat `docs/DEPLOY.md`).

---

## Ringkasan yang harus dikumpulkan (fase tester)

| Item | Dari | Status |
|---|---|---|
| Phone Number ID | API Setup (developers.facebook.com) | wajib |
| Access Token (temporary 24 jam) | API Setup | wajib (tes) → ganti permanen §7 |
| App Secret | App → Settings → Basic | wajib |
| Verify Token | buatan sendiri = `.env` | wajib |
| Nomor penerima uji (To) | API Setup, maks 5 | wajib (verifikasi OTP) |
| Template `hello_world` | bawaan Meta | otomatis ada |

Referensi lengkap (termasuk Qontak): lihat `docs/SETUP-META-QONTAK.md`.
