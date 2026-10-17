// @refresh reset
// ↑ Fast Refresh memasang ulang komponen ini dari nol. Tanpa itu, menyunting berkas ini saat
// dev membuat efek berjalan dengan peta lama yang sudah dibuang, dan halaman crash.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import L from "leaflet";
// CSS bawaan Leaflet WAJIB: tanpa itu ubin peta tersusun acak. Ini satu-satunya berkas CSS
// di aplikasi, dan isinya milik pustaka, bukan gaya kita.
import "leaflet/dist/leaflet.css";
import { api } from "../../lib/api";
import { Notice, Tabs, useIsMobile, useLoader, theme } from "../../lib/ui";
import { INDONESIA, bboxSebaran, dalamIndonesia, jariJari } from "../../lib/petaSebaran";

// Peta dasar OpenStreetMap. Kebijakan server ubin OSM membolehkan pemakaian ringan seperti
// dasbor internal dengan atribusi yang terlihat; pemakaian berat butuh penyedia ubin sendiri.
// Yang dimuat dari server OSM hanya ubin area yang sedang dilihat — titik responden
// digambar di browser dan tidak dikirim ke mana pun.
const UBIN_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUSI_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">kontributor OpenStreetMap</a>';

// Perangkat sentuh: satu jari menggulir halaman, peta digeser/diperbesar dua jari. Opsi peta
// dan kalimat petunjuknya memakai tanda yang SAMA — lebar layar tidak menentukan ada-tidaknya
// tetikus (ponsel lanskap lebar, jendela desktop bisa sempit).
const SENTUH = L.Browser.mobile;

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

const keBatasLeaflet = ([a, b, c, d]) => [
  [b, a],
  [d, c],
];

/**
 * Peta sebaran lokasi yang dibagikan responden di atas peta OpenStreetMap: provinsi diwarnai
 * menurut jumlah lokasi yang jatuh di dalamnya, titik menandai koordinat (dibulatkan ±1 km
 * di server). Bawaannya diperbesar ke sebaran titiknya — survei satu provinsi tidak berguna
 * dilihat sebagai satu noktah di peta seluruh Indonesia.
 */
export function PetaSebaran({ titik, perProvinsi }) {
  const isMobile = useIsMobile();
  const palet = useSyncExternalStore(langgananTema, bacaPalet);
  const [peta, setPeta] = useState(null);
  const batas = useLoader(useCallback(() => api.petaProvinsi(), []));
  const [luas, setLuas] = useState("sebaran");
  // Titik di luar Indonesia tidak ikut menentukan zoom (lihat dalamIndonesia) dan tidak
  // tergambar — jumlahnya disebutkan di bawah peta.
  const titikDalam = useMemo(() => titik.filter(dalamIndonesia), [titik]);
  const diLuar = titik.reduce((n, t) => (dalamIndonesia(t) ? n : n + t.n), 0);

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

  // Garis batas provinsi, diwarnai menurut jumlah lokasi.
  useEffect(() => {
    if (!peta || !batas.data?.tersedia) return;
    const maks = Math.max(1, ...perProvinsi.values());
    const [utama] = palet.split("|");
    const lapis = L.geoJSON(
      {
        type: "FeatureCollection",
        features: batas.data.fitur.map((f) => ({
          type: "Feature",
          properties: { kode: f.kode, nama: f.nama },
          geometry: { type: "MultiPolygon", coordinates: f.poligon },
        })),
      },
      {
        pane: "provinsi",
        style: (f) => {
          const n = perProvinsi.get(f.properties.kode) ?? 0;
          return {
            color: utama,
            weight: 1,
            opacity: 0.6,
            fillColor: utama,
            fillOpacity: n ? 0.06 + 0.3 * (n / maks) : 0,
          };
        },
        onEachFeature: (f, layer) =>
          layer.bindTooltip(`${f.properties.nama}: ${perProvinsi.get(f.properties.kode) ?? 0} lokasi`, {
            sticky: true,
          }),
      },
    ).addTo(peta);
    return () => lapis.remove();
  }, [peta, batas.data, perProvinsi, palet]);

  // Titik responden — satu lingkaran per koordinat, besarnya mengikuti jumlah orang.
  useEffect(() => {
    if (!peta) return;
    const [, tepi, isi] = palet.split("|");
    const lapis = L.layerGroup(
      titikDalam.map((t) =>
        L.circleMarker([t.lat, t.lng], {
          pane: "titik",
          radius: jariJari(t.n, 5),
          color: tepi,
          weight: 1,
          fillColor: isi,
          fillOpacity: 0.8,
        }).bindTooltip(`${t.n} responden${t.provinsi ? ` • ${t.provinsi}` : ""}`),
      ),
    ).addTo(peta);
    return () => lapis.remove();
  }, [peta, titikDalam, palet]);

  // Zoom: sebaran titik, atau seluruh Indonesia.
  useEffect(() => {
    if (!peta) return;
    const kotak = luas === "sebaran" && titikDalam.length ? bboxSebaran(titikDalam) : INDONESIA;
    peta.fitBounds(keBatasLeaflet(kotak));
  }, [peta, luas, titikDalam]);

  return (
    <div>
      {titikDalam.length ? (
        <Tabs
          tabs={[
            { id: "sebaran", label: "Sebaran" },
            { id: "indonesia", label: "Seluruh Indonesia" },
          ]}
          active={luas}
          onChange={setLuas}
          style={{ marginBottom: 10 }}
        />
      ) : null}
      <div
        ref={pasang}
        role="region"
        aria-label={`Peta sebaran ${titikDalam.reduce((n, t) => n + t.n, 0)} lokasi responden`}
        style={{
          height: isMobile ? 340 : 460,
          borderRadius: 10,
          overflow: "hidden",
          background: theme.surfaceAlt,
          // Kontrol Leaflet memakai z-index ratusan–ribuan; tanpa konteks tumpukan sendiri
          // ia muncul di atas modal dan menu aplikasi.
          position: "relative",
          zIndex: 0,
        }}
      />
      {batas.error ? <Notice>{batas.error}</Notice> : null}
      {batas.data && !batas.data.tersedia ? (
        <div style={{ marginTop: 10 }}>
          <Notice kind="info">
            Garis batas provinsi belum terpasang di server, jadi provinsi dari lokasi belum bisa ditentukan. Titik
            responden tetap tampil.
          </Notice>
        </div>
      ) : null}
      <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Titik dibulatkan sekitar 1 km — satu titik bisa mewakili beberapa responden, dan besarnya mengikuti jumlah itu.
        {diLuar ? ` ${diLuar} lokasi di luar Indonesia tidak tergambar.` : ""}
        {SENTUH ? " Geser dan perbesar peta dengan dua jari." : " Klik peta untuk memperbesar dengan roda tetikus."}
        {batas.data?.tersedia ? ` Batas provinsi: ${batas.data.sumber} (${batas.data.lisensi}).` : ""}
      </div>
    </div>
  );
}
