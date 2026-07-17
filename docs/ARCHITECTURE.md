# Arsitektur — Populi WA Survey Platform

> Dokumen ini menjelaskan arsitektur target aplikasi survei WhatsApp multi-vendor.
> Status saat ini: **prototype frontend-only** (lihat bagian "Titik Awal").
> Target: aplikasi produksi dengan backend, database, dan abstraksi vendor (Qontak + Meta Cloud API langsung + BSP lain).
>
> Lihat juga: [TWELVE-FACTOR.md](TWELVE-FACTOR.md) — kepatuhan 12-factor, deviasi yang disengaja, & jalur menuju scale horizontal.

---

## 1. Titik Awal (kondisi sekarang)

Yang sudah ada hanya **frontend React + Vite** (`src/PopuliApp.jsx`, ~1050 baris). Semua data di `localStorage`, semua angka blast/webhook **disimulasikan**. Tidak ada server, database, atau integrasi WhatsApp sungguhan.

| Komponen | Sekarang | Target |
|---|---|---|
| Penyimpanan data | `localStorage` browser | PostgreSQL |
| Kirim pesan WA | Angka palsu | API vendor (Qontak / Meta) via worker queue |
| Terima webhook | `fetch()` tes dari browser | Endpoint HTTPS publik di backend |
| Kredensial vendor | Form di browser (tidak aman) | Server-side, terenkripsi |
| Auth user | Cek password di localStorage | JWT/session + password hash (bcrypt/argon2) |
| Multi-vendor | Tidak ada | Lapisan adapter (interface tunggal) |

`src/wa_survey_app.jsx` adalah versi lama yang tidak terpakai → **hapus** di Fase 0.

---

## 2. Gambaran Sistem (target)

```
                          ┌──────────────────────────────┐
                          │   Frontend (React + Vite)     │
                          │   Dashboard, Survei, Blast,   │
                          │   Laporan, Webhook, Settings  │
                          └───────────────┬──────────────┘
                                          │ HTTPS (REST API + JWT)
                          ┌───────────────▼──────────────┐
                          │        Backend API            │
                          │  (Node + Express/Fastify)     │
                          │                               │
                          │  ┌─────────────────────────┐  │
                          │  │  Vendor Abstraction      │  │
                          │  │  MessagingProvider iface │  │
                          │  └──┬──────────┬────────┬───┘  │
                          │     │          │        │      │
                          │  Qontak   MetaCloud  (BSP lain)│
                          │  Adapter   Adapter    Adapter  │
                          └──┬───────────┬─────────┬───────┘
              outbound (kirim)│           │         │
                  ┌───────────▼──┐   ┌────▼─────┐   │
                  │ Job Queue    │   │ Webhook  │◄──┘ inbound (terima)
                  │ (BullMQ+Redis)│  │ Receiver │   dari Qontak / Meta
                  │ rate-limit,  │   │ /webhook │
                  │ retry, delay │   └────┬─────┘
                  └──────┬───────┘        │
                         │                │
                  ┌──────▼────────────────▼──────┐
                  │      PostgreSQL (Prisma)      │
                  │ users, surveys, contacts,     │
                  │ blasts, messages, responses,  │
                  │ vendor_configs, webhook_logs  │
                  └───────────────────────────────┘
```

**Alur kirim (outbound blast):** Frontend → Backend API → buat job per kontak ke Queue → worker ambil job → panggil adapter vendor aktif → vendor kirim ke WhatsApp → simpan status `sent`.

**Alur terima (inbound):** WhatsApp → vendor → POST ke `/webhook/:vendor` → verifikasi signature → adapter `parseInbound()` → event ternormalisasi → simpan pesan + update status delivery + map jawaban ke survei.

---

## 3. Abstraksi Vendor (inti "multi-vendor")

Satu interface, banyak implementasi. Semua kode aplikasi memanggil interface — **tidak pernah** memanggil API vendor langsung. Tambah BSP baru = tulis 1 adapter, tidak mengubah kode lain.

### 3.1 Interface

```ts
// backend/src/providers/types.ts

export type SendResult = {
  vendorMessageId: string;        // id pesan dari sisi vendor
  status: "queued" | "sent" | "failed";
  raw?: unknown;                  // respons mentah vendor (untuk debug)
};

export type NormalizedInbound = {
  vendor: string;                 // "qontak" | "meta" | ...
  kind: "message" | "status";     // pesan masuk vs update status delivery
  from?: string;                  // nomor pengirim (E.164, mis. 628xxx)
  text?: string;                  // isi teks pesan masuk
  messageId?: string;             // id pesan
  refMessageId?: string;          // id pesan outbound yang statusnya diupdate
  deliveryStatus?: "sent" | "delivered" | "read" | "failed";
  timestamp: string;              // ISO 8601
  raw: unknown;                   // payload mentah
};

export interface MessagingProvider {
  readonly name: string;

  // Kirim template (untuk blast / di luar jendela 24 jam)
  sendTemplate(input: {
    to: string;                   // E.164
    templateName: string;
    languageCode: string;         // mis. "id"
    bodyParams?: string[];        // isi variabel {{1}}, {{2}}, ...
  }): Promise<SendResult>;

  // Kirim teks bebas (hanya valid dalam jendela 24 jam sesi)
  sendText(input: { to: string; text: string }): Promise<SendResult>;

  // Verifikasi webhook (GET challenge untuk Meta, signature untuk keduanya)
  verifyWebhook(req: WebhookRequest): boolean | string;

  // Ubah payload webhook vendor → bentuk ternormalisasi
  parseInbound(req: WebhookRequest): NormalizedInbound[];
}
```

### 3.2 Registry / factory

```ts
// backend/src/providers/registry.ts
const providers: Record<string, MessagingProvider> = {
  qontak: new QontakAdapter(loadConfig("qontak")),
  meta:   new MetaCloudAdapter(loadConfig("meta")),
};

export function getProvider(name: string): MessagingProvider {
  const p = providers[name];
  if (!p) throw new Error(`Vendor tidak dikenal: ${name}`);
  return p;
}
```

Vendor aktif disimpan di tabel `vendor_configs` (bisa diatur dari halaman Settings). Bisa **global** (satu vendor default) atau **per-WABA/per-channel** kalau nanti perlu.

### 3.3 Perbedaan kunci tiap vendor

| Hal | Meta Cloud API (langsung) | Qontak (BSP) |
|---|---|---|
| Base URL | `https://graph.facebook.com/v21.0` | `https://service-chat.qontak.com/api/open/v1` |
| Auth | `Authorization: Bearer {permanent_token}` | OAuth token (`/oauth/token`) atau access token |
| Kirim template | `POST /{phone_number_id}/messages` body `type:"template"` | `POST /broadcasts/whatsapp/direct` (template_id + parameters) |
| Verifikasi webhook (GET) | `hub.mode` + `hub.verify_token` → balas `hub.challenge` | (umumnya tidak ada GET challenge) |
| Signature webhook (POST) | `X-Hub-Signature-256` = HMAC-SHA256(body, app_secret) | header signature/secret milik Qontak |
| Payload inbound | `entry[].changes[].value.messages[]` & `.statuses[]` | format objek Qontak (`data_message`, dll) |
| Biaya | Bayar Meta langsung (per percakapan) | Bayar Meta + markup Qontak |
| Approve template | Kelola sendiri di Meta Business Manager | Lewat dashboard Qontak |

> **Catatan versi:** kode prototype memakai Graph API `v18.0` (lawas). Target gunakan versi yang masih didukung (mis. `v21.0`/`v22.0`) dan jadikan konfigurabel.

---

## 4. Penanganan Webhook

Satu route per vendor agar parsing & verifikasi terpisah bersih:

```
GET  /webhook/meta      → verifikasi (balas hub.challenge)
POST /webhook/meta      → terima pesan & status
POST /webhook/qontak    → terima pesan & status
POST /webhook/:vendor   → pola umum untuk BSP lain
```

**Wajib:**
1. **Verifikasi signature SEBELUM memproses** (tolak 401 kalau gagal). Untuk Meta: HMAC-SHA256 body mentah dengan App Secret. Simpan body mentah (raw buffer) — jangan JSON.parse dulu.
2. **Balas cepat `200 OK`** lalu proses di background/queue (vendor akan retry kalau lambat/timeout).
3. **Idempotensi** — simpan `vendorMessageId`; abaikan event ganda.
4. **Log semua** ke `webhook_logs` (sudah ada konsepnya di UI) untuk audit & debug.

---

## 5. Data Model (PostgreSQL / Prisma — ringkas)

```
User            id, name, email, username, passwordHash, role, active, createdAt
Survey          id, title, description, status, createdAt
Question        id, surveyId→Survey, type, text, order, options(json)
Segment         id, name, createdAt
Contact         id, phone(E.164, unik), name, attributes(json)
SegmentContact  segmentId→Segment, contactId→Contact            (relasi N–N)
Blast           id, surveyId, segmentId, vendor, templateName, status,
                scheduledAt, sentCount, deliveredCount, readCount, createdAt
BlastRecipient  id, blastId→Blast, contactId→Contact, vendorMessageId,
                status(queued|sent|delivered|read|failed), error, updatedAt
Message         id, contactId, direction(in|out), vendor, vendorMessageId,
                text, payload(json), createdAt
SurveyResponse  id, surveyId, contactId, blastId?, startedAt, completedAt
Answer          id, responseId→SurveyResponse, questionId→Question, value
VendorConfig    id, vendor, isDefault, credentials(json, terenkripsi), active
WebhookLog      id, vendor, event, status, payload(json), note, createdAt
```

Catatan:
- Nomor HP selalu disimpan format **E.164** (`628xxxxxxxxx`, tanpa `+` atau dengan `+` — pilih satu & konsisten).
- `credentials` di `VendorConfig` **dienkripsi at-rest** (mis. AES-GCM dengan kunci dari env), bukan plaintext.

---

## 6. Tech Stack yang Direkomendasikan

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | React + Vite (sudah ada) | Lanjutkan; tinggal sambungkan ke API |
| Backend | Node.js + **Fastify** atau Express + TypeScript | Ekosistem WhatsApp/HTTP matang, tim familiar |
| ORM/DB | **Prisma** + **PostgreSQL** | Migrasi & tipe aman |
| Queue | **BullMQ** + **Redis** | Rate-limit blast, retry, jadwal kirim |
| Auth | JWT (access+refresh) atau session cookie; hash **argon2/bcrypt** | Aman, standar |
| Validasi | **Zod** | Validasi payload webhook & request API |
| Hosting | VPS (Docker Compose) atau PaaS (Railway/Render/Fly) | HTTPS publik untuk webhook |
| Secrets | `.env` (dev) + secret manager (prod) | Token tidak masuk repo |

> Alternatif jika ingin satu bahasa & lebih sedikit infra: **NestJS** (struktur lebih opinionated) atau **Next.js API routes**. Tapi untuk webhook + worker terpisah, Fastify/Express + BullMQ paling lurus.

---

## 7. Keamanan (wajib sebelum produksi)

- Token vendor **hanya** di server, terenkripsi. **Hapus** form token di frontend (sekarang ada di `Settings` → `wapiKey`).
- Verifikasi signature webhook (Meta App Secret / Qontak secret).
- Rate limiting di endpoint publik.
- Password user di-hash (bukan plaintext seperti sekarang).
- HTTPS wajib (webhook Meta menolak HTTP).
- Audit log untuk aksi blast (siapa kirim apa ke siapa, kapan).
- Patuh kebijakan WhatsApp: opt-in penerima, kategori template benar, hormati 24-hour window.

---

## 8. Struktur Folder Target (monorepo sederhana)

```
apps-populi-wa/
├── frontend/                 # pindahkan src/ React ke sini
│   ├── src/
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/           # auth, surveys, blasts, webhooks
│   │   ├── providers/        # types.ts, registry.ts, qontak.ts, meta.ts
│   │   ├── queue/            # worker blast (BullMQ)
│   │   ├── db/               # prisma client
│   │   └── lib/              # crypto, validation (zod)
│   ├── prisma/schema.prisma
│   └── package.json
├── docs/                     # dokumen ini
└── docker-compose.yml        # postgres + redis + backend + frontend
```

Lihat **ROADMAP.md** untuk urutan pengerjaan dan **SETUP-META-QONTAK.md** untuk langkah mendapatkan kredensial.
