# Populi WA Backend

Backend API + worker untuk platform survei WhatsApp multi-vendor (Qontak + Meta Cloud API).
Arsitektur lengkap: lihat `../docs/ARCHITECTURE.md`.

## Stack
Fastify + TypeScript · Prisma + PostgreSQL · BullMQ + Redis · @fastify/jwt + argon2 · Zod.

## Menjalankan (development)

```bash
cd backend
cp .env.example .env          # isi kredensial; WAJIB set JWT_SECRET & CREDENTIALS_ENC_KEY
npm install

# Database & Redis (dari root repo):
docker compose up -d postgres redis

npx prisma migrate dev --name init   # buat tabel
npm run seed                          # buat user admin

npm run dev          # API di http://localhost:3000  (terminal 1)
npm run dev:worker   # worker blast                  (terminal 2)
```

Generate `CREDENTIALS_ENC_KEY` (32 byte hex):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Endpoint utama

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/api/auth/login` | - | Login → JWT |
| GET | `/api/auth/me` | ✓ | Profil user |
| GET/POST/PUT/DELETE | `/api/surveys` | ✓ | CRUD survei |
| GET/POST/DELETE | `/api/segments` | ✓ | Segmen + kontak |
| GET/POST/DELETE | `/api/blasts` | ✓ | Buat & lihat blast |
| GET | `/api/vendors` | ✓ | Status vendor |
| PUT | `/api/vendors/:vendor/credentials` | ✓ | Simpan kredensial (terenkripsi) |
| GET | `/api/stats`, `/api/webhook-logs` | ✓ | Laporan |
| GET/POST | `/webhook/meta` | signature | Verifikasi + inbound Meta |
| POST | `/webhook/qontak` | secret | Inbound Qontak |

## Webhook saat dev (URL publik)
```bash
cloudflared tunnel --url http://localhost:3000
# atau: ngrok http 3000
```
Pakai URL hasilnya sebagai Callback URL di Meta/Qontak (lihat `../docs/SETUP-META-QONTAK.md`).

## Catatan integrasi vendor
- **Qontak**: format body broadcast & webhook diverifikasi terhadap Postman collection Anda
  (https://www.postman.com/winter-satellite-337817/). Sesuaikan di `src/providers/qontak.ts` bila berbeda.
- **Meta**: pakai versi Graph API terbaru (`META_GRAPH_VERSION`), token System User permanen.
