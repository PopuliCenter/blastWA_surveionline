# Deploy ke Produksi (Fase 3)

Prasyarat: kredensial Meta/Qontak terkumpul (lihat `SETUP-META-QONTAK.md`) & template message disetujui.

## Opsi A — VPS + Docker Compose (paling lurus)

1. Siapkan VPS (Ubuntu) + domain (mis. `api.populi.id`) yang diarahkan ke IP VPS.
2. Pasang Docker + Docker Compose.
3. Clone repo, isi `backend/.env` (production):
   - `NODE_ENV=production`
   - `JWT_SECRET`, `CREDENTIALS_ENC_KEY` (acak, rahasia)
   - `FRONTEND_ORIGIN=https://app.populi.id`
   - kredensial Meta/Qontak
4. Jalankan:
   ```bash
   docker compose up -d --build
   ```
   (compose otomatis menjalankan `prisma migrate deploy` saat start backend)
5. **HTTPS**: pasang reverse proxy (Caddy/Nginx) di depan `:3000` dengan sertifikat (Let's Encrypt).
   - Caddy contoh:
     ```
     api.populi.id {
       reverse_proxy localhost:3000
     }
     ```
6. Buat user admin: `docker compose exec backend npm run seed`.
7. Daftarkan webhook produksi di Meta/Qontak:
   - Meta: `https://api.populi.id/webhook/meta`
   - Qontak: `https://api.populi.id/webhook/qontak`

## Opsi B — PaaS (Railway / Render / Fly.io)

- Deploy `backend/` sebagai service (Dockerfile sudah ada).
- Tambah PostgreSQL + Redis add-on, set `DATABASE_URL` & `REDIS_URL`.
- Jalankan **dua** proses: web (`node dist/server.js`) + worker (`node dist/queue/worker.js`).
- Set env lain seperti di atas. HTTPS biasanya otomatis dari platform.

## Frontend
- Build: `npm run build` (root) → folder `dist/`.
- Host di Vercel/Netlify/Cloudflare Pages, atau serve dari Nginx/Caddy.
- Set `VITE_API_URL=https://api.populi.id` saat build (lihat `src/lib/api.js`).

## Checklist go-live
- [ ] Template message disetujui (Meta/Qontak)
- [ ] HTTPS aktif di domain webhook
- [ ] Webhook terverifikasi (Meta menampilkan ✓)
- [ ] `JWT_SECRET` & `CREDENTIALS_ENC_KEY` unik & rahasia (bukan nilai contoh)
- [ ] Password admin default diganti
- [ ] Worker berjalan (cek log "Blast worker berjalan")
- [ ] Backup PostgreSQL terjadwal (mis. `pg_dump` cron / snapshot)
- [ ] Monitoring/error tracking (mis. Sentry) — opsional tapi disarankan
- [ ] Rate limit worker sesuai tier WhatsApp Anda (`src/queue/worker.ts` → `limiter`)
- [ ] Kebijakan opt-in/opt-out penerima dipatuhi

## Operasional
- Lihat log webhook di UI (`/api/webhook-logs`) untuk debug inbound.
- Skala worker: tambah replika service `worker` bila volume blast tinggi.
- Migrasi DB baru: `prisma migrate deploy` (otomatis di compose backend start).
