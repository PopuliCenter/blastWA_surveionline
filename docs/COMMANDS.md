# Perintah Setup — jalankan saat siap (Fase 0 + run)

> Saat dokumen ini dibuat, shell sedang tidak bisa dijalankan otomatis.
> Jalankan perintah berikut secara manual (PowerShell di Windows) sesuai urutan.

## Fase 0 — Git & bersih-bersih

```powershell
cd "D:\Survei Apps\apps-populi-wa"

# Inisialisasi git
git init
git add -A
git commit -m "Initial: prototype + backend multi-vendor + docs"

# Hapus file frontend lama yang tidak terpakai
Remove-Item "src\wa_survey_app.jsx"
```

## Backend — install & DB

```powershell
cd "D:\Survei Apps\apps-populi-wa\backend"
Copy-Item .env.example .env

# Generate kunci enkripsi 32-byte hex, lalu tempel ke CREDENTIALS_ENC_KEY di .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Set juga JWT_SECRET (string acak panjang) di .env

npm install

# Database + Redis (butuh Docker Desktop berjalan)
cd "D:\Survei Apps\apps-populi-wa"
docker compose up -d postgres redis

cd backend
npx prisma migrate dev --name init   # buat tabel
npm run seed                          # buat user admin (populi / populi13!)
```

## Menjalankan (3 terminal)

```powershell
# Terminal 1 — API
cd "D:\Survei Apps\apps-populi-wa\backend"; npm run dev

# Terminal 2 — Worker blast
cd "D:\Survei Apps\apps-populi-wa\backend"; npm run dev:worker

# Terminal 3 — Frontend
cd "D:\Survei Apps\apps-populi-wa"; npm run dev
```

Cek backend hidup: buka http://localhost:3000/health → `{ "ok": true }`.

## Webhook publik saat dev

```powershell
# salah satu:
cloudflared tunnel --url http://localhost:3000
ngrok http 3000
```
Pakai URL hasilnya sebagai Callback URL di Meta/Qontak (lihat SETUP-META-QONTAK.md).

## Typecheck backend (opsional, verifikasi kode)

```powershell
cd "D:\Survei Apps\apps-populi-wa\backend"; npm run typecheck
```
