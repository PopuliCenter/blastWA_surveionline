import { useCallback, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Loading, Notice, Tabs, useIsMobile, useLoader, theme } from "../../lib/ui";
import {
  INDONESIA,
  bboxPoligon,
  bboxSebaran,
  bersinggungan,
  dalamIndonesia,
  jalurPoligon,
  jariJari,
  pasAspek,
  proyeksi,
} from "../../lib/petaSebaran";

// Lebar kanvas dalam satuan SVG; tampilannya mengikuti lebar kartu (width 100%).
const LEBAR = 1000;

/**
 * Peta sebaran lokasi yang dibagikan responden: provinsi diwarnai menurut jumlah lokasi
 * yang jatuh di dalamnya, titik menandai koordinat (dibulatkan ±1 km di server).
 *
 * Bawaannya diperbesar ke sebaran titiknya — survei satu provinsi tidak berguna dilihat
 * sebagai satu noktah di peta seluruh Indonesia.
 */
export function PetaSebaran({ titik, perProvinsi }) {
  const isMobile = useIsMobile();
  const peta = useLoader(useCallback(() => api.petaProvinsi(), []));
  const [luas, setLuas] = useState("sebaran");
  // Titik di luar Indonesia tidak ikut menentukan zoom (lihat dalamIndonesia), dan memang
  // tidak tergambar — jumlahnya disebutkan di bawah peta.
  const titikDalam = useMemo(() => titik.filter(dalamIndonesia), [titik]);
  const diLuar = titik.reduce((n, t) => (dalamIndonesia(t) ? n : n + t.n), 0);

  const bbox = useMemo(
    () =>
      luas === "sebaran" && titikDalam.length
        ? pasAspek(bboxSebaran(titikDalam), isMobile ? 0.85 : 0.55)
        : pasAspek(INDONESIA, isMobile ? 0.55 : 0.4),
    [luas, titikDalam, isMobile],
  );
  const proj = useMemo(() => proyeksi(bbox, LEBAR), [bbox]);
  // Kotak pembatas tiap provinsi dihitung sekali per data, bukan setiap kali zoom berubah.
  const fitur = useMemo(
    () => (peta.data?.tersedia ? peta.data.fitur.map((f) => ({ ...f, kotak: bboxPoligon(f.poligon) })) : []),
    [peta.data],
  );
  const provinsi = useMemo(
    () =>
      fitur
        .filter((f) => bersinggungan(f.kotak, bbox))
        .map((f) => ({ kode: f.kode, nama: f.nama, d: jalurPoligon(f.poligon, proj.xy) })),
    [fitur, bbox, proj],
  );
  const maks = Math.max(1, ...perProvinsi.values());

  if (peta.loading) return <Loading>Memuat peta…</Loading>;
  if (peta.error) return <Notice>{peta.error}</Notice>;
  if (!peta.data?.tersedia)
    return (
      <Notice kind="info">
        Garis batas provinsi belum terpasang di server, jadi peta belum bisa digambar dan provinsi dari lokasi belum
        bisa ditentukan. Lokasi yang masuk tetap tersimpan dan akan terpetakan setelah data batasnya dipasang.
      </Notice>
    );

  // Titik ditandai dengan ukuran yang tetap terbaca di layar ponsel maupun lebar.
  const dasar = isMobile ? 9 : 5;

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
      <svg
        viewBox={`0 0 ${LEBAR} ${Math.round(proj.tinggi)}`}
        role="img"
        aria-label={`Peta sebaran ${titik.reduce((n, t) => n + t.n, 0)} lokasi responden`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: theme.surfaceAlt,
          borderRadius: 10,
        }}
      >
        {provinsi.map((p) => {
          const n = perProvinsi.get(p.kode) ?? 0;
          return (
            <path
              key={p.kode}
              d={p.d}
              fillRule="evenodd"
              fill={n ? theme.primary : theme.surface}
              fillOpacity={n ? 0.14 + 0.46 * (n / maks) : 1}
              stroke={theme.border}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${p.nama}: ${n} lokasi`}</title>
            </path>
          );
        })}
        {titikDalam.map((t) => {
          const [x, y] = proj.xy(t.lng, t.lat);
          return (
            <circle
              key={`${t.lat},${t.lng}`}
              cx={x}
              cy={y}
              r={jariJari(t.n, dasar)}
              fill={theme.red}
              fillOpacity={0.75}
              stroke={theme.surface}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${t.n} responden${t.provinsi ? ` • ${t.provinsi}` : ""}`}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Titik dibulatkan sekitar 1 km — satu titik bisa mewakili beberapa responden, dan besarnya mengikuti jumlah itu.
        {diLuar ? ` ${diLuar} lokasi di luar Indonesia tidak tergambar.` : ""} Batas wilayah: {peta.data.sumber} (
        {peta.data.lisensi}).
      </div>
    </div>
  );
}
