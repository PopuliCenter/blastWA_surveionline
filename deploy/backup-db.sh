#!/usr/bin/env bash
# =============================================================================
# Backup DB PostgreSQL app WA (stack "survei-wa") → file .sql.gz + rotasi.
# Aman dijalankan via cron. Contoh cron harian 02:00:
#   0 2 * * * STACK_DIR=/var/www/survei-wa /var/www/survei-wa/deploy/backup-db.sh >> /var/log/populi-wa-backup.log 2>&1
#
# Env opsional (ada default):
#   STACK_DIR (default /var/www/survei-wa), BACKUP_DIR (default /var/backups/populi-wa),
#   KEEP_DAYS (default 14), DB_USER (populi), DB_NAME (populi)
# =============================================================================
set -euo pipefail

STACK_DIR="${STACK_DIR:-/var/www/survei-wa}"
COMPOSE_FILE="$STACK_DIR/deploy/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/populi-wa}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_USER="${DB_USER:-populi}"
DB_NAME="${DB_NAME:-populi}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/populi-wa_${TS}.sql.gz"

cd "$STACK_DIR"
# -T: tanpa TTY (aman untuk cron). pg_dump → gzip → file.
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUT"

# Verifikasi hasil tidak kosong (deteksi kegagalan diam-diam).
if [ ! -s "$OUT" ]; then
  echo "[$(date)] GAGAL: file backup kosong, dihapus." >&2
  rm -f "$OUT"
  exit 1
fi
echo "[$(date)] OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Rotasi: hapus backup lebih tua dari KEEP_DAYS hari.
find "$BACKUP_DIR" -name 'populi-wa_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "[$(date)] Rotasi selesai (simpan $KEEP_DAYS hari terakhir)."

# Salin ke penyimpanan LUAR VPS (opsional tapi sangat disarankan).
# Set RCLONE_REMOTE ke tujuan rclone, mis. "gdrive:populi-wa-backup" atau "s3:bucket/path".
# Backup di server yang sama tidak melindungi bila server itu sendiri hilang.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    if rclone copy "$OUT" "$RCLONE_REMOTE"; then
      echo "[$(date)] Offsite OK: tersalin ke $RCLONE_REMOTE"
      # Rotasi salinan luar juga (best-effort; abaikan bila remote tak mendukung).
      rclone delete --min-age "${KEEP_DAYS}d" "$RCLONE_REMOTE" 2>/dev/null || true
    else
      echo "[$(date)] PERINGATAN: gagal menyalin ke $RCLONE_REMOTE." >&2
    fi
  else
    echo "[$(date)] PERINGATAN: RCLONE_REMOTE diset tapi 'rclone' belum terpasang." >&2
  fi
fi
