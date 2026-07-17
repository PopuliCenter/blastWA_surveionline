# Twelve-Factor App — Kepatuhan & Batasan Skalabilitas

> Catatan singkat: sejauh mana Populi WA mengikuti metodologi [Twelve-Factor App](https://12factor.net),
> di mana ia menyimpang **dengan sengaja**, dan apa yang perlu diubah bila suatu saat butuh
> **scale horizontal**. Ditulis untuk kondisi kode saat ini (backend Fastify + worker BullMQ,
> multi-vendor: Meta / Qontak / Baileys), deployment 1 organisasi di satu VPS via Docker Compose.

## Ringkasan

Aplikasi ini **"12-factor enough"**: 9 faktor terpenuhi penuh, 1 trade-off sadar (logging),
1 keterbatasan yang melekat pada Baileys (statefulness). **Tidak ada yang perlu diperbaiki untuk go-live.**

| # | Faktor | Status | Catatan |
|---|--------|--------|---------|
| I | Codebase | ✅ | Satu repo Git, banyak deploy (dev/prod compose) |
| II | Dependencies | ✅ | `package.json` + `npm ci`; tak bergantung paket sistem |
| III | Config | ✅* | Infra via env (`env.ts`, Zod, fail-fast). Kredensial vendor/AI **sengaja** di DB terenkripsi (bisa diubah lewat UI tanpa redeploy) |
| IV | Backing services | ✅ | Postgres & Redis via `DATABASE_URL` / `REDIS_URL` — bisa ditukar tanpa ubah kode |
| V | Build, release, run | ✅ | Dockerfile multi-stage; rilis = `prisma migrate deploy && node dist/server.js` |
| VI | Processes (stateless) | ⚠️ | **Menyimpang karena Baileys** — lihat di bawah |
| VII | Port binding | ✅ | Fastify berdiri sendiri di `PORT`, diekspos via nginx |
| VIII | Concurrency | ✅* | Dua tipe proses (`wa_backend`, `wa_worker`). Backend tak bisa di-scale horizontal saat Baileys aktif |
| IX | Disposability | ✅ | Graceful shutdown SIGTERM/SIGINT, healthcheck, Redis AOF, start cepat |
| X | Dev/prod parity | ✅ | Stack Docker sama di dev & prod |
| XI | Logs | ⚠️ | Pino → **stdout** ✅, tapi **juga** menulis file (`ERROR_LOG_FILE`) — trade-off sadar |
| XII | Admin processes | ✅ | `prisma migrate deploy` sebagai langkah rilis; `seed.prod.mjs` sekali jalan |

`✅*` = terpenuhi dengan deviasi yang disengaja & dijelaskan.

---

## Penyimpangan 1 — Baileys membuat backend *stateful* (Faktor VI & VIII)

**Ini penyimpangan paling substansial.**

Baileys adalah gateway WhatsApp **tidak resmi** (scan QR). Socket-nya hidup **di dalam proses
`wa_backend`**, dan state sesinya disimpan di **disk** (`BAILEYS_AUTH_DIR`, di-mount ke volume
`baileys_auth` di prod). Akibatnya:

- **Backend tidak stateless** → tidak bisa dijalankan sebagai >1 replika: dua instance akan
  berebut sesi WhatsApp yang sama.
- **Worker tidak punya socket** → untuk blast via Baileys, worker meneruskan permintaan kirim
  balik ke backend lewat `INTERNAL_API_URL` (backend = pemilik socket). Lihat komentar di
  `deploy/docker-compose.prod.yml`.

### Penting: ini hanya "menular" saat Baileys dipakai

Untuk vendor **resmi (Meta Cloud API / Qontak)**, pengiriman murni via **HTTP stateless** —
backend **sudah** stateless dan bisa di-scale. Statefulness di atas hanya muncul karena Baileys.

### Kalau nanti butuh scale horizontal

Pilih salah satu:

1. **Batasi peran Baileys.** Jalankan Baileys sebagai **satu instance khusus** (1 replika,
   tidak di-scale), sementara jalur Meta/Qontak boleh punya banyak replika di belakang load
   balancer. Paling sederhana, tidak perlu ubah kode besar.
2. **Pindahkan sesi Baileys ke penyimpanan bersama.** Ganti auth-state dari file ke
   **Redis/DB** (implementasi `useMultiFileAuthState` → custom auth-state store). Ini yang
   membuat backend benar-benar stateless, tapi butuh kerja & tetap tidak menghilangkan
   batasan "1 socket per nomor WA".

> Rekomendasi: untuk skala 1 organisasi, **tidak perlu**. Baileys memang untuk uji/non-kritis
> (melanggar ToS WhatsApp, risiko blokir) — lihat `docs/WHATSAPP-LANGSUNG-QR.md`.

---

## Penyimpangan 2 — Logging ganda (Faktor XI)

12-factor menyarankan app **hanya** menulis event ke `stdout` dan membiarkan platform yang
mengumpulkan/merutekan. Di sini ada **dua** jalur:

- **stdout** via pino (`Fastify({ logger: true })`) — sesuai 12-factor ✅
- **file** per proses (`ERROR_LOG_FILE` → `backend.log` / `worker.log`, di-mount ke
  `/var/log/populi-wa`) — untuk kemudahan `tail` di VPS single-host.

Ini **keputusan sadar** (lihat pilihan monitoring "Log file terstruktur"), bukan bug. Bila
nanti pindah ke platform dengan agregasi log (Loki / CloudWatch / Datadog / dsb.), cukup
matikan penulisan file dan andalkan stdout.

---

## Catatan Faktor III — kredensial di DB, bukan env

Menyimpan kredensial vendor & konfigurasi AI **terenkripsi di database** (bukan env var)
tampak melanggar "config in the environment", tapi ini disengaja:

- Kredensial bisa **diubah lewat UI saat runtime** tanpa redeploy, dan bersifat **multi-vendor**.
- Yang **tetap** di env adalah secret **infrastruktur**: `JWT_SECRET`, `CREDENTIALS_ENC_KEY`,
  `DATABASE_URL`, `REDIS_URL`. Ini sudah benar.

⚠️ `CREDENTIALS_ENC_KEY` **tidak boleh berubah** setelah kredensial tersimpan — menggantinya
membuat semua blob terenkripsi tak bisa didekripsi (insiden "Meta hilang" sebelumnya).

---

## Kesimpulan

Untuk aplikasi 1-organisasi di satu VPS, arsitektur ini **selaras dengan Twelve-Factor** pada
hal-hal yang penting (config, backing services, build/release/run, disposability, parity).
Dua deviasi yang ada **beralasan** dan terdokumentasi. Jalur upgrade menuju scale horizontal
**jelas dan terisolasi** (hanya menyangkut Baileys + mematikan file log).
