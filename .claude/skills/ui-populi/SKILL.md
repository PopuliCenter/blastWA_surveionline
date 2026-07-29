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
| Angka ringkasan | `StatCard` |
| Label status | `Badge` |
| Aksi | `Button` (`primary` `secondary` `ghost` `danger` `success`, `size="sm"`) |
| Input | `Input` `Textarea` `Select` `PasswordInput` `Toggle` `Checkbox` |
| Bungkus label + hint + error | `Field` |
| Dialog | `Modal` |
| Konfirmasi / tanya ya-tidak | `confirmDialog` dari `src/lib/confirm` — **jangan** `window.confirm` |
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

**Baris tombol** selalu `flexWrap: "wrap"` dengan `gap: 8`. Tombol ikon-saja wajib punya `title` (`Button` otomatis menurunkannya jadi `aria-label`).

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

Aplikasi ini memasang **service worker**. Kalau browser menyajikan modul lama padahal sumbernya sudah benar, batalkan registrasi service worker dan hapus cache-nya lewat `javascript_tool` sebelum menduga ada bug di kode.

## Perintah

```bash
npm run lint
npm test
npm run build
```

Lint harus nol galat sebelum menyerahkan pekerjaan.
