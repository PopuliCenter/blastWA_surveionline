# Backup & Restore Database (app WA)

DB PostgreSQL app WA (`populi`) berjalan di kontainer `postgres` stack `survei-wa`
dengan volume `pgdata`. Panduan ini: backup otomatis + cara restore.

## 1. Backup otomatis (disarankan)

Skrip: [`deploy/backup-db.sh`](backup-db.sh) — `pg_dump` → `.sql.gz` → rotasi.

**Pasang sekali:**
```bash
chmod +x /var/www/survei-wa/deploy/backup-db.sh
# uji jalan manual dulu
STACK_DIR=/var/www/survei-wa /var/www/survei-wa/deploy/backup-db.sh
ls -lh /var/backups/populi-wa/
```

**Jadwalkan (cron harian 02:00):**
```bash
crontab -e
# tambahkan baris:
0 2 * * * STACK_DIR=/var/www/survei-wa /var/www/survei-wa/deploy/backup-db.sh >> /var/log/populi-wa-backup.log 2>&1
```

Default: simpan di `/var/backups/populi-wa/`, tahan **14 hari** (atur via `KEEP_DAYS`).

> 💡 Idealnya salin backup ke **luar VPS** juga (mis. `rclone` ke Google Drive/S3)
> agar aman bila VPS bermasalah. Backup di server yang sama tidak melindungi dari
> kehilangan server itu sendiri. → lihat §1b.

## 1b. Salin backup ke luar VPS (rclone — sangat disarankan)

Skrip sudah mendukung salin otomatis: bila env `RCLONE_REMOTE` diset, tiap backup
langsung disalin ke sana (dan salinan luar ikut dirotasi `KEEP_DAYS`).

**Pasang & konfigurasi rclone sekali:**
```bash
curl https://rclone.org/install.sh | sudo bash
rclone config          # buat remote, mis. Google Drive → beri nama "gdrive"
rclone lsd gdrive:     # uji koneksi
```

**Aktifkan di backup** — tambahkan `RCLONE_REMOTE` pada perintah/cron:
```bash
# uji manual:
STACK_DIR=/var/www/survei-wa RCLONE_REMOTE=gdrive:populi-wa-backup /var/www/survei-wa/deploy/backup-db.sh

# cron harian 02:00 dengan offsite:
0 2 * * * STACK_DIR=/var/www/survei-wa RCLONE_REMOTE=gdrive:populi-wa-backup /var/www/survei-wa/deploy/backup-db.sh >> /var/log/populi-wa-backup.log 2>&1
```
Tanpa `RCLONE_REMOTE`, skrip tetap jalan normal (hanya backup lokal). Contoh tujuan lain:
`s3:nama-bucket/populi-wa`, `b2:bucket/path`, `dropbox:populi-wa`.

## 2. Restore

⚠️ Restore **menimpa** data saat ini. Pastikan Anda memang ingin mengembalikan.

```bash
cd /var/www/survei-wa
# pilih file backup
gunzip -c /var/backups/populi-wa/populi-wa_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U populi -d populi
# restart backend agar koneksi bersih
docker compose -f deploy/docker-compose.prod.yml restart backend worker
```

## 3. Verifikasi backup bisa dipulihkan (uji berkala)

Backup yang tak pernah diuji = belum tentu bisa dipakai. Sesekali:
```bash
# buat DB uji sementara lalu restore ke situ (tidak mengganggu produksi)
docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U populi -d postgres -c "CREATE DATABASE restore_test;"
gunzip -c /var/backups/populi-wa/populi-wa_XXduplicate.sql.gz \
  | docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U populi -d restore_test
docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U populi -d restore_test -c '\dt'
docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U populi -d postgres -c "DROP DATABASE restore_test;"
```
