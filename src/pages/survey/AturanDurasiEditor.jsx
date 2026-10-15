import { Button, Input, theme } from "../../lib/ui";
import { ATURAN_DURASI_BAWAAN, MAKS_BATAS_DURASI, MAKS_LABEL_DURASI, galatAturanDurasi } from "../../lib/exportSurvey";

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
// Number("") bernilai 0, jadi kolom kosong harus ditolak lebih dulu — kalau tidak, labelnya
// berbunyi "Lebih dari  menit".
const fmtMenit = (n) => (n !== "" && n != null && Number.isFinite(Number(n)) ? String(n).replace(".", ",") : "…");

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
            <Input
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              aria-label={`Batas ${i + 1}: sampai berapa menit`}
              value={b.sampai}
              onChange={(e) =>
                ubah((x) => {
                  // Disimpan sebagai angka; kolom yang dikosongkan ditolak validasi.
                  x.batas[i].sampai = e.target.value === "" ? "" : Number(e.target.value);
                })
              }
            />
            <Input
              aria-label={`Label untuk durasi sampai ${fmtMenit(b.sampai)} menit`}
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
        label={`Lebih dari ${fmtMenit(terakhir?.sampai)} menit`}
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
              const n = Number(terakhir?.sampai);
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
