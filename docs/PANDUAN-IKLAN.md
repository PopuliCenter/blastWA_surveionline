# Panduan Iklan Instagram/Facebook → WhatsApp untuk Survei

Tujuan: menjalankan iklan Instagram/Facebook yang **membuka WhatsApp** (click-to-WhatsApp), sehingga orang **memulai survei sendiri** di nomor Populi WA, lalu **membandingkan mutu dan biaya** jalur iklan dengan Broadcast dan Kata pemicu.

Pembaca: tim survei Populi Center dan siapa pun yang mengelola Ads Manager. Bukan untuk pengembang.

> **Penting:** tampilan Meta sering berubah. Di panduan ini setiap langkah dijelaskan menurut **tujuannya**, lalu label yang kami temukan per November 2026. Kalau labelnya berbeda di layar Anda, cari pilihan yang tujuannya sama. Hal yang belum pasti ditandai **(belum pasti)**.

Keadaan per 6 November 2026.

---

## Ringkasan

- Iklan IG/FB ke WhatsApp **sudah bisa dipakai sekarang**. Tidak perlu integrasi Instagram di aplikasi, karena orangnya masuk lewat WhatsApp.
- Aplikasi **mencatat** responden dari iklan: kolom **Jalur Masuk = Iklan** dan **ID Iklan** (sejak pembaruan November 2026).
- Survei **hanya mulai bila teks pesan cocok dengan kata pemicu**. Jadi pesan isi otomatis di iklan harus **sama persis** dengan kata pemicu.
- Data WhatsApp **tidak menyebut** Instagram atau Facebook. Untuk membedakannya, buat **ad set terpisah** per platform, lalu pisahkan menurut ID Iklan.
- Teks iklan **jangan** menyebut pemilu, partai, calon, atau pejabat. Iklan seperti itu wajib otorisasi khusus Meta di Indonesia.
- **Hentikan iklan** saat survei ditutup atau kuota penuh. Aplikasi tidak menghentikan iklan secara otomatis.

### Daftar periksa satu halaman

**Sebelum iklan (H-5 sampai H-1)**

| | Langkah | Bagian |
|---|---|---|
| ☐ | Nomor WhatsApp Meta (Cloud API) sudah ada di business portfolio dan tertaut ke Halaman FB | §2 |
| ☐ | Akun iklan punya metode pembayaran; WABA juga punya metode pembayaran | §2 |
| ☐ | Teks dan gambar iklan dicek: tidak politis, tidak menyapa atribut pribadi | §7 |
| ☐ | Survei dibuat, kata pemicu unik dipasang, pemicu otomatis menyala | §3 |
| ☐ | Batas pengisian **Sekali saja**, kuota global & per provinsi diisi | §3 |
| ☐ | Pertanyaan persetujuan dan saring usia 18+ ada di awal survei | §3, §7 |
| ☐ | Mode Form: **Flow ID** terisi dan formulir benar-benar muncul di HP uji | §3.2 |
| ☐ | Diuji dengan HP sendiri: ketuk iklan → survei mulai → tercatat **Iklan** | §3.4 |
| ☐ | Iklan diajukan paling lambat **1–2 hari** sebelum survei (**1–2 minggu** bila perlu otorisasi politik) | §4 |

**Saat iklan berjalan (setiap hari)**

| | Langkah | Bagian |
|---|---|---|
| ☐ | Cek halaman Respons dan Google Sheets: respons Jalur **Iklan** bertambah | §5 |
| ☐ | Cek layar Kuota; **matikan ad set provinsi** yang kuotanya penuh | §5 |
| ☐ | Balas pertanyaan di menu Chat dalam **24 jam** | §5 |
| ☐ | Jangan mengubah materi atau target iklan di tengah jalan | §4 |

**Sesudah iklan**

| | Langkah | Bagian |
|---|---|---|
| ☐ | **Jeda/akhiri iklan** bersamaan dengan menutup survei | §5 |
| ☐ | Ekspor respons; unduh belanja per iklan dari Ads Manager | §6 |
| ☐ | Isi tabel perbandingan per jalur | §6 |
| ☐ | Laporkan hasil per jalur; sampel iklan bukan sampel probabilitas | §7 |

---

## 1. Cara kerjanya

1. Orang melihat iklan di Instagram atau Facebook, lalu **mengetuk tombol WhatsApp**.
2. WhatsApp terbuka ke nomor Populi WA dengan **pesan isi otomatis** di kolom ketik, misalnya `Ikut Survei Populi`.
3. Orang **menekan kirim**. Pesan itu membawa data iklan (ID iklan dan judulnya) ke aplikasi.
4. Aplikasi **mencatat data iklan** di kontak. Ini terjadi lebih dulu, sebelum langkah lain.
5. Bila teks pesan **cocok dengan kata pemicu** survei yang Aktif, survei mulai (Form atau Chatbot).
6. Respons ditandai **Jalur Masuk = Iklan** dan **ID Iklan** terisi.

Aturan pencatatan di aplikasi:

| Aturan | Artinya |
|---|---|
| Berlaku **72 jam** | Ketukan iklan dihitung bila survei dimulai dalam 72 jam sejak pesan dari iklan. Lewat dari itu tercatat "Kata pemicu". |
| **Satu ketukan, satu respons** | Setelah survei mulai, data iklan dipakai habis. Survei berikutnya dari orang yang sama butuh ketukan iklan baru. |
| Iklan vs Broadcast | Bila orang juga menerima broadcast **survei yang sama** (terkirim, dalam 24 jam terakhir), yang dipakai yang **paling baru**. Broadcast yang lebih lama atau untuk survei lain tidak dihitung. |
| Hanya nomor Meta | Data iklan hanya dibaca dari nomor **Meta Cloud API**. Iklan jangan diarahkan ke nomor Qontak atau WhatsApp QR. |
| Hanya iklan berbayar | Tombol WhatsApp di postingan biasa (bukan iklan) tidak dihitung sebagai Iklan. |

> **Catatan:** angka 72 jam itu aturan **aplikasi**. Masa gratis pesan dari Meta kini **sampai 7 hari** (lihat §6). Keduanya berbeda.

> **Kalau teks pesan diubah orangnya** sebelum dikirim (ada sumber yang menyebut ini bisa terjadi, **belum pasti**), survei tidak mulai. Data iklan tetap tercatat, dan survei akan tercatat Iklan bila orang itu lalu mengetik kata pemicu dalam 72 jam.

---

## 2. Persiapan di Meta (sekali saja)

### 2.1 Business portfolio dan Halaman

1. Buka **business.facebook.com**. Pastikan Anda admin di business portfolio Populi Center.
2. Pastikan ada **Halaman Facebook** Populi Center di portfolio itu.
3. Siapkan **akun Instagram profesional** (bisnis atau kreator) dan hubungkan ke Halaman tersebut.
   - Kalau akun IG tidak terhubung, iklan di Instagram bisa tetap tayang memakai identitas Halaman FB. Akibatnya komentar di IG tidak bisa Anda kelola (**belum pasti**).

### 2.2 Nomor WhatsApp

- Nomor yang memakai API (Cloud API) **otomatis ada di business portfolio**. Satu akun WhatsApp Business (WABA) hanya bisa berada di satu portfolio.
- Iklan ke WhatsApp bisa dibuat bila nomor tersambung ke **Halaman** atau ke **business portfolio**.
- Bila perlu menautkan ke Halaman: buka **Halaman → Settings → Linked accounts → WhatsApp**, masukkan nomor, lalu masukkan kode yang dikirim.
  - Nomor API tidak punya aplikasi WhatsApp di HP. Kode kemungkinan datang sebagai **pesan masuk** dan muncul di menu **Chat** aplikasi Populi WA (**belum pasti**). Bila Halaman dan nomor ada di portfolio yang sama, penautan bisa terjadi tanpa kode (menurut pihak ketiga).
  - Nomor yang tertaut akan terlihat oleh orang yang mengirim pesan lewat iklan.
- **Jangan keluarkan nomor produksi dari portfolio** walau Meta menyarankannya saat muncul pesan "linked to another Facebook business". Minta bantuan pemilik portfolio atau pengembang.
- Menautkan nomor WhatsApp ke akun Instagram **tidak wajib** untuk iklan (**belum pasti**, syarat resmi hanya Halaman atau portfolio).

### 2.3 Akun iklan dan pembayaran

1. Pastikan ada **akun iklan** di portfolio dengan **metode pembayaran** aktif.
2. Pastikan **WABA juga punya metode pembayaran** (WhatsApp Manager → Billing). Sejak 1 Oktober 2026, pesan service di atas 1.000 per nomor per bulan berbayar, begitu juga pesan utility di dalam jendela 24 jam. Tanpa metode pembayaran, pesan berhenti terkirim begitu jatah gratis habis.
   - Pengecualian: pemerintah dan organisasi nirlaba komunitas yang memenuhi syarat (termasuk keterlibatan warga yang non-partisan) tetap gratis untuk pesan service sampai **31 Desember 2027**. Kelayakannya ditentukan Meta; pengembang bisa melihatnya dari nilai `PAID_EXEMPT` di webhook status. Apakah Populi Center termasuk **belum pasti**.

### 2.4 Otorisasi iklan politik: kapan wajib

Indonesia masuk daftar Meta **"pemilu atau politik saja"**. Artinya:

| Isi iklan | Otorisasi wajib? |
|---|---|
| Menyebut tokoh politik, partai, calon, pemilu/pilkada, ajakan memilih | **Wajib** |
| Menyebut nama atau jabatan pejabat ("Presiden", "Gubernur", "Menteri") | **Wajib** |
| Ajakan mengubah atau menolak undang-undang/kebijakan, ajakan menghubungi pejabat, petisi | Bisa digolongkan politik atau isu sosial, tergantung isinya (**belum pasti**). Anggap **wajib** bila menyebut pejabat, partai, atau pemilu. |
| Isu sosial murni (layanan publik, ekonomi rumah tangga) tanpa nama/jabatan politik | Tidak wajib menurut daftar negara Meta (**cek ulang** di halaman resmi). Meta menganjurkan otorisasi untuk iklan isu sosial. |
| Ajakan netral "Ikut survei Populi Center" | Kemungkinan tidak wajib (**belum pasti**; kebijakan Meta tidak membahas survei) |

Bila tidak bisa dihindari, urus otorisasi lebih dulu. Lama tinjauan untuk Indonesia tidak dipastikan; cadangkan **minimal 1–2 minggu** untuk seluruh proses.

1. Jadi admin atau pengiklan Halaman. Minimal satu admin Halaman sudah terkonfirmasi identitasnya.
2. Nyalakan **autentikasi dua faktor**. Bila dimatikan, otorisasi dicabut dan harus diulang.
3. Konfirmasi identitas dengan dokumen terbitan Indonesia yang masih berlaku. Panduan Meta untuk AS menyebut sampai 48 jam, tetapi bisa jauh lebih lama bila verifikasi digital gagal.
4. Buat **penafian "Dibayar oleh"** dengan nama organisasi lengkap, lalu tautkan akun iklan. Situs, telepon, email, dan alamat harus aktif.
5. Bila nama akun IG berbeda dari nama Halaman, Instagram mungkin perlu otorisasi terpisah.
6. Saat membuat kampanye, pilih kategori iklan khusus **"Social issues, elections or politics"**. Peninjauan iklan jenis ini bisa lebih lama dari iklan biasa.

> Iklan berpenafian tidak bisa tayang di sebagian penempatan, termasuk WhatsApp. Apakah iklan feed IG/FB yang membuka WhatsApp tetap bisa dipakai dalam kategori ini **belum pasti**. Uji di Ads Manager sebelum mengandalkannya.

---

## 3. Persiapan di aplikasi Populi WA

Semua di menu **Survei** (pembuat survei), kecuali disebut lain.

### 3.1 Survei aktif dan kata pemicu

1. Di panel **Status**, pilih **"Aktif — pemicu & blast jalan"**. Di daftar survei status ini tampil sebagai **"Berjalan"**. Survei Draft tidak bisa dipicu.
2. Di panel **"Pemicu otomatis (bot)"**, nyalakan toggle "Survei dimulai otomatis saat pesan masuk cocok kata kunci."
3. Isi **Kata kunci pemicu**. Pisahkan dengan koma atau Enter, jadi kata pemicu **tidak bisa memuat koma**.
4. **Masukkan kata untuk iklan sebagai kata kunci pertama.** Bila Agen AI menyala, ia menyarankan orang mengetik kata kunci pertama. Editor selalu menambahkan kata baru di belakang dan urutannya tidak bisa diubah. Bila survei sudah punya kata kunci, hapus dulu semuanya, masukkan kata iklan, lalu masukkan lagi kata lainnya.

Syarat kata pemicu yang aman:

- **Unik per survei.** Bila dua survei aktif punya kata yang sama, survei mana yang mulai tidak bisa dipastikan.
- **Jangan pakai kata pendek dan umum** (mis. `survei`, `ikut`) di survei lain yang aktif bersamaan. Kata itu bisa merebut pesan iklan yang tidak persis sama.
- **Pendek:** 2–4 kata, huruf dan angka saja, **tanpa tanda baca dan emoji**. Contoh: `Ikut Survei Populi`. Tanda baca tidak dibuang di tahap "persis sama": `Ikut Survei Populi!` tidak persis sama dengan `Ikut Survei Populi`.
- **Sama persis dengan pesan isi otomatis** di iklan (huruf besar/kecil tidak berpengaruh).
- **Jangan** memakai **satu kata saja** dari daftar berikut sebagai kata pemicu atau isi otomatis, karena dibalas sebagai pesan berlangganan, bukan survei: **mulai, daftar, gabung, langganan, berlangganan, subscribe**. Frasa seperti `Mulai Survei` tetap aman.
- **Jangan pernah** memasukkan kata berhenti (**stop, berhenti, cabut, unsubscribe, unsub, hapus saya, berhenti langganan**) ke kata pemicu atau isi otomatis. Pesan seperti itu bisa dicatat sebagai permintaan berhenti.
- "survey" dan "survei" dianggap **berbeda**. Masukkan keduanya bila perlu.

Cara aplikasi mencocokkan pesan:

1. **Persis sama** dengan kata kunci (mengabaikan huruf besar/kecil dan spasi di ujung) → survei **selalu** mulai.
2. Bila tidak persis: pesan **ditolak** bila mengandung tanda tanya `?` atau diawali kata tanya (apa, apakah, adakah, bagaimana, gimana, gmn, cara, berapa, kenapa, mengapa, kapan, di mana, dimana, siapa, bisakah, bolehkah, tanya, mohon info, dll.).
3. Bila lolos: survei mulai bila kata kunci muncul **utuh** di pesan yang paling banyak **8 kata**, dan pesan tidak memuat kata pengingkar (tidak, ngga, nggak, gak, ga, jangan, belum, sudah, udah, telah, batal). Tanda baca dan emoji diabaikan di tahap ini.

Contoh dengan kata kunci `ikut survei`:

| Pesan yang dikirim | Hasil | Sebab |
|---|---|---|
| `IKUT SURVEI` | Mulai | Persis sama |
| `Halo, saya mau ikut survei` | Mulai | 5 kata, frasa utuh |
| `Halo, saya mau ikut survei Populi Center ya kak` | Tidak | Lebih dari 8 kata |
| `Bisakah saya ikut survei?` | Tidak | Ada tanda tanya |
| `Saya belum pernah ikut survei` | Tidak | Ada "belum" |
| `Saya mau ikut surveinya` | Tidak | Bukan frasa utuh |
| `Mulai` | Tidak | Dibalas konfirmasi berlangganan |

> Pesan yang tidak memicu survei diteruskan ke Auto Reply atau Agen AI. **Bila keduanya tidak ada, orang itu tidak dibalas sama sekali.** Ini juga membuat masa gratis Meta tidak terbuka (§6).

### 3.2 Mode pengisian: Form atau Chatbot

| | **Form** ("WhatsApp Flow — formulir multi-layar") | **Chatbot** ("Chatbot — tanya-jawab per pesan") |
|---|---|---|
| Jumlah pesan keluar | Sedikit (±3 per responden) | Banyak (±1 per pertanyaan) |
| Kuota provinsi diperiksa | **Setelah seluruh formulir diisi** | Begitu pertanyaan wilayah dijawab |
| Catatan | Hanya nomor Meta; tipe Gambar tidak didukung; **wajib Flow ID** (lihat di bawah) | Sesi tidak kedaluwarsa; pesan isi otomatis yang terkirim dua kali bisa tersimpan sebagai jawaban |

Saran: pakai **Form**, dan selaraskan target lokasi iklan dengan kuota provinsi (§4.4). Untuk Chatbot, taruh pertanyaan wilayah di awal.

> **Mode Form wajib punya Flow ID** yang sudah diterbitkan di WhatsApp Manager (kolom "Flow ID (dari Meta)"). Bila kosong, aplikasi mengirim pertanyaan versi chat, tetapi jawaban responden **tidak diproses** dan survei macet di pertanyaan 1. Periksa Flow ID sebelum iklan tayang, dan uji dengan HP sendiri sampai formulirnya benar-benar muncul.

> **Survei Chatbot yang belum selesai menghalangi survei iklan.** Bila orang itu masih punya respons Chatbot yang belum selesai (survei ini atau survei lain), pesan dari iklan dianggap **jawaban survei lama itu**, bukan pemicu survei baru. Bila survei lama sudah Ditutup, ia menerima pesan "survei sudah berakhir" lalu perlu mengirim kata pemicu sekali lagi. Data iklannya tetap berlaku 72 jam.

### 3.3 Pengaturan lain

| Pengaturan (label di aplikasi) | Isi yang disarankan |
|---|---|
| **Batas pengisian per responden** | **Sekali saja.** Nomor yang sudah selesai diberi tahu jawabannya sudah diterima. |
| Tombol **Kuota** di daftar survei → modal "Kuota responden" | Isi **Target responden seluruh survei** dan **Kuota per provinsi**, lalu **Simpan Kuota**. Kuota per provinsi **hanya bekerja bila survei punya pertanyaan bertipe "Wilayah (provinsi → kabupaten/kota)"**. Responden iklan tidak membawa data provinsi, jadi tanpa pertanyaan itu hanya target seluruh survei yang berlaku. |
| **Pesan saat kuota penuh** | Kalimat sopan, tanpa menyebut provinsi atau angka. |
| **Pesan saat survei sudah berakhir** | Isi, karena iklan bisa masih tayang sebentar setelah survei ditutup. |
| **Lokasi responden** → "Minta lokasi setelah responden selesai" | Nyalakan bila ingin memeriksa provinsi. Hasilnya muncul sebagai Status Lokasi (mis. "Sesuai", "Beda provinsi"). |
| **Asesmen durasi** | Bawaannya: sampai 2 menit "Terlalu cepat", sampai 10 "Normal", sampai 30 "Lambat", lebih dari itu "Terlalu lama". Sesuaikan dengan jumlah pertanyaan, dan pakai aturan yang sama untuk semua jalur agar bisa dibandingkan. |
| Pertanyaan **Persetujuan** | Pakai tipe **"Ya / Tidak"** dengan skip logic: "Tidak" → **"→ Selesai survei"**. Yang menolak tidak dihitung ke kuota. **Jangan** pakai tipe "Persetujuan / informed consent": tipe itu tidak bisa diberi skip logic, jadi "Tidak" tidak mengakhiri survei. Yang menjawab "Tidak" tercatat selesai tanpa jawaban lain; keluarkan mereka saat menghitung respons selesai dan biaya per respons. |
| Pertanyaan **usia** | Tipe "Ya / Tidak" atau pilihan ganda; di bawah 18 tahun → "→ Selesai survei". |

Di halaman **Auto Reply**:

- **"Bot diam saat tidak ada survei berjalan"**: bila menyala dan tidak ada survei Aktif, bot **tidak membalas apa pun**, termasuk pesan "survei sudah berakhir". Satu-satunya pengecualian: konfirmasi STOP tetap dikirim sekali saat nomornya baru berhenti. Bot membalas lagi sendiri begitu ada survei yang Aktif.
- Cek aturan Auto Reply yang memakai kata umum seperti "halo". Aturan itu akan menjawab sapaan orang dari iklan yang tidak memicu survei.

Di menu **Agen AI**: "Kuota balasan AI per nomor (24 jam)" bawaannya 5. Setelah habis, orang itu dikirimi satu pesan alih, lalu tidak dijawab lagi selama 24 jam. Pastikan ada petugas yang memantau Chat.

Di **Akun WhatsApp → Pengaman Pengiriman**: bila pengaman ini diaktifkan, "Batas pesan / hari" menghitung **semua** pesan keluar, termasuk balasan ke responden iklan. Balasan iklan tidak pernah ditahan, tetapi bila iklan ramai, **blast bisa tertunda ke hari berikutnya**. Naikkan batas bila iklan dan blast berjalan bersamaan.

> Halaman **Akun WhatsApp** dan **Biaya & Invoice** hanya terlihat oleh **superadmin**. Minta superadmin memeriksa atau mengubahnya.

### 3.4 Uji dengan HP sendiri

1. Buat iklan (§4), lalu buka **pratinjau** iklan di HP (atau jalankan iklan kecil dengan target sempit).
2. Ketuk tombol WhatsApp. Pastikan pesan isi otomatis **sama dengan kata pemicu**. Kirim tanpa mengubah.
3. Survei harus mulai. Isi sampai selesai.
4. Buka halaman **Respons** survei: baris Anda harus menampilkan **Iklan**. Bila iklan punya judul, detailnya menampilkan "Datang dari iklan: {judul}".
5. Ekspor Excel: kolom **Jalur Masuk = Iklan** dan **ID Iklan** terisi.
6. Hapus respons uji di halaman Respons (permanen), lalu hapus juga barisnya di Google Sheets secara manual; penghapusan di aplikasi tidak menghapus baris yang sudah terkirim ke Sheets.

> **Pratinjau mungkin tidak membawa data iklan (belum pasti).** Aplikasi menandai Iklan hanya bila pesan membawa data iklan dari Meta. Bila uji lewat pratinjau tercatat "Kata pemicu", ulangi dengan iklan kecil yang benar-benar tayang sebelum menyimpulkan ada masalah.

> Bila Batas pengisian **Sekali saja**, nomor uji tidak bisa mengisi lagi, kecuali respons ujinya dihapus dulu.

---

## 4. Membuat iklan di Ads Manager

### 4.1 Kampanye: tujuan dan kategori

1. **Create** kampanye baru.
2. Pilih tujuan **Engagement**. Leads juga bisa mengoptimalkan percakapan WhatsApp, tetapi lihat peringatan penempatan di §4.5. Hindari Traffic (mengejar klik) dan Awareness (mengejar jangkauan). Label lama "Messages" sudah tidak dipakai.
3. **Kategori iklan khusus:** pilih **"Social issues, elections or politics"** hanya bila isi iklan politis (§2.4). Bila tidak, biarkan kosong. Kampanye yang seharusnya masuk kategori ini tetapi tidak dideklarasikan akan ditolak.
4. **Anggaran per ad set**, bukan anggaran kampanye (Advantage+ campaign budget). Kalau di level kampanye, Meta yang membagi uang antara IG dan FB (**belum pasti**, tetapi lebih aman).

### 4.2 Ad set: tujuan pesan dan optimasi

1. Di bagian **Conversion**, cari **Message destinations** lalu centang **WhatsApp saja**. Jangan ikut mencentang Messenger atau Instagram Direct.
2. Nomor yang dipakai adalah nomor yang tersambung ke Halaman yang dipilih. Bila WhatsApp abu-abu, klik **Connect account**.
3. **Performance goal:** pilih yang memaksimalkan **jumlah percakapan**.
4. Untuk tujuan Leads, WhatsApp dipilih langsung di bagian Conversion, dan Advantage+ bisa menyala otomatis. Periksa lagi.

### 4.3 Anggaran dan jadwal

- Atur **tanggal mulai dan selesai sesuai tanggal survei**. Iklan bisa dibuat lebih awal; ia ditinjau dulu, lalu baru tayang pada jadwalnya.
- Sebagian besar iklan ditinjau dalam **24 jam**, kadang lebih. Ajukan **1–2 hari** sebelum survei.
- **Anggaran total (lifetime)** cocok untuk survei pendek: batas atas seluruh masa tayang dan wajib punya tanggal selesai. Penjadwalan per jam hanya bisa dengan anggaran total.
- **Anggaran harian** adalah target rata-rata. Dalam sehari pengeluaran bisa sampai **175%** dari angka itu.
- Ads Manager memberi peringatan bila anggaran terlalu kecil. Meta tidak memublikasikan batas minimum dalam rupiah.
- Jadwal hanya mengatur penayangan. Sebagian kecil orang masih bisa melihat iklan sedikit di luar jadwal.
- **Fase pembelajaran** biasanya butuh sekitar 50 hasil optimasi dalam 7 hari. Survei yang hanya beberapa hari kemungkinan berhenti di "Learning limited". Pakai **sedikit ad set** saja.
- Mengubah **target, materi, atau optimasi** memicu peninjauan ulang dan mengulang fase pembelajaran. Mengubah anggaran tidak memicu peninjauan ulang, tetapi **perubahan anggaran yang besar** (sumber pihak ketiga menyebut sekitar lebih dari 20%) dapat mengulang fase pembelajaran. Ubah anggaran secara bertahap.

### 4.4 Audiens

| Kontrol | Sifat | Isi |
|---|---|---|
| **Lokasi** | Batas tegas, tetapi longgar | Provinsi sesuai kuota. Ads Manager kini hanya menyediakan "orang yang tinggal di atau baru-baru ini berada di lokasi ini"; opsi khusus "tinggal di" sudah dihapus. Jadi iklan bisa menjangkau pendatang atau orang yang sedang bepergian. |
| **Umur minimum** | Batas tegas | **18** |
| Rentang umur, gender, minat | Hanya saran; AI Meta bisa melewatinya | Bila ingin tegas, matikan Advantage+ audience (cari "Switch to original audience options"). |
| Bahasa | Batas tegas | Biarkan kosong untuk Bahasa Indonesia. |

- Penargetan lokasi dan demografi Meta di Indonesia **kurang akurat**. Tetap tanyakan provinsi dan usia di survei.
- Untuk kuota per provinsi: buat **satu ad set per provinsi** (atau per kelompok provinsi), supaya bisa dimatikan sendiri saat kuotanya penuh.

### 4.5 Penempatan: pisahkan Instagram dan Facebook

Data dari WhatsApp tidak menyebut platform. Satu-satunya cara membedakan adalah **ID Iklan yang berbeda**.

1. Di ad set, pilih **penempatan manual** (bukan Advantage+ placements).
2. Ad set **A: Facebook saja**. Ad set **B: Instagram saja**.
3. Di keduanya, **keluarkan WhatsApp Status** dan, bila pilihannya ada, **desktop** (label untuk mengecualikan desktop **belum pasti**).

> **Peringatan (belum pasti):** sejak Agustus 2026 Meta menguji penghapusan pengecualian penempatan, platform, dan perangkat di level ad set untuk tujuan **Sales dan Leads**. Ini alasan lain memakai **Engagement**. Bila di layar Anda tidak bisa memilih "Facebook saja" atau "Instagram saja" per ad set, pakai **Kontrol Penempatan di level akun** (berlaku untuk semua ad set), atau jalankan IG dan FB di kampanye atau hari yang berbeda. Cek ulang sebelum iklan diajukan.
   - Klik dari desktop atau web **tidak membuka masa gratis** pesan.
4. Tiap ad set punya iklannya sendiri. Dua iklan di dalam satu ad set **tidak bisa** dipaksa ke satu platform. Variasi materi per penempatan di dalam satu iklan tetap memakai ID yang sama.

Contoh struktur:

```
Kampanye  SRV-2611-NAMASURVEI
├─ Ad set  FB-JABAR        (Facebook saja, Jawa Barat)
│   └─ Iklan  FB-JABAR-v1
├─ Ad set  IG-JABAR        (Instagram saja, Jawa Barat)
│   └─ Iklan  IG-JABAR-v1
├─ Ad set  FB-JATIM ...
└─ Ad set  IG-JATIM ...
```

### 4.6 Materi iklan

- Cantumkan **nama Populi Center**. Ajakan singkat dan netral, misalnya "Bagikan pendapatmu tentang layanan publik di daerahmu. Survei singkat lewat WhatsApp, ±5 menit."
- Sebut perkiraan lama pengisian. Jangan menjanjikan uang.
- Jangan pakai Garuda, logo KPU, Bawaslu, BPS, atau kementerian. Jangan menulis "survei resmi pemerintah".
- Contoh kalimat boleh dan tidak ada di §7.
- Media realistis buatan AI pada iklan politik wajib diungkap.

### 4.7 Templat pesan: isi otomatis = kata pemicu

1. Di level iklan, cari bagian **templat pesan / message template**. Pilih jenis **"Start conversation"** (sapaan + saran pesan yang bisa dikirim orang).
2. **Ganti teks bawaan Meta** (bahasa Inggris, semacam "Hello! Can I get more info on this?"). Teks itu **tidak akan memicu survei**.
3. Isi pesan isi otomatis / saran pesan dengan **kata pemicu persis**, misalnya `Ikut Survei Populi`.
4. Bila memakai beberapa pertanyaan cepat (tombol yang bisa diketuk), **setiap judul tombol harus terdaftar sebagai kata pemicu**.
5. Sapaan (teks pembuka dari bisnis) boleh diisi bebas. Sapaan itu tidak memicu apa pun.
6. **Jangan pilih "Collect info with a form in WhatsApp"**. Formulir itu bukan milik survei aplikasi, jadi jawabannya tidak masuk ke survei. Biarkan aplikasi yang mengirim formulirnya sendiri.

> Label kolom isi otomatis di Ads Manager bisa berbeda. Yang dicari: kolom teks yang akan muncul di kolom ketik WhatsApp saat orang mengetuk iklan.

### 4.8 Aturan penamaan dan catatan ID Iklan

Pakai pola **PLATFORM-PROVINSI-VERSI** untuk iklan, misalnya `IG-JABAR-v1`. Setelah iklan dibuat, salin **ID iklan** dari Ads Manager ke tabel peta:

| ID Iklan | Platform | Provinsi | Materi | Survei |
|---|---|---|---|---|
| (salin dari Ads Manager) | Instagram | Jawa Barat | Gambar A | SRV-2611 |
| (salin dari Ads Manager) | Facebook | Jawa Barat | Gambar A | SRV-2611 |

Tabel ini dipakai untuk memetakan ID Iklan di ekspor ke platform dan provinsi (§6).

---

## 5. Selama iklan berjalan

### 5.1 Memantau di aplikasi

| Tempat | Yang terlihat | Keterbatasan |
|---|---|---|
| Halaman **Respons** survei | Baris "nomor • tanggal • Iklan • Form"; bila dibuka dan iklan punya judul: "Datang dari iklan: {judul}" | ID Iklan tidak tampil; tidak ada filter per jalur. Tab: Semua, Selesai, Berlangsung, Ditolak, Beda provinsi. |
| **Ekspor Excel/CSV** | Kolom Saluran, Jalur Masuk, Metode, ID Iklan, Durasi, Asesmen Durasi, Lama Pengisian; Provinsi Lokasi dan Status Lokasi bila "Minta lokasi" menyala | Mengikuti **tab dan pencarian yang sedang tampil**; untuk perbandingan per jalur, ekspor dari tab **Semua** tanpa pencarian. Tidak ada kolom status: baris dengan Durasi kosong berarti belum selesai. Judul iklan dan respons yang ditolak kuota tidak ikut. |
| **Google Sheets** | Kolom Saluran, Jalur Masuk, Metode, ID Iklan di **paling kanan** | Baris lama tetap kosong di kolom ini; hanya respons yang diterima |
| Menu **Chat** | Semua pesan masuk, termasuk yang tidak memicu survei | — |

- Laporan dan Dashboard **belum punya rekap per jalur**. Bandingkan lewat ekspor atau filter di Google Sheets.
- **Saluran** saat ini selalu "WhatsApp", termasuk untuk orang dari iklan Instagram. Platform dibaca dari ID Iklan.

### 5.2 Tindakan harian

1. **Kuota provinsi penuh** → buka Ads Manager, **matikan ad set provinsi itu**. Aplikasi tidak bisa menghentikan iklan. Pada mode Form, orang dari provinsi yang penuh tetap mengisi semuanya lalu ditolak.
2. **Kuota seluruh survei penuh** → matikan **semua** ad set. Orang baru menerima "Pesan saat kuota penuh".
3. **Banyak pesan yang tidak memicu survei** di Chat → cek apakah isi otomatis sama dengan kata pemicu.
4. **Balas pertanyaan dalam 24 jam** sejak pesan terakhir orang itu. Lewat dari itu, kolom ketik di Chat diganti pemberitahuan sesi 24 jam berakhir, dan hanya templat (lewat Broadcast) yang bisa dikirim.
5. **Jangan ubah materi atau target** di tengah jalan. Bila anggaran perlu diubah, ubah sedikit demi sedikit (§4.3).

### 5.3 Saat survei ditutup

1. **Jeda atau akhiri semua iklan** di hari yang sama, sebelum atau bersamaan dengan mengubah status survei ke **Ditutup**.
2. Iklan yang masih tayang tetap dibayar, sementara orang hanya menerima "pesan survei sudah berakhir" (paling banyak sekali per 24 jam), atau **tidak dibalas sama sekali** bila "Bot diam" menyala dan tidak ada survei lain yang Aktif.

---

## 6. Membaca hasil dan biaya

### 6.1 Data yang dikumpulkan

1. Dari aplikasi: **ekspor Excel** survei (bukan CSV, lihat FAQ).
2. Dari Ads Manager: laporan per **iklan** dengan kolom **ID iklan**, **Amount spent**, dan **Messaging conversations started**. Rincian per platform tersedia lewat Breakdown → By delivery → Platform, tetapi angkanya perkiraan.
3. Pakai angka belanja dari **tagihan/invoice Meta** bila ingin memasukkan pajak.

> "Messaging conversations started" di Ads Manager menghitung orang yang mengirim pesan pertama kali atau setelah 7 hari tanpa percakapan. Orang yang baru menerima broadcast tidak dihitung, jadi angkanya **akan berbeda** dari hitungan aplikasi. Pakai hitungan aplikasi untuk respons.

### 6.2 Rumus

| Ukuran | Rumus |
|---|---|
| **Biaya per respons selesai** | (belanja iklan + biaya pesan WA) ÷ respons selesai dengan ID Iklan itu |
| Biaya per percakapan | belanja iklan ÷ percakapan dimulai (Ads Manager) |
| **Tingkat selesai** | respons selesai ÷ respons dimulai (jalur yang sama). Respons dimulai = baris ekspor Excel dari tab **Semua** per Jalur Masuk. Respons selesai = baris yang kolom Durasinya terisi, dikurangi yang menjawab "Tidak" pada pertanyaan persetujuan. Google Sheets hanya memuat respons selesai, jadi tidak bisa dipakai untuk menghitung ini. Respons yang ditolak kuota tidak ada di ekspor; lihat jumlahnya di tab Ditolak. |
| Porsi terlalu cepat | respons "Terlalu cepat" ÷ respons selesai |
| Porsi beda provinsi | Status Lokasi "Beda provinsi" ÷ yang membagikan lokasi |
| Porsi duplikat | nomor/jawaban terbuka kembar ÷ respons selesai |

**Biaya pesan WhatsApp untuk jalur Iklan:**

- Bila orang mengirim pesan lewat iklan **dari aplikasi WhatsApp Android/iOS** dan bot **membalas dalam 24 jam**, balasan itu gratis dan membuka **masa gratis sampai 7 hari**. Selama masa itu semua jenis pesan gratis, termasuk templat pengingat. Pesan Meta Business Agent tetap ditagih.
- Klik dari desktop/web **tidak** membuka masa gratis.
- Jadi biaya pesan WA untuk jalur Iklan biasanya **Rp0**. Cocokkan dengan invoice Meta.

**Biaya pesan untuk jalur lain** (tarif resmi Indonesia per 1 Oktober 2026, per pesan, sebelum pajak yang mungkin ditambahkan):

| Kategori | Tarif |
|---|---|
| Marketing (templat broadcast) | Rp586,33 |
| Utility | Rp356,65, termasuk di dalam jendela 24 jam sejak 1 Oktober 2026 |
| Service (balasan dalam 24 jam) | Rp356,65, **setelah 1.000 pesan gratis per nomor per bulan** (nirlaba yang memenuhi syarat dibebaskan sampai 31 Desember 2027, §2.3) |

> **Halaman "Biaya & Invoice" di aplikasi tidak mencerminkan masa gratis dari iklan.** Halaman itu menghitung semua pesan keluar sebagai service, jadi untuk jalur Iklan angkanya **lebih tinggi** dari tagihan Meta. Halaman itu juga ikut menghitung pesan lewat Qontak dan WhatsApp QR, tidak memuat belanja iklan, dan tidak memilah per jalur. Yang mengikat adalah invoice resmi Meta.

### 6.3 Mutu

- **Tingkat selesai**: berapa yang mulai lalu menyelesaikan.
- **Asesmen durasi**: porsi "Terlalu cepat". Di mode Form, waktu mulai dihitung sejak formulir **dikirim**, bukan dibuka. Bandingkan antarjalur dengan mode yang sama.
- **Beda provinsi**: dari Status Lokasi.
- **Duplikat**: nomor yang sama di survei lintas jalur, dan jawaban terbuka yang kembar. Waspadai kata pemicu yang bocor ke grup.
- **Sebaran**: umur, gender, pendidikan, provinsi dibanding target.

### 6.4 Tabel perbandingan per jalur

Isi setelah survei selesai. Iklan IG dan FB dipisah memakai tabel peta ID Iklan (§4.8).

| Ukuran | Broadcast | Kata pemicu | Iklan IG | Iklan FB |
|---|---|---|---|---|
| Respons dimulai | | | | |
| Respons selesai | | | | |
| Tingkat selesai | | | | |
| Belanja iklan | — | — | | |
| Biaya pesan WA | | | ±Rp0 | ±Rp0 |
| Biaya lain (tenaga lapangan) | | | — | — |
| **Biaya per respons selesai** | | | | |
| % Terlalu cepat | | | | |
| % Beda provinsi | | | | |
| % Duplikat | | | | |
| Usia < 30 / 30–50 / > 50 | | | | |

### 6.5 Estimasi biaya (perkiraan)

Belum ada patokan resmi Meta untuk biaya per percakapan WhatsApp di Indonesia. Angka di bawah hanya **perkiraan**, untuk menyusun anggaran uji:

| Ukuran | Perkiraan | Sumber (tanggal) |
|---|---|---|
| Biaya per 1.000 tayangan, Indonesia | ±USD 1,5–4 (±Rp24–64 ribu pada kurs asumsi Rp16.000) | Blog pihak ketiga, Feb–Mar 2026 |
| Biaya per percakapan | ±Rp7.000, sangat tergantung materi | Hitungan kasar: titik tengah ±Rp35 ribu per 1.000 tayangan, 1% mengklik, separuhnya mengirim pesan |
| Biaya per survei selesai lewat iklan Facebook (bukan WhatsApp) | Rata-rata ±USD 1,03–1,05 termasuk insentif, untuk tiga negara (Meksiko, Kenya, Indonesia). Angka khusus Indonesia belum bisa dipastikan. | Rosenzweig dkk., PSRM 2025 |

**Koreksi atas perkiraan sebelumnya:**

- Perkiraan November lalu memakai Rp1.500 / 3.000 / 6.000 per percakapan, sehingga Rp2.500 / 6.700 / 20.000 per respons selesai. Dua skenario pertama kemungkinan **terlalu murah**. Pakai **Rp15.000–25.000 per respons selesai** untuk perencanaan sampai ada hasil uji sendiri.
- Masa gratis pesan dulu disebut "biasanya 72 jam". Kini **sampai 7 hari**. Angka 72 jam tetap dipakai aplikasi untuk pencatatan Iklan.
- Dulu disebut "tanpa perubahan kode". Kini aplikasi sudah mencatat Iklan dan ID Iklan. Jalur "Iklan IG / Iklan FB" terpisah **belum ada**; cukup "Iklan" + ID Iklan.
- Saran uji kecil **Rp1–1,5 juta selama 3 hari** tetap berlaku. Dengan perkiraan baru, harapkan sekitar **40–100 respons selesai** (Rp1–1,5 juta ÷ Rp15.000–25.000).

**Contoh hitungan (angka bulat, rekaan):**

| | Iklan IG | Broadcast |
|---|---|---|
| Belanja iklan / biaya templat | Rp1.500.000 | 2.000 penerima × Rp586 ≈ Rp1.172.000 |
| Percakapan dimulai (Ads Manager) | 200 (Rp7.500 per percakapan) | — |
| Respons dimulai (aplikasi) | 160 | 260 |
| Respons selesai | 100 | 200 |
| Biaya pesan WA lain | Rp0 (masa gratis) | 200 × 3 pesan × Rp357 ≈ Rp214.000 (bila jatah 1.000 habis) |
| **Biaya per respons selesai** | Rp1.500.000 ÷ 100 = **Rp15.000** | Rp1.386.000 ÷ 200 ≈ **Rp6.900** |
| Tingkat selesai | 100 ÷ 160 = 62,5% | 200 ÷ 260 ≈ 77% |

Jalur Kata pemicu biasanya paling murah dalam pesan (±3 pesan service ≈ Rp1.100 per responden bila jatah gratis habis), tetapi tambahkan biaya tenaga tim lapangan. Iklan unggul bila tujuan utamanya **mengurangi beban lapangan** dan **menjangkau di luar jaringan tim**.

---

## 7. Kebijakan, privasi, dan metodologi

### 7.1 Teks iklan: boleh dan tidak

Meta melarang iklan yang **menyatakan atau menyiratkan atribut pribadi** orang yang melihat: suku, agama, usia, orientasi seksual, gender, disabilitas, kesehatan, kondisi keuangan, **status memilih**, catatan kriminal.

| Jangan | Pakai |
|---|---|
| "Kamu pemilih muda?" | "Warga Indonesia, bagikan pendapatmu" |
| "Usia 17+? Ikut survei!" | "Survei singkat Populi Center lewat WhatsApp" (saring usia di chat) |
| "Sebagai Muslim, apa pendapatmu…" | "Bagaimana pendapatmu tentang layanan publik di daerahmu?" |
| "Sudah terdaftar di DPT?" | (tanyakan di survei, bukan di iklan) |
| "Lagi susah ekonomi?" | "Ceritakan pengalamanmu soal harga kebutuhan pokok" |
| "Survei elektabilitas Pilkada / kinerja Presiden" | Hanya dengan otorisasi politik (§2.4) |
| "Dapat uang dari survei!" | (jangan menonjolkan imbalan) |

Pertanyaan soal pilihan politik, agama, atau kesehatan **taruh di survei dalam chat**, bukan di iklan atau formulir iklan.

### 7.2 Kebijakan WhatsApp

- WhatsApp melarang partai, politisi, calon, kampanye, dan **pihak yang menawarkan jasa terkait politik** (contoh dalam kebijakan per 23 September 2026: strategi kampanye dan solusi pemungutan suara) memakai platformnya. Lembaga survei tidak disebut eksplisit, tetapi survei elektabilitas atau survei pesanan calon/partai berisiko dianggap jasa politik. Survei seperti itu **sebaiknya tidak dijalankan lewat nomor ini**, karena taruhannya nomor produksi.
- **Jangan meminta NIK/KTP**, nomor kartu pembayaran, atau nomor rekening.
- Sediakan **jalan ke manusia** (petugas di chat, telepon, atau email) dan tulis di pesan pembuka.
- Responden iklan memulai chat sendiri, jadi boleh dibalas. Untuk memasukkan mereka ke **broadcast survei berikutnya**, minta persetujuan terpisah dan simpan buktinya.
- Kontak yang pernah STOP tetap bisa memulai survei dari iklan, tetapi tetap dilewati broadcast.

### 7.3 Insentif

- Imbalan dengan **undian** ("10 pemenang") kemungkinan besar wajib izin Kemensos (Permensos 3/2024). Imbalan pasti untuk setiap responden lengkap belum jelas aturannya.
- Insentif pulsa terbukti memicu kecurangan dan penyebaran tautan. Bila tetap dipakai: jangan tonjolkan nominal di iklan, bayar **setelah lolos pemeriksaan mutu**, batasi satu per nomor.

### 7.4 UU PDP dan persetujuan

- UU 27/2022 sudah mengikat penuh sejak sekitar Oktober 2024. Aturan pelaksananya (PP 33/2026) berlaku **16 Januari 2027**.
- Pertanyaan persetujuan di awal survei menyebut: siapa pengumpul (Populi Center), tujuan, jenis data, lama penyimpanan, dan hak responden. Tautkan kebijakan privasi (kolom "Tautan kebijakan privasi" di mode Form).
- Persetujuan elektronik yang tercatat berwaktu sah. Tombol "Ya" yang tercatat di aplikasi memenuhi bentuk ini.
- **Data anak** butuh persetujuan orang tua. Batasi iklan **18+** dan akhiri survei bila responden di bawah 18.
- Data survei ini jangan dipakai untuk survei atau broadcast lain tanpa persetujuan baru.

### 7.5 Metodologi

- Responden iklan **memilih sendiri**. Mereka lebih mandiri, **bukan lebih acak**. Sampel iklan adalah **sampel non-probabilitas**.
- Studi iklan Facebook di Indonesia: responden lebih muda dan lebih berpendidikan; usia di atas 50 sulit didapat; pembobotan tidak menghapus bias usia dan pendidikan.
- **Analisis per Jalur Masuk dulu**, bandingkan dengan patokan (mis. BPS), baru putuskan digabung atau tidak.
- Bobot dihitung dari **jawaban responden**, bukan dari target iklan.
- Jangan mencantumkan "margin of error" untuk sampel iklan tanpa model yang dijelaskan. Saat publikasi, nyatakan cara rekrutmen, kuota, insentif, bobot, dan pemeriksaan mutu.
- Tambahkan 1–2 pertanyaan pengecek perhatian dan item konsistensi (mis. usia dan tahun lahir).

---

## 8. Tentang menu "Instagram" di aplikasi

Menu **Instagram** di aplikasi masih bertanda **"Segera hadir"**. Belum ada sambungan untuk DM atau komentar Instagram.

| Kebutuhan | Bisa sekarang? |
|---|---|
| Iklan Instagram yang membuka **WhatsApp**, lalu survei di WhatsApp | **Ya.** Panduan ini. Tidak perlu menghubungkan Instagram ke aplikasi. |
| Survei lewat **DM Instagram** | Belum. Perlu pengembangan (penerimaan DM, pengenal kontak selain nomor HP, menjalankan mode Chatbot yang sudah ada lewat Instagram; mode Form tidak bisa) dan persetujuan akses dari Meta. Lihat `docs/RENCANA-INSTAGRAM.md`. Tidak bisa blast; hanya bisa membalas orang yang menghubungi lebih dulu. |
| Membalas **komentar** Instagram dari aplikasi | Belum. |

Saran: pakai iklan IG → WhatsApp dulu. Datanya masuk ke survei, kuota, lokasi, dan Google Sheets yang sama. DM Instagram dipertimbangkan setelah hasil uji iklan terlihat.

---

## 9. Pemecahan masalah (FAQ)

**Iklan diketuk tapi survei tidak mulai**

- Pesan isi otomatis masih teks bawaan Meta, atau tidak sama dengan kata pemicu → samakan (§4.7).
- Kata pemicunya "mulai", "daftar", atau "gabung" → dibalas sebagai berlangganan. Ganti kata pemicu.
- Orang mengubah teks: menambah tanda tanya, lebih dari 8 kata, atau kata "belum/tidak" → minta ketik ulang kata pemicu (data iklan tetap berlaku 72 jam).
- Survei belum **Aktif**, atau toggle pemicu mati.
- Orang itu masih punya survei **Chatbot** yang belum selesai → pesan iklan dianggap jawaban survei lama (§3.2).
- Mode Form tanpa **Flow ID** → survei macet di pertanyaan 1 (§3.2).
- "Bot diam" menyala dan tidak ada survei Aktif.
- Nomor itu sudah pernah selesai dan pengaturannya **Sekali saja**, atau kuota seluruh survei penuh.
- Iklan mengarah ke nomor yang bukan Meta Cloud API.
- Dua survei aktif memakai kata pemicu yang sama → buat unik.

**Respons tercatat "Kata pemicu", bukan "Iklan"**

- Survei dimulai **lebih dari 72 jam** setelah orang mengirim pesan dari iklan.
- Data iklan sudah terpakai untuk respons sebelumnya (satu ketukan, satu respons). Contoh: orang membiarkan formulir lebih dari 24 jam, lalu mengetik kata pemicu lagi.
- Orang mengetuk tombol WhatsApp di **postingan biasa**, bukan iklan berbayar.
- Respons lama dari sebelum pembaruan tercatat "(tidak tercatat)".
- Uji lewat **pratinjau iklan**, yang mungkin tidak membawa data iklan (§3.4).
- Catatan: bila orang menerima broadcast **survei yang sama** dalam 24 jam setelah mengetuk iklan, respons tercatat **Broadcast**. Formulir dari tombol templat broadcast tercatat Broadcast, kecuali orang itu sudah punya respons survei yang sama yang belum selesai; respons itu yang dipakai, dengan jalurnya semula.

**ID Iklan sama untuk Instagram dan Facebook**

- Iklan itu tayang di kedua platform dalam satu ad set. Pisahkan menjadi dua ad set dengan **penempatan manual** (§4.5). Untuk iklan yang sudah berjalan, rincian per platform di Ads Manager hanya perkiraan.

**ID Iklan di CSV diawali karakter tak terlihat**

- Itu disengaja: karakter tab mencegah Excel membulatkan angka panjang. Untuk analisis, pakai **ekspor Excel** atau Google Sheets. Bila terpaksa CSV, bersihkan dengan fungsi TRIM/CLEAN sebelum mencocokkan, dan jangan ubah kolom menjadi angka.

**Responden tidak bisa mengisi dua kali**

- Pengaturan **Sekali saja** bekerja per nomor. Respons yang ditolak kuota tidak dihitung "sudah selesai", jadi orang itu bisa mencoba lagi bila kuota dibuka.

**Survei sudah ditutup, tapi orang masih datang dari iklan**

- Iklan belum dijeda. Orang menerima "pesan survei sudah berakhir" sekali per 24 jam, atau tidak dibalas bila Bot diam menyala. Jeda iklan sekarang (§5.3).

**Kuota penuh**

- Kuota **seluruh survei** diperiksa saat mulai → orang langsung menerima "Pesan saat kuota penuh".
- Kuota **provinsi** diperiksa setelah pertanyaan wilayah (Chatbot) atau **setelah formulir selesai** (Form).
- Aplikasi tidak menghentikan iklan. Matikan ad set provinsi yang penuh. Agen AI mati sendiri bila kuota semua survei aktif penuh.

**Broadcast tertunda ke esok hari saat iklan ramai**

- Balasan ke responden iklan ikut menghabiskan "Batas pesan / hari". Naikkan batasnya atau jadwalkan blast di hari lain (§3.3).

**Kode verifikasi penautan Halaman tidak diterima**

- Cek menu **Chat** aplikasi; kode kemungkinan masuk sebagai pesan biasa (**belum pasti**). Bila tidak ada, hubungi pengembang untuk memeriksa log webhook.

---

## Sumber

Diringkas dengan kata sendiri; dibaca per 6 November 2026.

**Iklan ke WhatsApp (Meta Business Help & Developers)**
- Membuat iklan ke WhatsApp: https://www.facebook.com/business/help/447934475640650
- Tujuan untuk iklan percakapan: https://www.facebook.com/business/help/269324800441478
- Nama tujuan lama: https://www.facebook.com/business/help/1583303048513172
- Formulir di WhatsApp: https://www.facebook.com/business/help/1216541683817423
- Penempatan iklan WhatsApp: https://www.facebook.com/business/help/1816962591668838
- Penempatan manual: https://www.facebook.com/business/help/338215489130978 dan https://www.facebook.com/business/help/287043621933356
- Identitas IG di iklan: https://www.facebook.com/business/help/272348126756182
- Menautkan WhatsApp ke Halaman: https://www.facebook.com/business/help/4631406400243963
- WABA di business portfolio: https://www.facebook.com/business/help/713785646327651
- Galat "linked to another business": https://www.facebook.com/business/help/2091769220999799
- Instagram dan WhatsApp: https://help.instagram.com/1093295047789621
- Marketing API iklan WhatsApp: https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp
- Welcome Message Sequences: https://developers.facebook.com/documentation/business-messaging/whatsapp/ctwa/welcome-message-sequences
- Webhook pesan teks (data iklan): https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text

**Anggaran, jadwal, peninjauan, pengukuran**
- Anggaran harian: https://www.facebook.com/business/help/190490051321426
- Anggaran total: https://www.facebook.com/business/help/1844835042445690
- Penjadwalan: https://www.facebook.com/business/help/1037425549606837 dan https://www.facebook.com/business/help/2086707291383992
- Peninjauan iklan: https://www.facebook.com/business/help/204798856225114
- Anggaran minimum: https://www.facebook.com/business/help/203183363050448 dan https://www.facebook.com/business/help/1870791083202806
- Fase pembelajaran: https://www.facebook.com/business/help/112167992830700
- Advantage+ audience: https://www.facebook.com/business/ads/meta-advantage-plus/audience
- Penargetan lokasi: https://www.facebook.com/business/help/365561350785642
- Metrik percakapan: https://www.facebook.com/business/help/2038363993156008
- Breakdown: https://www.facebook.com/business/help/1098535543548363

**Harga WhatsApp**
- Harga dan masa gratis: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Webhook status (jenis harga): https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status
- Kalkulator tarif: https://whatsappbusiness.com/products/platform-pricing/
- Lampiran internal: `docs/klaim-biaya-meta/lampiran-klaim.md`

**Kebijakan**
- Ketersediaan per negara (iklan politik): https://www.facebook.com/business/help/2150157295276323
- Isu sosial per negara: https://www.facebook.com/business/help/214754279118974
- Otorisasi: https://www.facebook.com/business/help/208949576550051 dan https://www.facebook.com/business/help/1096686790667310
- Cakupan iklan politik: https://www.facebook.com/business/help/313752069181919 dan https://www.facebook.com/business/help/198009284345835
- Kategori iklan khusus: https://www.facebook.com/business/help/544219649587656
- Kebijakan SIEP: https://transparency.meta.com/policies/ad-standards/SIEP-advertising/SIEP/
- Atribut pribadi: https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/
- Standar iklan: https://transparency.meta.com/policies/ad-standards/
- Promosi di Halaman: https://www.facebook.com/policies_center/pages_groups_events
- Kebijakan WhatsApp Business: https://whatsappbusiness.com/policy/
- Persyaratan WhatsApp Business Platform: https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- Opt-in WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in

**Hukum dan metodologi**
- UU 27/2022 (PDP): https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- PP 33/2026 dan data anak (Katadata): https://katadata.co.id/finansial/makro/6a9979b7c5745/pp-pelindungan-data-pribadi-berlaku-januari-2027-ini-aturan-baru-data-anak
- Permensos 3/2024: https://pasal.id/peraturan/permen/permensos-no-3-tahun-2024
- Rosenzweig dkk. 2025, survei lewat iklan Facebook: https://doi.org/10.1017/psrm.2025.18
- Standar pengungkapan AAPOR: https://aapor.org/standards-and-ethics/disclosure-standards/

**Pihak ketiga (perkiraan, bukan resmi)**
- CPM per negara: https://www.adamigo.ai/blog/meta-ads-cpm-cpc-benchmarks-by-country-2026
- Biaya iklan di Indonesia: https://olakses.com/biaya-pasang-iklan-di-media-sosial-perbandingan-meta-tiktok-dan-youtube/
- Masa gratis 7 hari: https://www.ycloud.com/blog/ctwa-free-entry-point-window
- Isi otomatis bisa diubah: https://helpdocs.ycloud.com/help-center/ctwa-click-to-whatsapp-ad/meta-ctwa-ads/create-click-to-whatsapp-ad-ctwa
- Penautan nomor API ke Halaman: https://docs.360dialog.com/docs/whatsapp-marketing/fb-page-whatsapp-api-linking
- Opsi lokasi "tinggal di" dihapus: https://www.jonloomer.com/qvt/what-happened-to-location-targeting/
- Uji coba penghapusan kontrol penempatan per ad set: https://www.jonloomer.com/meta-removing-placement-controls-ad-sets/
- Fase pembelajaran dan perubahan anggaran: https://lebesgue.io/blog/facebook-ads-learning-phase/
