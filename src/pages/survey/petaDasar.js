// Dasar bersama peta Laporan: peta OpenStreetMap, warna tema, dan garis batas provinsi.
// Dipakai peta sebaran lokasi (PetaSebaran.jsx) dan peta jawaban Wilayah (PetaWilayah.jsx).
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import L from "leaflet";
// CSS bawaan Leaflet WAJIB: tanpa itu ubin peta tersusun acak. Ini satu-satunya berkas CSS
// di aplikasi, dan isinya milik pustaka, bukan gaya kita.
import "leaflet/dist/leaflet.css";
import { api } from "../../lib/api";
import { useLoader, theme } from "../../lib/ui";

// Peta dasar OpenStreetMap. Kebijakan server ubin OSM membolehkan pemakaian ringan seperti
// dasbor internal dengan atribusi yang terlihat; pemakaian berat butuh penyedia ubin sendiri.
// Yang dimuat dari server OSM hanya ubin area yang sedang dilihat — data responden
// digambar di browser dan tidak dikirim ke mana pun.
const UBIN_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUSI_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">kontributor OpenStreetMap</a>';

// Perangkat sentuh: satu jari menggulir halaman, peta digeser/diperbesar dua jari. Opsi peta
// dan kalimat petunjuknya memakai tanda yang SAMA — lebar layar tidak menentukan ada-tidaknya
// tetikus (ponsel lanskap lebar, jendela desktop bisa sempit).
export const SENTUH = L.Browser.mobile;

// Leaflet menulis warna sebagai atribut SVG, dan atribut tidak membaca var(--…) — jadi nilai
// token tema dibaca sendiri, dan dibaca ULANG saat tema berganti (tombol tema di sidebar
// mengubah data-theme; mode "ikut sistem" berubah bersama OS).
const TOKEN_WARNA = ["--primary", "--surface", "--red"];
function bacaPalet() {
  const gaya = getComputedStyle(document.documentElement);
  return TOKEN_WARNA.map((t) => gaya.getPropertyValue(t).trim()).join("|");
}
function langgananTema(ubah) {
  const amati = new MutationObserver(ubah);
  amati.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", ubah);
  return () => {
    amati.disconnect();
    mq.removeEventListener("change", ubah);
  };
}

// [minBujur, minLintang, maksBujur, maksLintang] → bentuk batas Leaflet [[lat, lng], [lat, lng]].
export const keBatasLeaflet = ([a, b, c, d]) => [
  [b, a],
  [d, c],
];

// Garis batas provinsi diunduh SEKALI untuk seluruh halaman. Laporan bisa memuat beberapa
// peta sekaligus (lokasi responden, tiap pertanyaan Wilayah) yang dipasang bersamaan —
// sebelum unduhan pertama selesai, cache browser belum berisi apa-apa, jadi tanpa ini
// berkas batas yang sama terunduh sekali per peta.
//
// Jawaban "belum tersedia" dan galat tidak disimpan, supaya peta langsung muncul begitu
// datanya dipasang di server (sama dengan Cache-Control rutenya).
let batasProvinsi = null;
function muatBatasProvinsi() {
  if (!batasProvinsi)
    batasProvinsi = api.petaProvinsi().then(
      (d) => {
        if (!d?.tersedia) batasProvinsi = null;
        return d;
      },
      (err) => {
        batasProvinsi = null;
        throw err;
      },
    );
  return batasProvinsi;
}

// Apakah peta ini masih hidup (belum di-remove). Efek yang menggambar lapisan memeriksanya
// lebih dulu: saat Fast Refresh (dev), React membuat ulang ref callback — peta lama dibuang
// dan peta baru dibuat dalam commit yang sama — sementara efeknya masih berjalan sekali lagi
// dengan peta LAMA dari render sebelumnya. Menambah lapisan ke peta yang sudah dibuang
// membuat Leaflet crash (panenya sudah tidak ada). Render berikutnya membawa peta yang baru.
export const petaHidup = (p) => Boolean(p?.getPane("provinsi"));

// Fitur provinsi dari server → GeoJSON untuk L.geoJSON.
export const geoJsonProvinsi = (fitur) => ({
  type: "FeatureCollection",
  features: fitur.map((f) => ({
    type: "Feature",
    properties: { kode: f.kode, nama: f.nama },
    geometry: { type: "MultiPolygon", coordinates: f.poligon },
  })),
});

// Wadah peta. Kontrol Leaflet memakai z-index ratusan–ribuan; tanpa konteks tumpukan sendiri
// ia muncul di atas modal dan menu aplikasi.
export const gayaWadahPeta = (isMobile, tinggi = { ponsel: 340, lebar: 460 }) => ({
  height: isMobile ? tinggi.ponsel : tinggi.lebar,
  borderRadius: 10,
  overflow: "hidden",
  background: theme.surfaceAlt,
  position: "relative",
  zIndex: 0,
});

/**
 * Peta OSM kosong beserta warna tema dan garis batas provinsi.
 *  - `pasang`: ref callback untuk wadah peta;
 *  - `peta`: instans Leaflet (null sebelum wadahnya terpasang), dengan lapisan "provinsi"
 *    di bawah lapisan "titik";
 *  - `warna`: { utama, permukaan, merah } dari token tema yang sedang aktif;
 *  - `batas`: hasil useLoader garis batas provinsi.
 */
export function usePetaDasar() {
  const palet = useSyncExternalStore(langgananTema, bacaPalet);
  const warna = useMemo(() => {
    const [utama, permukaan, merah] = palet.split("|");
    return { utama, permukaan, merah };
  }, [palet]);
  const [peta, setPeta] = useState(null);
  const batas = useLoader(muatBatasProvinsi);

  // Peta dibuat sekali, saat wadahnya terpasang (ref callback; React 19 menjalankan fungsi
  // yang dikembalikannya saat wadah dilepas).
  const pasang = useCallback((node) => {
    if (!node) return;
    const p = L.map(node, {
      // Roda tetikus baru memperbesar setelah peta diklik: kalau tidak, menggulir halaman
      // Laporan melewati peta tiba-tiba memperbesar petanya.
      scrollWheelZoom: false,
      dragging: !SENTUH,
      // Zoom pecahan: dengan zoom bulat, "Seluruh Indonesia" ikut memuat separuh Asia
      // Tenggara karena tingkat berikutnya sudah terlalu dekat.
      zoomSnap: 0.25,
      attributionControl: false,
      zoomControl: false,
    });
    // Label tombol zoom bawaan Leaflet berbahasa Inggris — juga yang dibacakan pembaca layar.
    L.control.zoom({ zoomInTitle: "Perbesar", zoomOutTitle: "Perkecil" }).addTo(p);
    // Lapisan sendiri-sendiri dengan urutan tetap: titik SELALU di atas provinsi. Dalam satu
    // lapisan SVG urutannya mengikuti siapa yang ditambahkan lebih dulu, dan garis batas
    // datang belakangan (diambil dari server) — lalu menutupi titik beserta tooltip-nya.
    p.createPane("provinsi").style.zIndex = "410";
    p.createPane("titik").style.zIndex = "420";
    L.control
      .attribution({ prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' })
      .addTo(p);
    L.tileLayer(UBIN_OSM, { maxZoom: 18, attribution: ATRIBUSI_OSM }).addTo(p);
    p.on("click", () => p.scrollWheelZoom.enable());
    p.on("mouseout", () => p.scrollWheelZoom.disable());
    // Lebar kartu berubah (sidebar dilipat, layar diputar) → Leaflet perlu mengukur ulang.
    const amati = new ResizeObserver(() => p.invalidateSize());
    amati.observe(node);
    setPeta(p);
    return () => {
      amati.disconnect();
      p.remove();
      setPeta(null);
    };
  }, []);

  return { pasang, peta, warna, batas };
}
