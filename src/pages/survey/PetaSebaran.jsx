// @refresh reset
// ↑ Fast Refresh memasang ulang komponen ini dari nol. Tanpa itu, menyunting berkas ini saat
// dev membuat efek berjalan dengan peta lama yang sudah dibuang, dan halaman crash.
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Notice, Tabs, useIsMobile, theme } from "../../lib/ui";
import { INDONESIA, bboxSebaran, dalamIndonesia, jariJari } from "../../lib/petaSebaran";
import { SENTUH, gayaWadahPeta, geoJsonProvinsi, keBatasLeaflet, petaHidup, usePetaDasar } from "./petaDasar";

/**
 * Peta sebaran lokasi yang dibagikan responden di atas peta OpenStreetMap: provinsi diwarnai
 * menurut jumlah lokasi yang jatuh di dalamnya, titik menandai koordinat (dibulatkan ±1 km
 * di server). Bawaannya diperbesar ke sebaran titiknya — survei satu provinsi tidak berguna
 * dilihat sebagai satu noktah di peta seluruh Indonesia.
 */
export function PetaSebaran({ titik, perProvinsi }) {
  const isMobile = useIsMobile();
  const { pasang, peta, warna, batas } = usePetaDasar();
  const [luas, setLuas] = useState("sebaran");
  // Titik di luar Indonesia tidak ikut menentukan zoom (lihat dalamIndonesia) dan tidak
  // tergambar — jumlahnya disebutkan di bawah peta.
  const titikDalam = useMemo(() => titik.filter(dalamIndonesia), [titik]);
  const diLuar = titik.reduce((n, t) => (dalamIndonesia(t) ? n : n + t.n), 0);

  // Garis batas provinsi, diwarnai menurut jumlah lokasi.
  useEffect(() => {
    if (!petaHidup(peta) || !batas.data?.tersedia) return;
    const maks = Math.max(1, ...perProvinsi.values());
    const lapis = L.geoJSON(geoJsonProvinsi(batas.data.fitur), {
      pane: "provinsi",
      style: (f) => {
        const n = perProvinsi.get(f.properties.kode) ?? 0;
        return {
          color: warna.utama,
          weight: 1,
          opacity: 0.6,
          fillColor: warna.utama,
          fillOpacity: n ? 0.06 + 0.3 * (n / maks) : 0,
        };
      },
      onEachFeature: (f, layer) =>
        layer.bindTooltip(`${f.properties.nama}: ${perProvinsi.get(f.properties.kode) ?? 0} lokasi`, {
          sticky: true,
        }),
    }).addTo(peta);
    return () => lapis.remove();
  }, [peta, batas.data, perProvinsi, warna]);

  // Titik responden — satu lingkaran per koordinat, besarnya mengikuti jumlah orang.
  useEffect(() => {
    if (!petaHidup(peta)) return;
    const lapis = L.layerGroup(
      titikDalam.map((t) =>
        L.circleMarker([t.lat, t.lng], {
          pane: "titik",
          radius: jariJari(t.n, 5),
          color: warna.permukaan,
          weight: 1,
          fillColor: warna.merah,
          fillOpacity: 0.8,
        }).bindTooltip(`${t.n} responden${t.provinsi ? ` • ${t.provinsi}` : ""}`),
      ),
    ).addTo(peta);
    return () => lapis.remove();
  }, [peta, titikDalam, warna]);

  // Zoom: sebaran titik, atau seluruh Indonesia.
  useEffect(() => {
    if (!petaHidup(peta)) return;
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
        style={gayaWadahPeta(isMobile)}
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
