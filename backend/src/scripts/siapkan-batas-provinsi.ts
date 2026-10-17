/**
 * Ubah data batas provinsi (GeoJSON) menjadi backend/data/batas-provinsi.json — berkas yang
 * dipakai untuk menentukan provinsi dari lokasi responden dan menggambar peta sebaran.
 *
 * Masukannya harus SATU fitur per provinsi (sudah dilebur) dan sudah disederhanakan dengan
 * alat yang menjaga topologi. Data per kab/kota yang hanya ditumpuk per provinsi tampil
 * retak di peta — setiap batas kab/kota tergaris, dan kota yang dikelilingi kabupaten
 * tampil berlubang — jadi skrip ini menolaknya.
 *
 * Sumber yang dipakai: OpenStreetMap (relasi admin_level=4 ber-ref:ID:kemendagri) — satu
 * relasi per provinsi, jadi sudah "dilebur". Langkah lengkapnya ada di data/README.md:
 * Overpass → osmtogeojson → mapshaper -simplify (topologi terjaga) → skrip ini → tes data.
 *
 * Untuk sumber per kab/kota (mis. BIG BATAS_KABKOTA_AR), lebur dulu per provinsi:
 *   npx mapshaper kabkota.geojson -clean -dissolve KDPPUM -simplify interval=150 keep-shapes
 *     -o format=geojson provinsi.geojson
 *
 * --kode: properti berisi kode 2 digit (mis. "32"). --nama: properti nama provinsi,
 *         dicocokkan dengan daftar provinsi dan sinonimnya (lib/wilayah.ts).
 * --tanpa-lebur: terima sumber yang satu provinsinya terdiri atas beberapa fitur (mis. satu
 *         fitur per pulau) — HANYA bila fitur-fitur itu memang tidak saling bersinggungan.
 *
 * Berkas sumber TIDAK disimpan di repo — hanya hasilnya, beserta sumber dan lisensinya
 * (ditampilkan sebagai atribusi di bawah peta).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { susunBatas, type FiturSumber } from "../lib/susunBatas.js";
import type { BerkasBatas } from "../services/petaProvinsi.js";

function argumen(nama: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${nama}=`));
  return a ? a.slice(nama.length + 3) : undefined;
}

async function main() {
  const masukan = process.argv[2];
  const propKode = argumen("kode");
  const propNama = argumen("nama");
  const sumber = argumen("sumber");
  const lisensi = argumen("lisensi");
  if (!masukan || masukan.startsWith("--") || (!propKode && !propNama) || !sumber || !lisensi) {
    console.error(
      "Pemakaian: siapkan-batas-provinsi.ts <berkas.geojson> --kode=<prop> | --nama=<prop> --sumber=... --lisensi=...",
    );
    process.exit(1);
  }

  const gj = JSON.parse(await readFile(masukan, "utf8")) as { features?: FiturSumber[] };
  const h = susunBatas(gj.features ?? [], { propKode, propNama });

  if (h.takCocok.length) {
    const ringkas = [...new Set(h.takCocok)].slice(0, 20).join(", ");
    console.warn(`${h.takCocok.length} fitur tanpa provinsi yang dikenali, dilewati: ${ringkas}`);
  }
  let gagal = false;
  if (h.hilang.length) {
    console.error(`Provinsi tidak ada di data sumber: ${h.hilang.map((p) => `${p.nama} (${p.kode})`).join(", ")}`);
    console.error("Data sumber kemungkinan memakai pembagian lama (34 provinsi), atau kuncinya keliru.");
    gagal = true;
  }
  if (h.belumDilebur.length && !process.argv.includes("--tanpa-lebur")) {
    const contoh = h.belumDilebur
      .slice(0, 5)
      .map(([k, n]) => `${k}: ${n} fitur`)
      .join(", ");
    console.error(`Data belum dilebur per provinsi (${contoh}…). Lebur dulu dengan mapshaper — lihat langkah 2.`);
    gagal = true;
  }
  if (gagal) {
    console.error("Berkas TIDAK ditulis.");
    process.exit(1);
  }

  let titik = 0;
  for (const f of h.fitur) for (const p of f.poligon) for (const c of p) titik += c.length;
  const hasil: BerkasBatas = { sumber, lisensi, fitur: h.fitur };
  const keluar = new URL("../../data/batas-provinsi.json", import.meta.url);
  await mkdir(new URL(".", keluar), { recursive: true });
  const isi = JSON.stringify(hasil);
  await writeFile(keluar, isi);
  console.log(
    `Selesai: ${h.fitur.length} provinsi, ${titik.toLocaleString("id-ID")} titik, ` +
      `${(isi.length / 1024 / 1024).toFixed(1)} MB → backend/data/batas-provinsi.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
