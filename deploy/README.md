# Deploy `wa.populicenter.com` (VPS apps)

App WA dipasang sebagai **stack Docker terpisah** (`survei-wa`) yang gabung ke
network bersama **`web`**, lalu diproxy oleh **edge nginx** yang sudah ada
(`survey-populicenter-nginx-1`). **Tidak membuka port host** → nol konflik dengan
app `survei_*` & `survey-populicenter-*`.

```
Cloudflare (Proxied, SSL Flexible) ──HTTP:80──► edge nginx (survey-populicenter)
        wa.populicenter.com.conf ──► wa_frontend (Nginx SPA) ──► wa_backend (Fastify) ─┐
                                                                  wa_worker ───────────┤
                                                            postgres / redis (internal)┘
```

## Prasyarat (sudah ada di VPS)
- Edge nginx `survey-populicenter-nginx-1` (pegang 80/443), config file di `/var/www/survey-populicenter/`.
- Network Docker eksternal **`web`**.
- Cert `origin.pem` (SAN `*.populicenter.com`) di `/var/www/survey-populicenter/certs`.
- DNS Cloudflare: `wa` A → IP VPS, **Proxied**.

## Langkah

```bash
# 1) Ambil kode ke folder app
cd /var/www/survei-wa
git clone https://github.com/PopuliCenter/blastWA_surveionline.git .

# 2) Siapkan env backend
cp backend/.env.example backend/.env
nano backend/.env
#   WAJIB diisi/diubah:
#     JWT_SECRET=<acak ≥32 char>
#     CREDENTIALS_ENC_KEY=<openssl rand -hex 32>
#     FRONTEND_ORIGIN=https://wa.populicenter.com
#     META_WEBHOOK_VERIFY_TOKEN=<token bebas, samakan di Meta>
#     DEFAULT_VENDOR=meta
#   (DATABASE_URL & REDIS_URL otomatis di-override compose → biarkan)

# 3) Build & jalankan stack (tanpa port host)
docker compose -f deploy/docker-compose.prod.yml up -d --build

# 4) Buat akun admin awal (sekali saja)
docker compose -f deploy/docker-compose.prod.yml run --rm backend npx tsx prisma/seed.ts

# 5) Pasang server block di EDGE nginx
cp deploy/wa.populicenter.com.conf /var/www/survey-populicenter/wa.populicenter.com.conf
#   Tambahkan mount ke service nginx di /var/www/survey-populicenter/docker-compose.yml:
#     volumes:
#       - ./wa.populicenter.com.conf:/etc/nginx/conf.d/wa.populicenter.com.conf:ro
cd /var/www/survey-populicenter
docker compose up -d nginx                      # recreate agar mount terbaca
docker exec survey-populicenter-nginx-1 nginx -t && \
docker exec survey-populicenter-nginx-1 nginx -s reload
```

## Verifikasi
```bash
# kontainer app WA jalan
docker compose -f /var/www/survei-wa/deploy/docker-compose.prod.yml ps
# health via edge nginx (dalam VPS)
curl -s -H "Host: wa.populicenter.com" http://127.0.0.1/health
```
Lalu buka **https://wa.populicenter.com** → login `populi` / `populi13!` (ganti setelah masuk).

## Webhook Meta
- Callback URL: `https://wa.populicenter.com/webhook/meta`
- Verify Token: sama dengan `META_WEBHOOK_VERIFY_TOKEN` di `backend/.env`
- Subscribe field **`messages`**.

## Update versi berikutnya
```bash
cd /var/www/survei-wa && git pull
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

## Catatan
- Port host yang dipakai app lain: **80/443** (edge nginx), **3000** (survey-populicenter-backend, publik), **5432/6379/9000-9001** (localhost). App WA ini **tidak** memakai satu pun port host → aman.
- Cloudflare zona = **Flexible** (CF→origin via :80). Bila pindah ke **Full**, block 443 + cert origin sudah siap.
