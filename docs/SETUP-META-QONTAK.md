# Setup Kredensial — Meta Cloud API & Qontak

Checklist langkah mendapatkan semua kredensial yang dibutuhkan backend. Simpan hasilnya di `.env` backend (jangan di frontend, jangan di-commit).

Data Anda yang sudah diketahui:
- **Business portfolio ID:** `2165363153515064`
- **BSP saat ini:** Qontak (sudah aktif)

---

## 1. Variabel lingkungan yang akan dibutuhkan (`.env`)

```dotenv
# --- Umum ---
DATABASE_URL=postgresql://user:pass@localhost:5432/populi
REDIS_URL=redis://localhost:6379
JWT_SECRET=ganti_dengan_string_acak_panjang
CREDENTIALS_ENC_KEY=32_byte_key_untuk_enkripsi_kredensial_vendor

# --- Meta Cloud API (jalur langsung) ---
META_BUSINESS_PORTFOLIO_ID=2165363153515064
META_WABA_ID=                 # WhatsApp Business Account ID
META_PHONE_NUMBER_ID=         # Phone Number ID (BUKAN nomor HP)
META_ACCESS_TOKEN=            # System User permanent token (disarankan)
META_APP_SECRET=              # untuk verifikasi signature webhook
META_WEBHOOK_VERIFY_TOKEN=    # string bebas, dipakai saat daftar webhook
META_GRAPH_VERSION=v21.0

# --- Qontak (BSP) ---
QONTAK_BASE_URL=https://service-chat.qontak.com/api/open/v1
QONTAK_ACCESS_TOKEN=          # atau pakai OAuth (username/password/client) di bawah
QONTAK_USERNAME=
QONTAK_PASSWORD=
QONTAK_CLIENT_ID=
QONTAK_CLIENT_SECRET=
QONTAK_CHANNEL_INTEGRATION_ID=
QONTAK_WEBHOOK_SECRET=        # untuk verifikasi webhook masuk dari Qontak
```

---

## 2. Meta Cloud API — langkah dapat kredensial

> Lakukan di **Meta Business Manager** (business.facebook.com) & **Meta for Developers** (developers.facebook.com), pakai akun yang punya akses ke Business portfolio `2165363153515064`.

1. **Buat/akses App** di Meta for Developers → produk **WhatsApp** → "Set up".
2. Hubungkan **WhatsApp Business Account (WABA)** Anda. Catat **WABA ID**.
   - ⚠️ Jika nomor ini saat ini di-host Qontak (Qontak = BSP), nomor tsb belum tentu bisa langsung dipakai di Cloud API tanpa migrasi. Lihat §6.
3. Di halaman WhatsApp → **API Setup**, catat **Phone Number ID** (angka panjang, beda dari nomor telepon).
4. **Access Token permanen** (jangan token sementara 24 jam):
   - Business Settings → **System Users** → buat system user (role Admin).
   - Assign aset **WABA** & **App** ke system user.
   - **Generate token** dengan permission: `whatsapp_business_messaging`, `whatsapp_business_management`. Simpan → `META_ACCESS_TOKEN`.
5. **App Secret**: App → Settings → Basic → "App Secret" → `META_APP_SECRET` (untuk verifikasi signature webhook).
6. **Webhook**: App → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://DOMAIN-ANDA/webhook/meta`
   - Verify Token: samakan dengan `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe field: **messages** (minimal).
   - Saat klik "Verify and Save", Meta kirim `GET` dengan `hub.challenge` → backend harus balas challenge-nya.

**Tes kirim (template "hello_world" bawaan):**
```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <META_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "628xxxxxxxxxx",
    "type": "template",
    "template": { "name": "hello_world", "language": { "code": "en_US" } }
  }'
```

---

## 3. Qontak — langkah dapat kredensial

> Dokumentasi Postman Anda: https://www.postman.com/winter-satellite-337817/
> (Buka collection Qontak di sana untuk endpoint & contoh body yang persis.)

1. Login dashboard Qontak → ambil **Access Token** (atau kredensial OAuth: username, password, client_id, client_secret).
   - OAuth: `POST {QONTAK_BASE_URL}/oauth/token` → dapat `access_token`.
2. Catat **Channel Integration ID** (ID koneksi WhatsApp Anda di Qontak) → `QONTAK_CHANNEL_INTEGRATION_ID`.
3. Daftarkan **Webhook** di Qontak ke `https://DOMAIN-ANDA/webhook/qontak` & catat secret → `QONTAK_WEBHOOK_SECRET`.
4. Untuk blast: butuh **Message Template ID** dari template yang sudah disetujui di Qontak.

**Pola kirim broadcast (cek body persis di Postman collection):**
```
POST {QONTAK_BASE_URL}/broadcasts/whatsapp/direct
Authorization: Bearer <QONTAK_ACCESS_TOKEN>
{
  "to_name": "Nama Penerima",
  "to_number": "628xxxxxxxxxx",
  "message_template_id": "<TEMPLATE_ID>",
  "channel_integration_id": "<QONTAK_CHANNEL_INTEGRATION_ID>",
  "language": { "code": "id" },
  "parameters": { "body": [ { "key": "1", "value": "Andi", "value_text": "Andi" } ] }
}
```
> Field bisa sedikit berbeda antar versi API Qontak — **rujuk Postman collection Anda** sebagai sumber kebenaran saat implementasi adapter.

---

## 4. URL publik saat development

Webhook butuh HTTPS publik. Saat dev di laptop, pakai tunnel:
- `cloudflared tunnel --url http://localhost:3000`, atau
- `ngrok http 3000`

Pakai URL hasil tunnel untuk Callback URL di Meta/Qontak. Untuk produksi: domain + sertifikat HTTPS sungguhan.

---

## 5. Template Message (jalur kritis — mulai awal!)

Blast keluar **wajib pakai template yang disetujui** (di luar 24-hour window).
- **Meta langsung:** buat template di Business Manager → WhatsApp Manager → Message Templates. Pilih kategori benar (mis. `MARKETING` atau `UTILITY`). Tunggu approval (jam–hari).
- **Qontak:** ajukan template lewat dashboard Qontak.

Contoh body template survei (variabel `{{1}}` = nama, `{{2}}` = link):
> Halo {{1}}, kami dari Populi ingin meminta waktu Anda mengisi survei singkat: {{2}}. Terima kasih 🙏

---

## 6. Catatan penting: Qontak vs Meta langsung bersamaan

Satu nomor WhatsApp/WABA **umumnya hanya terhubung ke satu BSP/jalur pada satu waktu**. Karena nomor Anda saat ini di Qontak, ada beberapa opsi:

1. **Tetap di Qontak** untuk nomor utama; bangun adapter Meta untuk **nomor lain** (mis. nomor uji/cadangan yang Anda host langsung di Cloud API).
2. **Migrasi nomor** dari Qontak ke Cloud API langsung (proses migrasi nomor di Meta) — lalu Qontak jadi cadangan/alternatif untuk nomor berbeda.
3. **Abstraksi tetap dibangun dua-duanya** (sesuai keputusan Anda), tetapi *vendor aktif per-nomor* diset di `vendor_configs`. Jadi arsitektur siap, tinggal colok nomor ke vendor mana pun.

➡️ **Yang perlu dikonfirmasi ke Qontak/Meta:** apakah nomor Anda bisa dipindah ke Cloud API, atau Anda akan pakai nomor terpisah untuk jalur langsung. Ini tidak menghambat penulisan kode adapter — hanya menentukan nomor mana pakai jalur mana.

---

## Ringkasan: yang perlu Anda kumpulkan

| Kredensial | Dari | Untuk |
|---|---|---|
| WABA ID, Phone Number ID | Meta WhatsApp Manager | Kirim via Cloud API |
| Access Token permanen (System User) | Meta Business Settings | Auth Cloud API |
| App Secret, Verify Token | Meta App Settings | Verifikasi webhook |
| Qontak Access Token / OAuth creds | Dashboard Qontak | Auth Qontak |
| Channel Integration ID | Dashboard Qontak | Kirim via Qontak |
| Template ID (Qontak) / Template name (Meta) | Setelah approval | Blast |
