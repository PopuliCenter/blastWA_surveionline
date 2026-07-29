---
name: ui-populi
description: Aturan UI/UX untuk dashboard Populi WA — design system inline-style di src/lib/ui.jsx, pola layout kartu & modal, aturan form dan microcopy Bahasa Indonesia. Pakai setiap kali menambah atau mengubah tampilan di src/.
---

# UI Populi WA

Dashboard ini **tidak memakai Tailwind, CSS Modules, styled-components, atau file .css**.
Seluruh gaya berupa **inline style** yang mengambil token dari `src/lib/ui.jsx`.
Jangan memperkenalkan sistem styling baru. Jangan menulis `className` untuk keperluan gaya.

## Aturan yang tidak boleh dilanggar

1. **Tidak ada warna hardcode.** Selalu `theme.*`. Kalau butuh warna yang belum ada, tambahkan token di `theme`, jangan tulis hex di tempat pemakaian.
   Pengecualian yang sudah ada: `#fff` untuk teks di atas tombol solid, dan `rgba(...)` untuk bayangan/overlay.
2. **Pakai komponen yang sudah ada sebelum membuat markup sendiri.** Cek daftar di bawah. Bila sebuah pola muncul di dua halaman, angkat jadi komponen di `ui.jsx`.
3. **Field rahasia wajib `PasswordInput`**, bukan `<Input type="password">`. `PasswordInput` sudah punya tombol lihat/sembunyikan dan opsi `noAutofill` untuk token vendor.
4. **Modal berisi form wajib `dirty`.** Lihat bagian Modal.
5. **Semua teks antarmuka Bahasa Indonesia.** Lihat bagian Microcopy.

## Token

Sumber: `src/lib/ui.jsx`.

- Warna: `theme.bg` `surface` `surfaceAlt` `border` `text` `textMuted` `primary` `green` `yellow` `red` `purple`, masing-masing warna punya pasangan `*Soft` untuk latar.
- Font: `fontStack`. Ukuran yang dipakai: `11.5` (hint), `12.5` (teks sekunder & label field), `13` (teks tombol/isi), `13.5` (isi input & subtitle), `15` (judul Card), `15.5` (judul item), `17` (judul Modal), `22` (judul halaman).
- Radius: `8`–`9` kontrol, `10`–`11` panel, `14` kartu (`card`), `999` pil/badge.
- Spasi: kelipatan yang dipakai `6 8 10 12 14 16 18 22 26`. Jangan mengarang nilai di luar deret ini.
- `card` — objek gaya kartu siap sebar (`...card`).

## Komponen

| Butuh | Pakai |
|---|---|
| Judul halaman + tombol aksi | `PageHeader` |
| Panel konten | `Card` (`pad={0}` untuk daftar rapat) |
| Angka ringkasan sekali di atas halaman | `StatCard` |
| Angka ringkasan **berulang** di tiap baris daftar | `StatStrip` — `StatCard` (angka 27px, padding 18) terlalu tinggi kalau diulang |
| Label status | `Badge` |
| Aksi | `Button` (`primary` `secondary` `ghost` `danger` `success`, `size="sm"`) |
| Input | `Input` `Textarea` `Select` `PasswordInput` `Toggle` `Checkbox` |
| Bungkus label + hint + error | `Field` |
| Dialog | `Modal` |
| Konfirmasi / tanya ya-tidak | `confirmDialog` dari `src/lib/confirm` — **jangan** `window.confirm` |
| Minta satu baris teks | `promptDialog` dari `src/lib/confirm` → `Promise<string\|null>` — **jangan** `window.prompt` |
| Pesan galat/sukses | `Notice` |
| Daftar kosong | `Empty` |
| Sedang memuat | `Loading` |
| Tab | `Tabs` |
| Aksi massal | `BulkBar` + `useSelection` |
| Ambil data | `useLoader` |
| Cabang layar sempit | `useIsMobile` / `useMediaQuery` |
| Tanggal | `fmtDate` |
| Ikon | `Icon name="..."` — tambahkan SVG baru ke peta `I` di `ui.jsx`, jangan impor pustaka ikon |

## Layout

**Grid kartu**

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16 }}>
```

**Kartu dengan baris aksi** — kartu dalam satu baris grid punya tinggi sama, jadi baris tombol harus didorong ke bawah supaya sejajar antar kartu. `Card` membungkus isi dalam wadah padding tersendiri, jadi kolom flex-nya perlu dipasang di **dua** tempat lewat `style` dan `bodyStyle`:

```jsx
<Card
  style={{ display: "flex", flexDirection: "column" }}
  bodyStyle={{ display: "flex", flexDirection: "column", flex: 1 }}
>
  …isi…
  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 14, flexWrap: "wrap" }}>
```

**Baris badge di samping judul** — jangan pernah memberi `flexShrink: 0` pada wadah badge tanpa `flexWrap`. Itu merebut lebar dan memaksa judul membungkus jadi banyak baris. Untuk judul panjang + banyak badge, taruh badge **di bawah** judul:

```jsx
<div style={{ fontWeight: 700, fontSize: 15.5 }}>{title}</div>
<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{badges}</div>
```

Batasi 3–4 badge per item. Teks badge maksimal dua kata.

**Baris tombol** selalu `flexWrap: "wrap"` dengan `gap: 8`. Tombol ikon-saja wajib punya `title` (`Button` otomatis menurunkannya jadi `aria-label`). Dua jebakan yang sudah pernah menaikkan tinggi kartu hampir dua kali lipat:

- **Jangan pakai `marginLeft: "auto"` di baris yang membungkus.** Margin auto menyerap seluruh sisa ruang baris, sehingga elemen terakhir terdorong ke baris berikutnya padahal sebenarnya masih muat. Kalau ingin satu tombol menepi ke kanan, pastikan barisnya memang tidak akan pernah membungkus.
- **Jangan menaruh angka yang panjangnya berubah-ubah di label tombol.** `Respons (1240)` jauh lebih lebar daripada `Respons (3)` dan bisa memaksa baris membungkus hanya karena datanya bertambah. Taruh angkanya di baris ringkasan, bukan di tombol.

Kalau ragu apakah muat, ukur: jumlahkan lebar semua tombol + gap, lalu bandingkan dengan lebar barisnya (lihat bagian Verifikasi).

**Memotong teks dengan elipsis** — `whiteSpace: "nowrap"` + `overflow: "hidden"` + `textOverflow: "ellipsis"` saja tidak cukup. Item flex **dan** item grid punya `min-width: auto` bawaan, jadi teks yang tak boleh membungkus akan melebarkan wadahnya dan memunculkan scroll horizontal. Pasang `minWidth: 0` pada **setiap** induk sepanjang rantai, dan untuk grid tulis kolomnya `minmax(0,1fr)` — bukan `1fr`:

```jsx
<div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr)" }}>
```

Beri juga `title={teksPenuh}` supaya isi yang terpotong masih bisa dibaca saat disentuh kursor.

Untuk memotong pada **beberapa baris**, pakai line-clamp — bukan `maxHeight` mentah, yang memenggal tepat di tengah baris sehingga hurufnya tampak terbelah separuh:

```jsx
display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
```

Batasi juga teks bebas seperti deskripsi (2 baris). Tinggi baris grid mengikuti kartu tertinggi, jadi satu deskripsi panjang memanjangkan seluruh baris.

**Panel pengaturan di dalam form**: `{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }`.

## Modal

`Modal` menerima:

- `dirty` — fungsi atau boolean. Bila bernilai benar, klik latar dan tombol Esc **tidak** langsung menutup; muncul konfirmasi dulu. Wajib untuk setiap modal berisi form.
- `onClose` — dipanggil hanya setelah penutupan disetujui.
- `width` — lebar maksimal desktop. Di layar ponsel modal otomatis jadi layar penuh.

Modal hanya-baca (pratinjau, laporan, penampil JSON) biarkan tanpa `dirty` supaya klik luar tetap menutup — itu perilaku yang diharapkan.

Kalau sebuah form punya lebih dari sekitar enam kelompok field, **jangan pakai modal**. Jadikan halaman tersendiri seperti builder survei di `src/pages/survey/SurveyBuilder.jsx`.

## Form

- Bungkus setiap kontrol dengan komponen yang sudah menyertakan `Field`, jangan bikin label sendiri.
- `hint` untuk penjelasan, `error` untuk galat. Keduanya tidak muncul bersamaan.
- Nonaktifkan tombol simpan saat isian wajib kosong **dan** saat sedang menyimpan; ubah labelnya jadi `Menyimpan...`.
- Dua kolom di desktop, satu kolom di ponsel: `gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr"`.

## Microcopy

Bahasa Indonesia, sentence case, tanpa basa-basi.

- Tombol menyebut akibatnya: `Simpan`, `Hapus`, `Kirim Blast` — bukan `Submit` atau `OK`.
- Nama aksi konsisten dari tombol sampai pesan hasilnya.
- Galat menjelaskan apa yang terjadi dan langkah perbaikannya. Jangan minta maaf, jangan samar.
- Layar kosong berisi ajakan bertindak, bukan sekadar `Tidak ada data`.
- Istilah teknis Meta (`template`, `Flow`, `Flow ID`, `webhook`) dibiarkan apa adanya — itu yang tertulis di dashboard Meta dan penggunanya mencocokkan.

## Batas mutu

Setiap perubahan UI harus tetap memenuhi ini:

- Berfungsi sampai lebar 375px. Uji dengan `resize_window`.
- Fokus keyboard terlihat; modal bisa ditutup dengan Esc; Tab tidak lolos keluar modal.
- Tombol ikon-saja punya nama aksesibel.
- Tidak ada scroll horizontal pada body.

## Verifikasi

Jangan pernah menyerahkan perubahan UI tanpa melihatnya. Alurnya:

1. `preview_start` dengan `{ name: "frontend" }` (lihat `.claude/launch.json`).
2. `computer` → `screenshot`, bandingkan sebelum/sesudah.
3. `read_console_messages` untuk memastikan tak ada galat.
4. `resize_window` preset `mobile` untuk cek layar sempit.

### Halaman terkunci login

Seluruh dashboard ada di balik login, dan backend lokal biasanya tidak jalan. **Jangan mengisi
kredensial siapa pun untuk menembusnya.** Pakai harness sementara: tambal metode `api` dengan
data tiruan lalu render **komponen halaman yang asli** — bukan tiruan markup-nya, supaya yang
diuji benar-benar kode yang dikirim.

Buat dua berkas, lalu buka `http://localhost:5173/dev-preview.html` (Vite melayani HTML
tambahan di root tanpa konfigurasi apa pun):

```jsx
// src/dev-preview.jsx — SEMENTARA, hapus setelah selesai
import { createRoot } from "react-dom/client";
import "./index.css"; // WAJIB — lihat catatan di bawah
import { api } from "./lib/api";
import { ConfirmHost } from "./lib/confirm";
import Broadcast from "./pages/Broadcast";

api.listBlasts = async () => MOCK; // tambal secukupnya; `api` objek biasa, bisa ditimpa
createRoot(document.getElementById("root")).render(
  <>
    <main style={{ padding: "26px 30px", maxWidth: 1200 }}><Broadcast /></main>
    <ConfirmHost />
  </>,
);
```

`dev-preview.html` cukup berisi `<div id="root">` + `<script type="module" src="/src/dev-preview.jsx">`.

Tiga hal yang menyelamatkan waktu:

- **Impor `./index.css`.** Tanpa itu harness memakai `content-box` dan `body { margin: 8px }`
  bawaan browser, lalu muncul scroll horizontal palsu yang tidak ada di aplikasi sungguhan.
- **Hapus kedua berkas sebelum commit.** Keduanya tidak boleh masuk repo.
- Galat konsol `createRoot() on a container that has already been passed` dan
  `[vite] Failed to reload /src/dev-preview.jsx` berasal dari HMR harness, bukan aplikasi.

### Kalau screenshot gagal

Bila `computer` → `screenshot` menjawab *"the Browser pane is not displayed"*, panel browser
tidak sedang tampil dan gambar tidak bisa diambil. Jangan menyerah pada verifikasi — **ukur
DOM-nya** lewat `javascript_tool`. Untuk klaim tata letak, angka justru lebih tegas daripada
gambar:

```js
el.getBoundingClientRect()                                   // tinggi kartu, posisi baris tombol
getComputedStyle(el).gridTemplateColumns                     // jumlah & lebar kolom
document.documentElement.scrollWidth > clientWidth           // ada scroll horizontal?
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > vw)  // cari biang overflow
```

Interaksi juga bisa diuji dari situ: `dispatchEvent(new MouseEvent(...))` pada latar modal,
`new KeyboardEvent('keydown', { key: 'Escape' })`, dan untuk mengisi input React pakai setter
asli `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` lalu picu
`new Event('input', { bubbles: true })` — menyetel `.value` langsung tidak akan terbaca React.

### Service worker

Aplikasi ini memasang **service worker**. Kalau browser menyajikan modul lama padahal sumbernya sudah benar, batalkan registrasi service worker dan hapus cache-nya lewat `javascript_tool` sebelum menduga ada bug di kode.

## Perintah

```bash
npm run lint
npm test
npm run build
```

Lint harus nol galat sebelum menyerahkan pekerjaan.
