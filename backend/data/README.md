# backend/data

`batas-provinsi.json` — garis batas 38 provinsi (kode Kepmendagri), dipakai untuk:

- menentukan provinsi dari lokasi yang dibagikan responden (dihitung di server sendiri,
  koordinat tidak dikirim ke layanan geocoding pihak ketiga), dan
- menggambar peta sebaran di halaman Laporan.

Berkas ini **dihasilkan**, bukan disunting tangan. Langkah lengkapnya ada di kepala
`src/scripts/siapkan-batas-provinsi.ts`. Ringkasnya:

1. Unduh sekali data batas kab/kota BIG (`BATAS_KABKOTA_AR`) dari layanan ArcGIS REST BIG,
   simpan **di luar repo**:
   `https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KABKOTA_AR/MapServer/0/query`
   dengan `where=1=1&outFields=KDPPUM,WADMPR&returnGeometry=true&returnZ=false&outSR=4326&f=geojson`.
2. Lebur per provinsi dan sederhanakan dengan topologi terjaga (`mapshaper -clean -dissolve KDPPUM -simplify …`).
   Skrip menolak data yang belum dilebur: peta per kab/kota yang hanya ditumpuk tampil retak.
3. `npm run siapkan:batas -- <provinsi.geojson> --kode=KDPPUM --sumber="…" --lisensi="…"`

Sumber dan lisensinya tersimpan di dalam berkas dan tampil sebagai atribusi di bawah peta.

Selama berkas ini belum ada, fitur lokasi tetap berjalan: lokasi disimpan (dibulatkan
±1 km) dengan status "Provinsi belum dapat ditentukan", dan petanya belum bisa digambar.
Setelah berkas dipasang (dan backend dijalankan ulang), provinsi lokasi lama langsung
dihitung saat daftar respons dibuka; `npm run lengkapi:lokasi -- --apply` menyimpannya
permanen.

Folder ini ikut disalin ke image Docker (lihat `Dockerfile`).
