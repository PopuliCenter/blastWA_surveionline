# Populi WA Survey Platform

Platform survei via WhatsApp: buat survei, kirim blast ke segmen kontak, terima & rekam jawaban,
lihat laporan — dengan dukungan **multi-vendor** (Qontak BSP + Meta Cloud API langsung, siap tambah BSP lain).

## Struktur

```
.
├── src/                  # Frontend (React + Vite) — dashboard
│   └── lib/api.js        # klien API ke backend
├── backend/              # Backend API + worker (Fastify + Prisma + BullMQ)
├── docs/                 # Dokumentasi (baca berurutan di bawah)
└── docker-compose.yml    # Postgres + Redis + backend + worker
```

> Catatan: frontend masih di root (`src/`). Pemisahan penuh ke `frontend/` adalah langkah opsional berikutnya.

## Dokumentasi (urutan baca)

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — desain sistem & abstraksi vendor
2. **[docs/ROADMAP.md](docs/ROADMAP.md)** — fase pengerjaan & status
3. **[docs/SETUP-META-QONTAK.md](docs/SETUP-META-QONTAK.md)** — cara dapat kredensial Meta & Qontak
4. **[docs/COMMANDS.md](docs/COMMANDS.md)** — perintah setup & menjalankan
5. **[docs/FRONTEND-INTEGRATION.md](docs/FRONTEND-INTEGRATION.md)** — menyambung UI ke API
6. **[docs/DEPLOY.md](docs/DEPLOY.md)** — deploy produksi

## Quick start (dev)

Lihat **[docs/COMMANDS.md](docs/COMMANDS.md)** untuk langkah lengkap. Ringkas:

```bash
# 1. infra
docker compose up -d postgres redis
# 2. backend
cd backend && cp .env.example .env && npm install
npx prisma migrate dev --name init && npm run seed
npm run dev          # API :3000
npm run dev:worker   # worker (terminal lain)
# 3. frontend
cd .. && npm run dev # UI :5173
```

Login awal: `populi` / `populi13!` (ganti setelah login pertama).

## Status

- ✅ Backend: auth (JWT), CRUD survei/segmen/blast, abstraksi vendor (Meta + Qontak), webhook receiver, queue blast, mesin survei chat.
- ✅ Frontend: UI lengkap + klien API.
- ⏳ Tersisa: wiring tiap halaman frontend ke API (panduan di FRONTEND-INTEGRATION.md), kredensial live, approval template, deploy.
