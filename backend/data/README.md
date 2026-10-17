# backend/data

`batas-provinsi.json` — garis batas 38 provinsi (kode Kepmendagri), dipakai untuk:

- menentukan provinsi dari lokasi yang dibagikan responden (dihitung di server sendiri,
  koordinat tidak dikirim ke layanan geocoding pihak ketiga), dan
- menggambar peta sebaran di halaman Laporan.

Berkas ini **dihasilkan**, bukan disunting tangan. Sumbernya OpenStreetMap: relasi batas
provinsi (`admin_level=4`) yang membawa tag `ref:ID:kemendagri` — kode yang sama dengan
aplikasi. Lisensinya ODbL 1.0: wajib atribusi "© kontributor OpenStreetMap", dan bila peta
atau datanya dipakai secara publik (mis. laporan untuk klien), berkas ini harus ikut
ditawarkan dengan lisensi yang sama.

Batas provinsi OSM mencakup wilayah laut provinsi, jadi responden di pesisir tetap
terhitung di provinsinya.

Cara membuat ulang (semua berkas antara disimpan di luar repo):

1. Unduh dari Overpass API (±14 MB):
   ```
   [out:json][timeout:900];
   rel["boundary"="administrative"]["admin_level"="4"]["ref:ID:kemendagri"];
   out body; >; out skel qt;
   ```
2. `npx osmtogeojson -f json -m provinsi-osm.json > provinsi-osm.geojson`, lalu ambil hanya
   fitur poligon relasi dengan properti `kode` = `ref:ID:kemendagri`.
3. `npx mapshaper provinsi.geojson -simplify interval=100 keep-shapes -o format=geojson precision=0.00001 provinsi-100m.geojson`
   — penyederhanaan yang menjaga topologi, jadi batas bersama dua provinsi tidak retak.
4. `npm run siapkan:batas -- provinsi-100m.geojson --kode=kode --sumber="…" --lisensi="© kontributor OpenStreetMap, ODbL 1.0"`
5. `npx vitest run test/batasProvinsi.data.test.ts` — ibu kota ke-38 provinsi, kota dekat
   batas antarprovinsi, dan kota di negara tetangga harus lolos.

Sumber dan lisensinya tersimpan di dalam berkas dan tampil sebagai atribusi di bawah peta.

Tanpa berkas ini fitur lokasi tetap berjalan: lokasi disimpan (dibulatkan
±1 km) dengan status "Provinsi belum dapat ditentukan", dan petanya belum bisa digambar.
Setelah berkas dipasang (dan backend dijalankan ulang), provinsi lokasi lama langsung
dihitung saat daftar respons dibuka; `npm run lengkapi:lokasi -- --apply` menyimpannya
permanen.

Folder ini ikut disalin ke image Docker (lihat `Dockerfile`).
