// @refresh reset
// ↑ Fast Refresh memasang ulang komponen ini dari nol (lihat PetaSebaran.jsx).
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Notice, useIsMobile, theme } from "../../lib/ui";
import { bboxProvinsi, jumlahWilayahPerProvinsi, kepekatanIsi } from "../../lib/petaSebaran";
import { SENTUH, gayaWadahPeta, geoJsonProvinsi, keBatasLeaflet, petaHidup, usePetaDasar } from "./petaDasar";

// Indonesia jauh lebih lebar daripada tingginya, dan peta ini hampir selalu menampilkan
// seluruhnya — wadah setinggi peta lokasi menyisakan lautan kosong di atas dan bawahnya,
// terutama di layar ponsel yang sempit.
const TINGGI = { ponsel: 260, lebar: 420 };

// Isi tooltip: nama provinsi dan jumlah respondennya saja. Dibangun sebagai elemen, bukan
// string HTML — Leaflet memasang string tooltip sebagai innerHTML.
function isiTooltip(nama, n) {
  const el = document.createElement("div");
  const judul = document.createElement("strong");
  judul.textContent = nama;
  el.append(judul, document.createElement("br"), `${n} responden`);
  return el;
}

/**
 * Peta sebaran jawaban pertanyaan Wilayah: tiap provinsi diwarnai menurut jumlah
 * respondennya. Arahkan kursor atau klik/ketuk provinsi untuk melihat nama dan jumlahnya.
 * Jawaban tingkat kabupaten/kota dihitung ke provinsinya — garis batas yang tersedia hanya
 * sampai provinsi.
 */
export function PetaWilayah({ values, kabKota = false }) {
  const isMobile = useIsMobile();
  const { pasang, peta, warna, batas } = usePetaDasar();
  const fitur = batas.data?.tersedia ? batas.data.fitur : null;
  const hitung = useMemo(() => (fitur ? jumlahWilayahPerProvinsi(values, fitur) : null), [values, fitur]);

  useEffect(() => {
    if (!petaHidup(peta) || !fitur || !hitung) return;
    const { perProvinsi } = hitung;
    const maks = Math.max(0, ...perProvinsi.values());
    const gaya = (f) => ({
      color: warna.utama,
      weight: 1,
      opacity: 0.6,
      fillColor: warna.utama,
      fillOpacity: kepekatanIsi(perProvinsi.get(f.properties.kode) ?? 0, maks),
    });
    const lapis = L.geoJSON(geoJsonProvinsi(fitur), {
      pane: "provinsi",
      style: gaya,
      onEachFeature: (f, layer) => {
        // sticky: mengikuti kursor. Leaflet juga membukanya saat provinsi diklik/diketuk,
        // jadi di layar sentuh pun jumlahnya terbaca.
        layer.bindTooltip(isiTooltip(f.properties.nama, perProvinsi.get(f.properties.kode) ?? 0), { sticky: true });
        // Garis tepi provinsi yang ditunjuk ditebalkan — di peta seluruh Indonesia provinsi
        // kecil sulit dibedakan dari tetangganya.
        layer.on("mouseover", () => {
          layer.setStyle({ weight: 2.5, opacity: 1 });
          layer.bringToFront();
        });
        layer.on("mouseout", () => layer.setStyle(gaya(f)));
      },
    }).addTo(peta);
    return () => lapis.remove();
  }, [peta, fitur, hitung, warna]);

  // Zoom ke provinsi-provinsi yang punya responden (seluruh Indonesia selama garis batasnya
  // belum termuat).
  useEffect(() => {
    if (!petaHidup(peta)) return;
    // Sedikit jarak di tepi, supaya ujung Aceh dan Papua tidak terpotong bingkai peta.
    peta.fitBounds(keBatasLeaflet(bboxProvinsi(fitur ?? [], hitung?.perProvinsi ?? new Map())), {
      padding: [8, 8],
    });
  }, [peta, fitur, hitung]);

  // Tanpa garis batas, peta ini tidak punya isi apa pun untuk ditampilkan — grafik di
  // bawahnya tetap memuat angkanya.
  if (batas.error) return <Notice>{batas.error}</Notice>;
  if (batas.data && !batas.data.tersedia)
    return (
      <Notice kind="info">
        Garis batas provinsi belum terpasang di server, jadi peta sebaran wilayah belum bisa ditampilkan.
      </Notice>
    );

  const terpetakan = hitung ? values.length - hitung.takTerpetakan : 0;
  return (
    <div>
      <div
        ref={pasang}
        role="region"
        aria-label={`Peta sebaran ${terpetakan} responden per provinsi`}
        style={gayaWadahPeta(isMobile, TINGGI)}
      />
      <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Makin pekat warnanya, makin banyak respondennya.
        {SENTUH
          ? " Ketuk provinsi untuk melihat jumlahnya; geser dan perbesar peta dengan dua jari."
          : " Arahkan kursor atau klik provinsi untuk melihat jumlahnya; klik peta untuk memperbesar dengan roda tetikus."}
        {kabKota ? " Jawaban kabupaten/kota dihitung ke provinsinya." : ""}
        {hitung?.takTerpetakan ? ` ${hitung.takTerpetakan} jawaban tidak dapat dipetakan ke provinsi.` : ""}
        {batas.data?.tersedia ? ` Batas provinsi: ${batas.data.sumber} (${batas.data.lisensi}).` : ""}
      </div>
    </div>
  );
}
