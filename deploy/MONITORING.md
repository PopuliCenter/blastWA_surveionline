# Monitoring app WA (uptime + error log)

Dua lapis pemantauan ringan tanpa layanan berbayar.

## 1. Uptime monitor (deteksi app mati)

Backend punya endpoint sehat yang sudah diproxy publik:
```
https://wa.risetcenter.com/health   →   {"ok":true,"ts":"..."}
```

Daftarkan di monitor gratis (mis. **UptimeRobot**, **BetterStack**, **Hetrix**):
- Tipe: **HTTP(s)**, URL `https://wa.risetcenter.com/health`, interval 1–5 menit.
- Keyword (opsional): pastikan respons memuat `"ok":true`.
- Alert ke email/Telegram bila down.

## 2. Error log terstruktur (diagnosa saat ada masalah)

Backend & worker menulis error (5xx, promise gagal, exception, gagal start) sebagai
**1 baris JSON per error** ke folder yang di-mount ke host: `/var/log/populi-wa/`.

```bash
# lihat error backend terbaru:
tail -n 50 /var/log/populi-wa/backend.log
# pantau realtime:
tail -f /var/log/populi-wa/backend.log
# error worker (blast/queue):
tail -f /var/log/populi-wa/worker.log

# cari error tertentu (mis. terkait Meta):
grep -i meta /var/log/populi-wa/backend.log

# ringkas pesan error unik + jumlahnya:
cat /var/log/populi-wa/backend.log | sed 's/.*"message":"//; s/".*//' | sort | uniq -c | sort -rn | head
```

Setiap baris berisi: `ts`, `source` (backend/worker), `name`, `message`, `stack`, dan
`context` (mis. `method`, `url`, `ip`, atau `kind`). Karena JSON, bisa juga diproses `jq`:
```bash
tail -f /var/log/populi-wa/backend.log | jq -r '"\(.ts) [\(.source)] \(.message)"'
```

Catatan: hanya **error server (5xx)** yang dicatat — error klien biasa (400/401/429)
sengaja diabaikan agar log tidak berisik. Log ini murni lokal (tidak dikirim ke mana pun).

> Rotasi opsional bila log membesar — tambahkan `/etc/logrotate.d/populi-wa`:
> ```
> /var/log/populi-wa/*.log { weekly rotate 8 compress missingok notifempty copytruncate }
> ```
