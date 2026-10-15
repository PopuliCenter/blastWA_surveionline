import { Button, Input, theme } from "../../lib/ui";
import {
  ATURAN_DURASI_BAWAAN,
  MAKS_BATAS_DURASI,
  MAKS_LABEL_DURASI,
  galatAturanDurasi,
  menitDari,
  formatLamaPengisian,
} from "../../lib/exportSurvey";

// Penyunting aturan kolom "Asesmen Durasi" — dipakai builder survei.
//
// `nilai` null berarti aturan BAWAAN. Bawaan ditampilkan sebagai titik awal, tapi baru
// tersimpan sebagai milik survei begitu ada yang diubah — survei yang tidak disentuh tetap
// mengikuti bawaan, termasuk bila bawaannya kelak diperbaiki.
//
// Setiap baris dibaca "sampai X menit → label", dan baris terakhir "selebihnya → label".
// Bentuk itu tidak mungkin berlubang: setiap durasi jatuh ke tepat satu label.

const salin = (a) => ({ batas: a.batas.map((b) => ({ ...b })), selebihnya: a.selebihnya });
const judulKolom = { fontSize: 12.5, fontWeight: 600, color: theme.text };
// Isi kolom batas: angka tersimpan ditulis dengan koma desimal ("2,5"); teks yang sedang
// diketik dibiarkan apa adanya, supaya "2," tidak langsung berubah jadi "2" di tengah ketikan.
//
// Batas yang dulu diisi "2:20" tersimpan sebagai 2,333… menit; ia ditampilkan kembali sebagai
// menit:detik, bukan pecahan panjang yang tak terbaca.
const isiKolom = (v) => {
  if (typeof v !== "number") return v ?? "";
  if (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9) return String(v).replace(".", ",");
  const detik = Math.round(v * 60);
  return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;
};
// Batas dibacakan dalam menit DAN detik: "2,5 menit" sering dikira 2 menit 50 detik.
const bacaMenit = (v) => {
  const n = menitDari(v);
  return Number.isFinite(n) && n > 0 ? formatLamaPengisian(n) : "…";
};

export function AturanDurasiEditor({ nilai, onChange }) {
  const a = nilai || ATURAN_DURASI_BAWAAN;
  const galat = nilai ? galatAturanDurasi(nilai) : null;
  const ubah = (fn) => {
    const b = salin(a);
    fn(b);
    onChange(b);
  };
  const terakhir = a.batas[a.batas.length - 1];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,96px) minmax(0,1fr) auto", gap: 8 }}>
        <div style={judulKolom}>Sampai (menit)</div>
        <div style={judulKolom}>Label</div>
        <div />
        {a.batas.map((b, i) => (
          <div key={i} style={{ display: "contents" }}>
            {/* Kolom TEKS, bukan type="number": kolom angka bawaan peramban tidak mengenali
                koma desimal di banyak lokal, dan "2,5" sampai sebagai isian kosong. Teksnya
                dibaca menitDari — koma maupun titik. */}
            <Input
              inputMode="decimal"
              aria-label={`Batas ${i + 1}: sampai berapa menit`}
              value={isiKolom(b.sampai)}
              onChange={(e) => ubah((x) => (x.batas[i].sampai = e.target.value))}
              hint={bacaMenit(b.sampai)}
            />
            <Input
              aria-label={`Label untuk durasi sampai ${bacaMenit(b.sampai)}`}
              value={b.label}
              maxLength={MAKS_LABEL_DURASI}
              onChange={(e) => ubah((x) => (x.batas[i].label = e.target.value))}
              placeholder="cth: Terlalu cepat"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              title="Hapus batas ini"
              disabled={a.batas.length <= 1}
              onClick={() => ubah((x) => x.batas.splice(i, 1))}
            />
          </div>
        ))}
      </div>

      <Input
        label={`Lebih dari ${bacaMenit(terakhir?.sampai)}`}
        value={a.selebihnya}
        maxLength={MAKS_LABEL_DURASI}
        onChange={(e) => ubah((x) => (x.selebihnya = e.target.value))}
        placeholder="cth: Aman"
        error={galat || undefined}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          disabled={a.batas.length >= MAKS_BATAS_DURASI}
          onClick={() =>
            ubah((x) => {
              // Batas baru disisipkan di akhir, sedikit di atas batas terakhir, dan label
              // "selebihnya" yang lama tetap di ujung — pemakai tinggal mengganti angkanya.
              const n = menitDari(terakhir?.sampai);
              x.batas.push({ sampai: Number.isFinite(n) ? n + 10 : 10, label: "" });
            })
          }
        >
          Tambah batas
        </Button>
        {nilai ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Kembalikan bawaan
          </Button>
        ) : null}
      </div>
      {!nilai ? (
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          Sedang memakai aturan bawaan.
        </div>
      ) : null}
    </div>
  );
}
