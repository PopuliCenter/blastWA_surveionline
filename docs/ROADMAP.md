# Roadmap — Populi WA Survey Platform

Tujuan akhir: aplikasi survei WhatsApp yang **benar-benar mengirim & menerima pesan**, multi-vendor (Qontak + Meta Cloud API langsung + BSP lain), dengan data tersimpan aman di database.

Legenda status: ☐ belum · ◐ sebagian · ☑ selesai

---

## Fase 0 — Rapikan & amankan fondasi (1–2 hari)

Tujuan: repo bersih & siap dikembangkan, tanpa mengubah fungsi.

- ☐ Inisialisasi **git** (`git init`) + commit pertama. (Saat ini bukan git repo.)
- ☐ Hapus file mati `src/wa_survey_app.jsx` (tidak dipakai; `App.jsx` mengarah ke `PopuliApp.jsx`).
- ☐ Pindahkan frontend ke `frontend/` (siapkan struktur monorepo — lihat ARCHITECTURE §8).
- ☐ **Hapus penyimpanan token vendor di browser** (form `wapiKey`/Qontak di Settings). Token akan dikelola backend.
- ☐ Tambah `.env.example` & pastikan `.env` ada di `.gitignore`.
- ☐ Tulis `README.md` proyek yang benar (sekarang masih README bawaan template Vite).

**Milestone:** repo rapi, frontend tetap jalan sebagai demo, tidak ada rahasia di kode.

---

## Fase 1 — Backend MVP & abstraksi vendor (3–5 hari)

Tujuan: server hidup, bisa terima webhook, dan punya kerangka adapter vendor.

- ☐ Setup backend (Fastify/Express + TypeScript) + `docker-compose` (PostgreSQL + Redis).
- ☐ Skema database awal via Prisma (User, Survey, Contact, Blast, Message, VendorConfig, WebhookLog).
- ☐ **Auth sungguhan**: login → JWT, password di-hash (argon2/bcrypt). Ganti login localStorage.
- ☐ Definisikan interface `MessagingProvider` + `registry` (ARCHITECTURE §3).
- ☐ **Webhook receiver**:
  - `GET /webhook/meta` (verifikasi `hub.challenge`)
  - `POST /webhook/meta` (verifikasi `X-Hub-Signature-256`, parse inbound)
  - `POST /webhook/qontak` (verifikasi secret, parse inbound)
  - Semua event tercatat di `webhook_logs`.
- ☐ Enkripsi kredensial vendor at-rest (AES-GCM, kunci dari env).

**Milestone:** kirim event uji ke `/webhook/meta` & `/webhook/qontak` → tercatat & ternormalisasi di DB. (Pakai ngrok/cloudflared untuk URL publik saat dev.)

---

## Fase 2 — Pengiriman nyata & mesin survei (5–8 hari)

Tujuan: blast benar-benar terkirim, balasan tersimpan & terhubung ke survei.

- ☐ Adapter **MetaCloudAdapter.sendTemplate()** → `POST /{phone_number_id}/messages`.
- ☐ Adapter **QontakAdapter.sendTemplate()** → `POST /broadcasts/whatsapp/direct`.
- ☐ Queue blast (BullMQ): satu job per kontak, dengan **rate limit**, **retry**, dan **delay** (field `blastDelay`/`retryCount` di Settings dipakai sungguhan).
- ☐ Update status delivery dari webhook (`sent → delivered → read`) ke `BlastRecipient`.
- ☐ **Mesin survei**: pesan masuk → cocokkan ke survei/pertanyaan aktif → simpan `Answer` → kirim pertanyaan berikutnya (alur tanya-jawab via WhatsApp), atau kirim **link survei** (`surveyBaseUrl`) bila pakai form web.
- ☐ Switch vendor aktif dari UI Settings (Qontak ⇄ Meta).
- ☐ Sambungkan semua halaman frontend ke API backend (ganti localStorage → fetch API).

**Milestone:** buat 1 survei → blast ke segmen uji (nomor sendiri) → terima & simpan jawaban → muncul di Laporan dengan angka **nyata**.

---

## Fase 3 — Produksi & operasional (3–5 hari)

Tujuan: layak dipakai user sungguhan.

- ☐ Approve **template message** di Meta Business Manager (atau via Qontak) — lihat SETUP §5.
- ☐ Deploy backend + frontend (domain + HTTPS), daftarkan URL webhook produksi.
- ☐ Monitoring & alert (log terstruktur, error tracking, mis. Sentry).
- ☐ Backup database terjadwal.
- ☐ Manajemen opt-in/opt-out penerima (kepatuhan WhatsApp).
- ☐ Rate-limit & quota guard (hindari kena limit/ban dari Meta).
- ☐ Uji beban blast (mis. ribuan kontak) + retry/backoff.

**Milestone:** kampanye survei produksi pertama berjalan end-to-end.

---

## Fase 4 — Penyempurnaan (opsional, berkelanjutan)

- ☐ BSP ketiga (tulis adapter baru — tidak mengubah kode lain).
- ☐ Tipe pertanyaan kaya (pilihan ganda interaktif WhatsApp: buttons/list).
- ☐ Analitik lanjutan (response rate, funnel, segmentasi hasil).
- ☐ Multi-tenant / multi-WABA bila melayani banyak klien.
- ☐ Penjadwalan kampanye & template management dari UI.
- ☐ Export laporan (CSV/Excel/PDF).

---

## Estimasi kasar

| Fase | Hasil | Estimasi |
|---|---|---|
| 0 | Repo bersih & aman | 1–2 hari |
| 1 | Backend + webhook + adapter skeleton | 3–5 hari |
| 2 | Kirim/terima nyata + mesin survei | 5–8 hari |
| 3 | Produksi | 3–5 hari |

Total MVP yang **benar-benar jalan**: ± 2–4 minggu kerja terfokus (di luar waktu tunggu approval template Meta, yang bisa beberapa jam–hari).

---

## Risiko & catatan

- **Approval template Meta** adalah jalur kritis — mulai ajukan sejak Fase 1/2 karena butuh waktu & bisa ditolak (perbaiki & ajukan ulang).
- **24-hour window**: pesan bebas (non-template) hanya boleh dalam 24 jam sejak balasan terakhir user. Blast awal **wajib template**.
- **Satu WABA umumnya satu BSP aktif.** Untuk benar-benar pakai Qontak *dan* Meta langsung bersamaan, kemungkinan perlu nomor/WABA berbeda, atau migrasi nomor antar BSP. Perlu dikonfirmasi — lihat SETUP §6.
- Biaya: Meta langsung lebih murah; Qontak menambah kemudahan + markup.
