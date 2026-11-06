# Rencana Instagram: bisakah survei berjalan lewat DM Instagram?

Tujuan: menjawab apakah menu **Instagram** (sekarang "Segera hadir") bisa disambungkan ke Populi WA, sehingga survei berjalan lewat DM Instagram dan hasilnya menyatu dengan respons WhatsApp, ekspor, dan Google Sheets. Dokumen ini juga mencatat syarat di sisi Meta, perubahan kode, tahapan, dan keputusan yang perlu Anda ambil.

> **Arti tanda di dokumen ini**
> - Tanpa tanda: sudah pasti, karena dibaca dari dokumentasi resmi Meta atau dicek langsung di kode.
> - **(belum pasti)**: dari forum developer, blog pihak ketiga, atau kesimpulan kami. Harus diuji sebelum dijadikan pegangan.
>
> Keadaan per 6 November 2026. Dokumentasi Meta sering berubah, jadi cek ulang tautan di bagian Sumber sebelum mulai.
>
> **Status:** tahap 1 (MVP DM) sudah dibangun di aplikasi — halaman **Akun Instagram**, webhook `/webhook/instagram`, URL privasi `/webhook/instagram/hapus-data` dan `/webhook/instagram/deauthorize`, perpanjangan token otomatis, dan penandaan Sumber Kontak / Saluran "Instagram". Yang tersisa ada di sisi Meta (§3): aplikasi, izin, App Review, mode Live. Tahap 2 dan 3 belum.

---

## 1. Jawaban singkat

- **Bisa.** DM Instagram dapat masuk ke aplikasi sebagai "vendor" baru, sama seperti Meta Cloud API dan Qontak. Survei berjalan dalam **mode Chatbot** (pertanyaan per pesan). Respons tercatat dengan **Saluran = Instagram** dan ikut ke halaman Respons, ekspor, dan Sheets.
- **Mode Form (WhatsApp Flow) tidak bisa.** Flow adalah fitur WhatsApp. Messaging API Instagram tidak punya padanannya.
- **Bisnis tidak bisa memulai percakapan.** Tidak ada templat pesan dan tidak ada broadcast. Orang harus mengirim DM duluan: lewat iklan, tautan `ig.me`, komentar, atau ice breaker.
- **Kemungkinan besar tanpa biaya per pesan.** Tidak ditemukan tarif per pesan untuk Instagram Messaging API. Pernyataan resmi Meta "gratis digunakan" hanya tertulis untuk Messenger Platform **(belum pasti untuk Instagram)**. Biaya yang pasti ada: iklan dan server.
- **Tidak ada nomor HP dan lokasi.** Responden dikenali dari ID Instagram (IGSID). Provinsi ditanyakan lewat pertanyaan teks.
- **Hambatan terbesar ada di izin Meta, bukan di kode.** Praktis wajib **App Review** (lama tinjauannya tidak dicantumkan Meta; laporan pihak ketiga sekitar 5 hari kerja sampai ±20 hari, belum pasti). Proses ini harus selesai **sebelum** survei dimulai.
- **Untuk uji coba iklan sekarang**, pakai iklan bertujuan **WhatsApp**. DM yang datang dari iklan bertujuan Instagram Direct saat ini belum ditangani aplikasi sama sekali.

---

## 2. Yang bisa dan tidak bisa

| Hal | WhatsApp (sekarang) | Instagram DM |
|---|---|---|
| Memulai percakapan | Bisnis bisa memulai dengan templat yang disetujui | **Tidak bisa.** Hanya pengguna yang memulai |
| Broadcast / blast | Ada (templat, berbayar) | **Tidak ada.** Tidak ada templat. Sponsored Messages dan One-Time Notification tidak tersedia untuk Instagram |
| Formulir (Flow) | Ada (mode Form) | **Tidak ada padanan.** Hanya mode Chatbot |
| Chatbot (pertanyaan per pesan) | Ada | **Bisa.** Tombol cepat (quick reply) maksimal 13, label 20 karakter, dan **tidak tampil di desktop**. Teks maksimal 1.000 byte per pesan |
| Lokasi | Ada permintaan lokasi (`mintaLokasi`) | **Tidak ada.** Lokasi tidak termasuk jenis lampiran yang dikirim ke webhook |
| Nomor HP | Otomatis (nomor pengirim) | **Tidak ada.** Hanya IGSID dan username. Tombol "kirim nomor HP" sengaja dimatikan Meta di Instagram, jadi nomor harus diketik |
| Biaya per pesan | Ada (marketing/utility/authentication per pesan; sejak 1 Okt 2026 service di atas 1.000/bulan per nomor dan utility di dalam jendela 24 jam juga berbayar; nirlaba yang memenuhi syarat dibebaskan untuk service sampai 31 Des 2027) | Tidak ditemukan tarif per pesan **(belum pasti)** |
| Jendela balasan | 24 jam sejak pesan terakhir pengguna | 24 jam. Bila pesan pertama datang dari iklan Click-to-Direct, jendelanya bisa sampai **7 hari** |
| Iklan | Click-to-WhatsApp, sudah tercatat (commit 851cef4) | Iklan ke Instagram Direct bisa, tapi format datanya berbeda dari WhatsApp dan perlu parser sendiri |
| Komentar → DM | Tidak ada | **Bisa (tahap 2).** Satu balasan pribadi per komentar, dalam 7 hari. Percakapan baru terbuka setelah orangnya membalas |
| Grup | Tidak dipakai | Tidak didukung API |

Catatan kebijakan: Developer Policies Meta (§5.6.2(c)) menggolongkan polling dan kuesioner sebagai konten yang **tidak boleh** dikirim lewat Message Tag. Artinya, survei hanya boleh berjalan di dalam jendela standar. Tag "Human Agent" 7 hari tidak boleh dipakai untuk melanjutkan pertanyaan survei. Bahwa survei di dalam jendela standar diizinkan adalah tafsiran kami, karena tidak ada larangan eksplisit **(belum pasti)**.

---

## 3. Syarat di sisi Meta

### 3a. Akun dan aplikasi

| Yang disiapkan | Keterangan |
|---|---|
| Akun Instagram **profesional** (Bisnis atau Kreator) milik Populi Center | Wajib. Akun Kreator harus memanggil Conversations API dulu sebelum bisa menerima webhook |
| Pengaturan di aplikasi Instagram: **Pesan → Kontrol pesan → Alat yang terhubung → Izinkan akses ke pesan** | Wajib aktif. Menurut forum, pengaturan ini bisa mati lagi saat otorisasi ulang **(belum pasti)** |
| Aplikasi Meta tipe **Business**, terhubung ke portofolio bisnis Populi Center | Saran kami: aplikasi **terpisah** dari aplikasi WhatsApp, supaya urusan App Review Instagram tidak ikut menyeret WhatsApp produksi **(belum pasti, saran)** |
| Aplikasi dalam mode **Live / Published** | Wajib supaya webhook terkirim |
| Langganan webhook per akun IG | Menyimpan callback di dasbor saja belum cukup. Akun harus didaftarkan lewat panggilan `subscribed_apps` |

### 3b. Pilihan cara login (lihat keputusan di §8)

| | **Instagram Login** | **Facebook Login / Halaman** | **Unified Login** (baru) |
|---|---|---|---|
| Perlu Halaman Facebook? | Tidak | Ya | Tidak, cukup portofolio bisnis |
| Status menurut Meta | "Untuk integrasi yang sudah ada" | "Untuk integrasi yang sudah terhubung ke Halaman" | Disarankan untuk integrasi baru |
| Token | Token pengguna, berlaku 60 hari, bisa diperpanjang. Perlu tugas perpanjangan otomatis | Token Halaman | Token system user. Rinciannya masih tipis di dokumentasi |
| Izin pesan | `instagram_business_basic`, `instagram_business_manage_messages` (+ `..._manage_comments` untuk tahap 2) | `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata` | Keluarga izin `instagram_*` |

Scope lama `business_*` sudah tidak berlaku sejak 27 Jan 2025.

### 3c. Izin, App Review, dan verifikasi

- **Standard Access** hanya berlaku untuk orang yang punya peran di aplikasi (admin, developer, penguji). **Advanced Access** berlaku untuk publik, dan mensyaratkan **Business Verification** serta **App Review**.
- **Apakah App Review wajib untuk DM?** Halaman resmi Webhooks Setup Instagram menyebut Instagram Login membutuhkan **Advanced Access** untuk webhook, dan **Business Verification** wajib untuk akses produksi di ketiga cara login. Jadi App Review untuk izin pesan praktis wajib bila memakai Instagram Login. Dokumen Meta lain tidak seragam. Satu halaman menyebut aplikasi untuk bisnis sendiri cukup Standard Access. Halaman lain menyebut webhook dari orang yang tidak berperan di aplikasi butuh App Review. Ada juga laporan developer bahwa DM asli tidak masuk ke webhook saat aplikasi masih Standard Access **(belum pasti)**. **Rencanakan App Review** untuk `instagram_business_manage_messages`.
- **Untuk komentar → DM (tahap 2)**, Advanced Access **pasti wajib** untuk webhook `comments`.
- **Business Verification:** Populi kemungkinan sudah terverifikasi karena memakai WhatsApp Cloud API **(belum pasti, cek di Business Settings)**.
- **Isi pengajuan App Review:** minimal satu panggilan API yang berhasil; ikon 1024×1024; URL kebijakan privasi; kategori aplikasi; email bisnis. Untuk tiap izin: penjelasan kegunaan dan **video layar (screencast)** dari awal sampai akhir, sebaiknya dengan antarmuka berbahasa Inggris dan diberi keterangan. Untuk izin pesan, sebutkan apakah aplikasinya bot otomatis, inbox manusia, atau keduanya, dan sertakan daftar perintah uji. Meminta izin pesan otomatis ikut menambahkan fitur Human Agent.

### 3d. Privasi dan penghapusan data

- Kebijakan privasi **publik** yang menjelaskan cara meminta penghapusan data (Platform Terms §4). Halaman `docs/privasi-survei-wa.html` perlu diperluas untuk Instagram **(belum pasti, perlu dicek isinya)**.
- Di pengaturan login aplikasi: **OAuth redirect URI**, **deauthorize callback URL**, dan **data deletion request URL**. Callback penghapusan menerima permintaan bertanda tangan berisi ID pengguna, lalu membalas dengan URL status dan kode konfirmasi. Endpoint ini **belum ada** di aplikasi dan perlu dibuat.
- Keterbukaan bot: kebijakan Messenger Platform mewajibkan bot otomatis membalas dalam 30 detik dan, bila hukum mewajibkan, memberi tahu bahwa pengguna bicara dengan layanan otomatis. Penerapannya untuk Instagram belum tegas **(belum pasti)**. Jalur ke manusia sangat disarankan (dan wajib bila memakai tag Human Agent), tetapi tidak tertulis wajib untuk semua bot.

### 3e. Perkiraan waktu (kalender, bukan kerja)

| Langkah | Perkiraan |
|---|---|
| Siapkan akun IG profesional, aplikasi, kebijakan privasi, URL penghapusan | 1–3 hari |
| Bangun MVP (bagian 5) sampai bisa direkam untuk App Review | lihat ukuran kerja |
| Tinjauan App Review | Meta tidak mencantumkan lamanya. Laporan pihak ketiga sekitar 5 hari kerja sampai ±20 hari, dan setiap pengajuan ulang setelah ditolak memulai hitungan dari awal **(belum pasti)** |
| Uji dengan akun IG yang **tidak** berperan di aplikasi, satu iklan kecil, dan satu tautan `ig.me` | 2–3 hari |

Kesimpulan: untuk survei yang hanya berjalan beberapa hari, **mulailah sekitar 6–8 minggu sebelum survei Instagram pertama** **(perkiraan)**.

---

## 4. Bagaimana data menyatu

- **Saluran = Instagram.** Kolom `SurveyResponse.saluran` sudah ada (bawaan `"whatsapp"`), dan label `instagram` sudah terdaftar di `backend/src/lib/jalurRespons.ts`. Namun kolom ini **belum pernah diisi eksplisit**: ketiga tempat pembuatan respons di `surveyEngine.ts` memakai nilai bawaan. Perlu ditambahkan stempel saluran saat survei dimulai.
- **Identitas = IGSID**, bukan username (username bisa diganti). IGSID dibuat saat seseorang mengirim DM atau berkomentar. ID ini berlaku untuk satu pasangan orang dan satu akun IG bisnis. Username dan nama diambil lewat User Profile API hanya untuk ditampilkan.
- **Sekali mengisi per akun IG.** Aturan "sudah pernah mengisi" saat ini berlaku per kontak, jadi otomatis berlaku per akun IG. Satu orang dengan dua akun IG tetap bisa mengisi dua kali.
- **Ganda lintas WA–IG.** Orang yang sama lewat WA dan IG tercatat sebagai dua kontak. Ada dua pilihan (lihat keputusan di §8):
  1. **Tanyakan nomor HP** di survei IG, lalu cocokkan dengan respons WA di survei yang sama. Nomor ini diketik sendiri dan tidak terverifikasi, jadi tandai sebagai **calon ganda**, jangan langsung ditolak. Perlu kalimat persetujuan (UU PDP Pasal 20–22), dan nomor itu **tidak otomatis boleh** dipakai untuk blast.
  2. **Tidak bertanya**, lalu tandai calon ganda saat audit mutu data (misalnya pola jawaban dan waktu yang sangat mirip).
- **Wilayah lewat pertanyaan teks.** Pertanyaan wilayah (`surveyLogic.ts`) dan kuota per provinsi dari jawaban wilayah (`surveyEngine.ts`) sudah berjalan apa adanya. Letakkan pertanyaan wilayah **di awal**, karena kontak IG tidak membawa atribut provinsi hasil impor. Kolom **Provinsi Lokasi** dan **Status Lokasi** di Sheets akan **kosong** untuk responden IG.
- **Kolom "Nomor"** di Sheets dan ekspor diisi label pengenal, misalnya `@username` atau `ig:<IGSID>`. Label ini wajib unik, karena Sheets mencocokkan baris dengan Nomor + waktu Mulai. Kalau kosong, dua responden IG yang mulai di menit yang sama bisa bentrok.
- **Jalur Masuk** tetap "Iklan" bila datang dari iklan (ID Iklan diambil dari data referral Instagram), "Kata pemicu" bila mengetik kata pemicu. Tahap 2 menambah jalur **"Komentar"**. Kode di tautan `ig.me?ref=...` bisa dipakai sebagai pengganti kata pemicu per enumerator atau per QR **(belum pasti, perlu diuji)**.

---

## 5. Perubahan di aplikasi

Ukuran: **S** = kecil (jam sampai 1 hari), **M** = sedang (beberapa hari), **L** = besar. Berdasarkan pembacaan kode, bukan janji jadwal.

| Area | Yang diubah | Berkas utama | Ukuran |
|---|---|---|---|
| Penyambung Instagram | Adaptor baru: verifikasi webhook (GET `hub.challenge`) dan tanda tangan `X-Hub-Signature-256`; baca `entry[].messaging[]`; **buang pesan echo** (pesan bot sendiri) agar bot tidak membalas dirinya sendiri; buang reaksi dan pesan yang dihapus; ubah quick reply menjadi teks; baca referral iklan Instagram; bersihkan markup WA (`*tebal*`); pecah teks lebih dari 1.000 byte; tanda dibaca | baru `backend/src/providers/instagram.ts`; `providers/types.ts`; `providers/registry.ts`; `routes/webhooks.ts` (GET verifikasi kini hanya untuk `/webhook/meta`); `routes/vendors.ts` (daftar izin kini `["meta","qontak"]`) | M |
| Identitas kontak | `Contact.phone` kini wajib dan unik. Dibuat opsional, ditambah `igsid` (unik) dan `igUsername`, dengan aturan "minimal salah satu terisi". Migrasi tidak menyentuh baris lama. **Jangan** memasukkan IGSID ke kolom nomor: penormal nomor menambah "62" pada ID yang diawali 8, dan ID itu akan ikut ke daftar blokir, blast, dan kolom Nomor | backend: `prisma/schema.prisma`; `services/surveyEngine.ts` (titik masuk identitas); `lib/phone.ts`; `lib/optOutList.ts`; `routes/contacts.ts`, `segments.ts`, `blasts.ts`, `templates.ts`, `baileys.ts`; `services/blastService.ts` dan `queue/worker.ts` (saring kontak tanpa nomor); `scripts/audit-mutu-data.ts`, `scripts/lengkapi-sheets-durasi.ts`. Frontend: `src/lib/exportKontak.js`, `src/lib/contactImport.jsx`, `src/pages/Dashboard.jsx`, `src/pages/chatbox/DetailsPanel.jsx`, `src/pages/blast/BlastReportModal.jsx`, `src/pages/blast/ManageSegmentModal.jsx`. Setelah `phone` boleh kosong, tipenya berubah ke `string \| null` di semua tempat itu | M–L |
| Mesin survei | Stempel `saluran`; opt-out tanpa nomor; **perbaikan bug**: sesi berjalan memeriksa mode survei, bukan metode yang dipakai responden. Akibatnya responden yang menerima pertanyaan versi chat pada survei mode Form mendapati jawabannya dialihkan ke Auto Reply, dan survei tidak pernah maju. **Bug ini sudah berlaku hari ini untuk Qontak, Baileys, dan nomor Meta yang survei Form-nya belum punya Flow ID.** Titik yang perlu diubah: pemilihan sesi berjalan, penanganan lokasi, dan cadangan balasan Flow di `surveyEngine.ts`. Respons lama tanpa nilai metode memakai mode survei sebagai cadangan | `services/surveyEngine.ts`; `lib/jalurRespons.ts` | S–M |
| Sheets, ekspor, halaman Respons | Label Nomor untuk kontak IG, kunci baris yang unik, saluran ditampilkan | `lib/sheetRows.ts`; `queue/worker.ts`; `services/lokasiSheet.ts`; `routes/surveys.ts`; `src/lib/exportSurvey.js` | S |
| Biaya | Hitungan pesan keluar kini menganggap **semua** pesan sebagai pesan WA berbayar, termasuk pesan lewat Qontak dan Baileys yang tidak ditagih Meta. Perbaikannya sekaligus: hitung hanya pesan dengan vendor `meta`, sehingga pesan IG juga tidak ikut | `backend/src/routes/biaya.ts` | S |
| Frontend | Halaman **Akun Instagram** menggantikan "Segera hadir" (meniru halaman Akun WhatsApp: kredensial, URL callback, status, panduan setup); saring daftar vendor di halaman WA dan Broadcast; pengaman untuk kontak tanpa nama dan nomor (kini bisa error di Chat); lencana saluran dan `@username` di Chat, Kontak, Respons | `src/PopuliApp.jsx` (menu dan halaman Instagram); `src/lib/izinHalaman.js` (halaman Instagram masuk daftar khusus superadmin, karena memegang kredensial; rute kredensialnya juga perlu `requireSuperadmin`); `src/pages/WhatsAppAccount.jsx` dan `src/pages/waAccount/*`; `src/pages/blast/BroadcastGuide.jsx`; `src/pages/Chat.jsx`; `src/pages/chatbox/*`; `src/pages/Contacts.jsx`; `src/pages/survey/SurveyResponses.jsx` | M |
| Profil | Nama dan username dari User Profile API | adaptor Instagram | S |
| Privasi Meta | Endpoint callback penghapusan data dan deauthorize; tugas perpanjangan token 60 hari (bila memakai Instagram Login) | baru, di `backend/src/routes/` | S–M |
| Setup Meta | Akun, izin, App Review, kebijakan privasi, video layar | di luar kode | L (waktu kalender) |
| Tahap 2: komentar → DM | Webhook `comments`, cocokkan kata kunci, balasan pribadi, jalur "Komentar" | adaptor + `jalurRespons.ts` | M |
| Tahap 3: inbox terpadu | Filter per saluran, balas manual per saluran, tag Human Agent 7 hari untuk balasan manusia | `Chat.jsx`, `chatbox/*`, `routes/contacts.ts` | M |
| Ganda lintas saluran | Pertanyaan nomor HP, penautan dan penggabungan kontak | mesin survei, kontak, audit mutu | M–L |

Yang **sudah berlaku umum** dan tidak perlu diubah: mode "Bot diam", Auto Reply dan Agen AI, pencocokan kata opt-out (tetapi penyimpanan opt-out ke daftar blokir berbasis nomor perlu diubah, lihat baris Mesin survei), format pertanyaan chatbot bernomor, kuota global, pesan "kuota penuh" dan "survei berakhir", laporan dan peta (berbasis provinsi, tidak memakai nomor).

Batas yang perlu diingat saat menyusun survei untuk IG: pilihan jawaban maksimal 13 dengan label 20 karakter bila ingin tampil sebagai tombol (di desktop tombol tidak tampil, jadi angka ketikan tetap diterima); daftar 38 provinsi diketik; hindari pertanyaan bertipe gambar dan pertanyaan "kirim lokasi".

Perkiraan total MVP (baris Penyambung Instagram sampai Privasi Meta, tanpa Setup Meta dan tahap 2–3): kira-kira **3–4 minggu kerja pengembang** **(perkiraan kasar)**, di luar waktu tunggu App Review. Angka ini naik dari perkiraan awal 2–3 minggu karena perubahan identitas kontak menyentuh lebih banyak berkas.

---

## 6. Tahapan

| Tahap | Isi | Syarat |
|---|---|---|
| **0. Sekarang (tanpa kode)** | Uji coba iklan pakai tujuan **WhatsApp**. Mulai urus akun IG profesional, aplikasi Meta, kebijakan privasi. Perbaiki bug cek mode Form (berguna juga untuk Qontak dan Baileys) | — |
| **1. MVP DM** | Terima DM IG, survei chatbot lewat kata pemicu dan iklan Click-to-Direct, respons bertanda Saluran Instagram, masuk ekspor dan Sheets, halaman Akun Instagram | App Review izin pesan disetujui (atau terbukti tidak perlu); uji dengan akun yang tidak berperan |
| **2. Komentar → DM** | Orang berkomentar dengan kata kunci di posting atau iklan; bot membalas sekali secara pribadi dengan tombol "Mulai survei"; ketukan itu membuka jendela 24 jam | Advanced Access untuk komentar (pasti wajib); akun IG publik |
| **3. Inbox terpadu** | Chat WA dan IG dalam satu inbox, filter saluran, balasan manual dengan tag Human Agent | Inbox manusia memang wajib bila memakai tag Human Agent |
| **4. Opsional** | Penautan identitas WA–IG; Facebook Messenger (di Messenger, tombol "kirim nomor HP" tersedia) | Keputusan setelah melihat hasil tahap 1 |

---

## 7. Risiko

1. **Waktu tunggu Meta.** Kalau App Review belum disetujui saat survei dimulai, DM dari publik bisa tidak masuk sama sekali. Uji dulu dengan akun yang tidak punya peran di aplikasi.
2. **Iklan berjalan, bot tidak membalas.** Sama seperti di WA: bila survei belum berjalan atau "Bot diam" aktif, iklan tetap dibayar tetapi orang tidak dilayani. Jeda iklan secara manual.
3. **Banyak yang berhenti di tengah.** Mode chatbot lebih panjang dirasakan daripada Form. Untuk uji coba pertama, pakai survei pendek (sekitar 5–10 pertanyaan) **(saran)**.
4. **Responden ganda lintas WA–IG** (lihat §4).
5. **Mutu sampel.** Responden iklan memilih sendiri; demografi pengguna IG berbeda dari WA. Analisis terpisah per Saluran dan Jalur Masuk sebelum digabung.
6. **Token kedaluwarsa** (Instagram Login: 60 hari). Tanpa perpanjangan otomatis, penyambung berhenti diam-diam.
7. **Webhook terkirim ulang.** Meta mengirim ulang selama 36 jam bila gagal. Mesin saat ini belum menyaring pesan ganda berdasarkan ID pesan.
8. **Folder Permintaan.** DM dari orang yang tidak mengikuti akun masuk ke "Permintaan" dan baru pindah setelah dibalas lewat API. Permintaan yang tidak aktif 30 hari tidak terbaca API.
9. **Topik politik di iklan.** Indonesia termasuk daftar "pemilu atau politik saja" di kebijakan iklan Meta: iklan yang menyebut tokoh, partai, atau pemilu wajib otorisasi dan penafian "Dibayar oleh". Ajakan survei netral kemungkinan tidak termasuk **(belum pasti)**.

---

## 8. Keputusan yang perlu Anda ambil

| Keputusan | Pilihan | Saran kami |
|---|---|---|
| Cara login | **Instagram Login** (tanpa Halaman FB, token 60 hari) · **Halaman Facebook** (perlu Halaman, token Halaman, membuka jalan ke Messenger) · **Unified Login** (disarankan Meta, rinciannya masih tipis) | Instagram Login untuk MVP: paling sederhana untuk satu akun sendiri, dan pindah setup nanti sebagian besar hanya soal host dan token **(belum pasti)**. Label "untuk integrasi yang sudah ada" bisa berarti jalur ini akan dipensiunkan |
| Tanya nomor HP di survei IG? | Ya (cegah ganda, tambah data pribadi dan friksi) · Tidak (tandai calon ganda saat audit) | Tergantung tujuan: bila menggabungkan sampel WA dan IG untuk satu angka, tanyakan; bila IG dianalisis terpisah, tidak perlu |
| Aplikasi Meta terpisah? | Satu aplikasi dengan WhatsApp · Aplikasi khusus Instagram | Aplikasi terpisah, supaya App Review Instagram tidak berisiko untuk WA produksi |
| Ikut tahap 2 (komentar)? | Ajukan izin komentar sekaligus · Nanti | Sekaligus, karena App Review memakan waktu kalender yang sama |
| Akun IG mana | Akun utama Populi Center · Akun khusus survei | Akun yang sama namanya dengan Halaman FB, bila iklan politik mungkin dipakai (otorisasi IG terpisah bila namanya berbeda) |

---

## Sumber

Semua sumber diringkas dengan kata sendiri, bukan disalin.

- Instagram Platform, overview: https://developers.facebook.com/docs/instagram-platform/overview
- Instagram API dengan Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- Messaging API (jendela 24 jam / 7 hari, batas 1.000 byte): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Quick replies: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies.md
- User Profile API: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile.md
- Tautan ig.me: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/ig-me.md
- Iklan welcome message: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/welcome-message-ads.md
- Webhook (field, setup, contoh): https://developers.facebook.com/documentation/instagram-platform/webhooks/fields · https://developers.facebook.com/documentation/instagram-platform/webhooks/setup · https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
- Webhook Instagram Messaging (referral iklan): https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks
- Private Replies: https://developers.facebook.com/docs/instagram-platform/private-replies
- App Review: https://developers.facebook.com/documentation/instagram-platform/app-review · https://developers.facebook.com/documentation/business-messaging/instagram-messaging/app-review/apps-for-your-own-business
- Tingkat akses: https://developers.facebook.com/docs/graph-api/overview/access-levels
- Membuat aplikasi Instagram: https://developers.facebook.com/documentation/instagram-platform/create-an-instagram-app.md
- Callback penghapusan data: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
- Messenger Platform (gratis digunakan): https://developers.facebook.com/docs/messenger-platform/overview
- Kebijakan Messenger dan eskalasi ke manusia: https://developers.facebook.com/docs/messenger-platform/policy/policy-overview · https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/human-agent-escalation
- Developer Policies dan Platform Terms: https://developers.facebook.com/devpolicy/ · https://developers.facebook.com/terms/dfc_platform_terms/
- Kebijakan iklan isu sosial, pemilu, politik: https://transparency.meta.com/policies/ad-standards/SIEP-advertising/SIEP/ · https://www.facebook.com/business/help/2150157295276323
- UU 27/2022 (PDP): https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- Forum dan pihak ketiga (belum pasti): https://developers.facebook.com/community/threads/2029428894384878/ · https://developers.facebook.com/community/threads/2119529588613973/ · https://bundle.social/blog/meta-app-review-20-days
