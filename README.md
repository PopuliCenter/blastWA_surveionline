<div align="center">

# Populi WA — Survey & Broadcast Platform

**Platform survei & broadcast WhatsApp**: bangun survei, kirim ke ribuan kontak, rekam jawaban otomatis, dan analisis hasilnya — lengkap dengan pengaman anti‑banned dan dukungan **multi‑vendor** (Meta Cloud API langsung + Qontak BSP).

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

[Fitur](#-fitur) · [Arsitektur](#-arsitektur) · [Mulai Cepat](#-mulai-cepat-dev) · [Konfigurasi](#-konfigurasi-env) · [Deploy ke VPS](#-deploy-ke-vps-subdomain--cloudflare) · [Dokumentasi](#-dokumentasi)

</div>

---

## ✨ Fitur

### Survei
- **Builder pertanyaan** kaya tipe: teks, rating (skala), angka, pilihan ganda, ya/tidak, gambar.
- **Edit & urutkan** pertanyaan kapan saja tanpa menghapus jawaban lama (update non‑destruktif).
- **Pratinjau gaya WhatsApp** — simulasikan alur tanya‑jawab + validasi sebelum live.
- **Dua mode pengisian:**
  - **Chat bot** — tanya‑jawab per pesan, jalan di mana saja, dengan validasi & *fallback* jawaban di luar pilihan.
  - **WhatsApp Flow** — formulir native 1 layar (completion lebih tinggi); Flow JSON di‑generate otomatis + tangkap balasan via webhook.
- **Pemicu otomatis (bot)** — survei dimulai sendiri saat pesan masuk cocok kata kunci.

### Broadcast
- Kirim ke **segmen** kontak via **template** (Meta) atau Template ID (Qontak), bisa **dijadwalkan**.
- **Simulasi biaya** per kategori (Marketing/Utility/Authentication) + **estimasi biaya** langsung di form blast.
- **Panduan top‑up & pembayaran** Meta terintegrasi.
- **Broadcast Flow** — kirim formulir Flow lewat template ber‑tombol‑Flow.

### Template Pesan
- Builder template (kategori, bahasa, header teks/gambar/dokumen/video, tombol) + **pratinjau WhatsApp**.
- **Cek kesiapan lolos Meta** (heuristik) & **contoh siap‑pakai** (blast survei, rilis ke media, undangan acara).

### Kontak & Chat
- **Impor massal** Excel/CSV dengan 2 template: **Biasa** (Nama+No HP) & **Pembobot** (+ demografi).
- **Inbox Chat** 3‑panel: status sesi 24 jam, filter, catatan internal, **balasan bot ditandai**.
- **Pilih banyak → hapus sekaligus** di Kontak, Chat, Broadcast, dan responden Laporan.

### Laporan
- **Integrasi otomatis**: data **pembobot (dari impor)** × **jawaban (rekaman chatbot)** digabung per nomor.
- Distribusi demografi, **tabulasi silang** (pembobot × pertanyaan), **ekspor ramping** Excel/CSV (+ opsi normalisasi HURUF KAPITAL).

### Pengaman Anti‑banned
- **Opt‑out/opt‑in otomatis** (BERHENTI/STOP, MULAI) + pelacakan **consent**.
- **Batas harian + jeda acak** (warm‑up) & pengecualian kontak opt‑out dari blast.
- **Pantau quality rating & messaging tier** nomor langsung dari Meta.

### Platform
- **Multi‑vendor**: Meta Cloud API + Qontak (BSP) lewat abstraksi adapter — kredensial **terenkripsi (AES‑256‑GCM)**.
- **Auth JWT** + peran (superadmin/admin/viewer). UI **responsif** (desktop & ponsel).

---

## 🧱 Arsitektur

```
┌─────────────┐     REST      ┌──────────────┐   enqueue   ┌─────────────┐
│  Frontend   │ ────────────► │  Backend API │ ──────────► │   Worker    │
│ React+Vite  │ ◄──────────── │   (Fastify)  │   BullMQ    │ (pengirim)  │
└─────────────┘    JSON       └──────┬───────┘             └──────┬──────┘
                                     │ Prisma                     │ adapter
                              ┌──────▼───────┐            ┌────────▼────────┐
                              │  PostgreSQL  │            │ Meta Cloud API  │
                              │    Redis     │            │  / Qontak BSP   │
                              └──────────────┘            └─────────────────┘
                                     ▲  webhook (pesan masuk & status) ─────┘
```

- **Semua kode aplikasi memanggil interface `MessagingProvider`**, tidak pernah API vendor langsung — gampang menambah BSP baru.
- **Worker terpisah** memproses antrian blast (rate‑limit, warm‑up, jitter, retry).
- **Webhook** menerima pesan masuk & status pengiriman → mesin survei merekam jawaban (chat & Flow).

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, Vite 8, UI kit inline, SheetJS (`xlsx`) |
| Backend | Fastify, TypeScript, Zod, `@fastify/jwt`, argon2 |
| Data & Antrian | Prisma + PostgreSQL, BullMQ + Redis |
| Infra | Docker Compose (Postgres, Redis, API, Worker) |

---

## 🚀 Mulai Cepat (dev)

> Prasyarat: **Node.js 20+**, **Docker** (untuk Postgres & Redis).

```bash
# 1) Infra (Postgres + Redis)
docker compose up -d postgres redis

# 2) Backend
cd backend
cp .env.example .env                 # lalu isi JWT_SECRET & CREDENTIALS_ENC_KEY (lihat di bawah)
npm install
npx prisma migrate dev               # buat skema DB
npm run seed                         # buat akun admin awal
npm run dev                          # API di http://localhost:3000
npm run dev:worker                   # worker blast (jalankan di terminal lain)

# 3) Frontend (dari root repo)
cd ..
npm install
npm run dev                          # dashboard di http://localhost:5173
```

Login default: **`populi` / `populi13!`** (ubah setelah masuk).

> Catatan port: `docker-compose.yml` memetakan Postgres ke **host `5433`** (agar tidak bentrok dengan Postgres lokal). Sesuaikan `DATABASE_URL` di `backend/.env` → `...@localhost:5433/...` saat menjalankan backend di host.

---

## 🔧 Konfigurasi (env)

**Frontend** (`.env` di root) — saat build produksi:
```env
VITE_API_URL=https://wa.risetcenter.com   # origin API; saat dev biarkan http://localhost:3000
```

**Backend** (`backend/.env`) — kunci penting:
```env
PORT=3000
FRONTEND_ORIGIN=https://wa.risetcenter.com        # untuk CORS
DATABASE_URL=postgresql://populi:populi@localhost:5433/populi?schema=public
REDIS_URL=redis://localhost:6379

JWT_SECRET=<string acak ≥ 32 karakter>
CREDENTIALS_ENC_KEY=<64 hex>                       # openssl rand -hex 32

DEFAULT_VENDOR=meta                                # meta | qontak
META_WEBHOOK_VERIFY_TOKEN=<token bebas, samakan di Meta>
```
Kredensial Meta/Qontak (token, phone number id, app secret, dst.) **tidak perlu** ditaruh di env — bisa diisi & disimpan terenkripsi lewat menu **Akun WhatsApp** di dashboard. Lihat **[docs/SETUP-META-QONTAK.md](docs/SETUP-META-QONTAK.md)**.

---

## 🌐 Deploy ke VPS (subdomain + Cloudflare)

Skenario: satu VPS sudah menjalankan beberapa app (mis. `risetcenter.com`, `survei.risetcenter.com`). App ini dipasang di subdomain **`wa.risetcenter.com`**, DNS sudah diarahkan di **Cloudflare (Proxied)** ke IP origin VPS.

### 1) DNS & SSL (Cloudflare)
- Record **A** `wa` → IP VPS, **Proxied** (☁️ oranye). ✅ (sudah dibuat)
- SSL/TLS mode: **Full** (atau Full strict bila origin punya sertifikat). HTTPS publik ditangani Cloudflare.

### 2) Jalankan backend + worker + DB (Docker)
Di server, isi `backend/.env` (JWT_SECRET, CREDENTIALS_ENC_KEY, `FRONTEND_ORIGIN=https://wa.risetcenter.com`, `META_WEBHOOK_VERIFY_TOKEN`, dll.), lalu:
```bash
docker compose up -d --build         # postgres, redis, backend (:3000), worker
```
> Agar tidak terekspos publik, batasi port backend ke localhost — di `docker-compose.yml` ubah port backend jadi `"127.0.0.1:3000:3000"` (Nginx yang mem‑proxy). Postgres/Redis cukup internal (boleh hapus mapping port host‑nya).

### 3) Build frontend (statis)
```bash
# di root repo (di server, atau build lokal lalu kirim folder dist/)
echo "VITE_API_URL=https://wa.risetcenter.com" > .env
npm install && npm run build
sudo mkdir -p /var/www/wa.risetcenter.com && sudo cp -r dist/* /var/www/wa.risetcenter.com/
```

### 4) Nginx — server block subdomain
Frontend statis disajikan langsung; `/api`, `/webhook`, `/health` di‑proxy ke backend `:3000`.
```nginx
server {
    listen 80;
    server_name wa.risetcenter.com;

    root /var/www/wa.risetcenter.com;
    index index.html;

    # SPA: arahkan rute non‑file ke index.html
    location / { try_files $uri $uri/ /index.html; }

    # API & webhook → backend
    location /api/      { proxy_pass http://127.0.0.1:3000; include proxy_params; }
    location /webhook/  { proxy_pass http://127.0.0.1:3000; include proxy_params; }
    location /health    { proxy_pass http://127.0.0.1:3000; }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/wa.risetcenter.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
> Karena Cloudflare Proxied, sertifikat publik ditangani Cloudflare. Bila ingin HTTPS di origin juga, pasang Let's Encrypt / Cloudflare Origin Cert dan tambahkan blok `listen 443 ssl`.

### 5) Daftarkan Webhook di Meta
- Callback URL: **`https://wa.risetcenter.com/webhook/meta`**
- Verify Token: samakan dengan `META_WEBHOOK_VERIFY_TOKEN`
- Subscribe field **`messages`**.

Detail & checklist lengkap: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## 📚 Dokumentasi

| Dok | Isi |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Desain sistem & abstraksi vendor |
| [docs/SETUP-META-QONTAK.md](docs/SETUP-META-QONTAK.md) | Cara mendapatkan kredensial Meta & Qontak |
| [docs/COMMANDS.md](docs/COMMANDS.md) | Kumpulan perintah setup & menjalankan |
| [docs/FRONTEND-INTEGRATION.md](docs/FRONTEND-INTEGRATION.md) | Menyambung UI ke API |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Panduan deploy produksi |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fase pengerjaan & status |

---

## ⚖️ Catatan Penting

- **Gunakan jalur resmi (Meta Cloud API / BSP)** untuk broadcast. Jalur tidak resmi (otomasi WhatsApp Web) berisiko tinggi nomor diblokir.
- Patuhi kebijakan WhatsApp: kirim hanya ke kontak **opt‑in**, hormati **BERHENTI**, mulai volume kecil (warm‑up), jaga **quality rating** tetap hijau.
- Biaya per pesan ditagih Meta sesuai kategori & negara — gunakan **Simulasi Biaya** untuk estimasi.

---

<div align="center">

Dibuat oleh **[Populi Center](https://github.com/PopuliCenter)** · Repo: **[blastWA_surveionline](https://github.com/PopuliCenter/blastWA_surveionline)**

</div>
"# blastWA_surveionline" 
