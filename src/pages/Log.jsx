import { useCallback, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  Notice,
  Loading,
  Empty,
  StatStrip,
  useLoader,
  useIsMobile,
  theme,
  fmtDate,
} from "../lib/ui";

// Log galat server. Sebelum halaman ini ada, isinya hanya terbaca lewat SSH lalu grep —
// dan satu galat pernah menunggu 17 hari sebelum ada yang melihatnya.
//
// Yang ditampilkan bukan hanya entrinya, tapi juga KEADAAN pencatatnya. Daftar kosong
// karena tidak ada galat dan daftar kosong karena pencatatnya mati tampak persis sama,
// dan yang kedua justru muncul saat paling dibutuhkan.

const TONE = { backend: "blue", worker: "purple", "ai-agent": "yellow" };

function ukuranTeks(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// Umur baris terakhir jauh lebih mudah dinilai daripada stempel waktunya: "17 hari lalu"
// langsung terbaca sebagai mencurigakan, "17 Sep 2026, 09.43" tidak.
function umur(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const menit = Math.floor(ms / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

const pre = {
  marginTop: 8,
  padding: 11,
  borderRadius: 8,
  background: "#0f172a",
  color: "#cbd5e1",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 11.5,
  maxHeight: 260,
  overflow: "auto",
};

export default function Log() {
  const isMobile = useIsMobile();
  const [sumber, setSumber] = useState("");
  const [cari, setCari] = useState("");
  const [kueri, setKueri] = useState({ sumber: "", cari: "" });
  const log = useLoader(useCallback(() => api.errorLog({ ...kueri, limit: 200 }), [kueri]));

  const d = log.data;
  const entri = d?.entri || [];
  const berkas = useMemo(() => (d?.berkas || []).filter((b) => b.ukuran > 0), [d]);
  const terakhir = useMemo(() => [...berkas.map((b) => b.terakhir)].sort().at(-1) || null, [berkas]);
  const menyaring = Boolean(kueri.sumber || kueri.cari);

  const terapkan = () => setKueri({ sumber, cari: cari.trim() });

  return (
    <div>
      <PageHeader
        title="Log Galat"
        subtitle="Galat yang tercatat di server — backend, worker, dan agen AI."
        actions={
          <Button onClick={log.reload} disabled={log.loading} icon="refresh">
            {log.loading ? "Memuat..." : "Muat ulang"}
          </Button>
        }
      />

      {log.error ? <Notice kind="error">{log.error}</Notice> : null}

      {d && !d.bisaDitulis ? (
        <div style={{ marginBottom: 16 }}>
          <Notice kind="error">
            Pencatat galat tidak bisa menulis ke <strong>{d.dir}</strong>. Selama itu, daftar kosong di bawah{" "}
            <strong>tidak berarti tidak ada galat</strong> — galat tetap terjadi, hanya tidak tercatat. Periksa izin
            folder log dan mount-nya pada container.
          </Notice>
        </div>
      ) : null}

      <Card title="Keadaan pencatat" style={{ marginBottom: 16 }}>
        <StatStrip
          items={[
            { label: "Entri ditampilkan", value: entri.length },
            { label: "Tulis terakhir", value: terakhir ? umur(terakhir) : "belum pernah" },
            { label: "Berkas aktif", value: berkas.length },
          ]}
        />
        {berkas.length ? (
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            {berkas.map((b) => (
              <div
                key={b.nama}
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  color: theme.textMuted,
                }}
              >
                <span style={{ fontFamily: "monospace", color: theme.text }}>{b.nama}</span>
                <span>
                  {ukuranTeks(b.ukuran)} • {fmtDate(b.terakhir)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 12 }}>
          Berkas ini hanya diisi saat ada galat, jadi diam itu wajar. Yang tidak wajar adalah diam sementara Anda tahu
          ada yang gagal — bila itu terjadi, pastikan dulu pencatatnya masih bisa menulis sebelum menyimpulkan
          aplikasinya sehat. Kegagalan kirim WhatsApp tidak masuk ke sini; itu tercatat per pesan di halaman Laporan.
        </div>
      </Card>

      <Card title="Entri">
        <div
          style={{
            display: "grid",
            // Di layar sempit ketiganya ditumpuk. Dipaksa sebaris, kolom "Cari" menyusut
            // jadi beberapa puluh piksel dan tak bisa dipakai sama sekali.
            gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,160px) minmax(0,1fr) auto",
            gap: 8,
            alignItems: "end",
            marginBottom: 14,
          }}
        >
          <Select
            label="Sumber"
            value={sumber}
            onChange={(e) => {
              setSumber(e.target.value);
              setKueri({ sumber: e.target.value, cari: cari.trim() });
            }}
            options={[{ value: "", label: "Semua" }, ...(d?.sumberTersedia || []).map((s) => ({ value: s, label: s }))]}
          />
          <Input
            label="Cari"
            placeholder="Kata dalam pesan, jejak, atau konteks"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && terapkan()}
          />
          <Button variant="secondary" onClick={terapkan} icon="search" title="Cari">
            Cari
          </Button>
        </div>

        {log.loading ? (
          <Loading />
        ) : entri.length ? (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {entri.map((e, i) => (
                <details
                  key={`${e.ts}-${i}`}
                  style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12, minWidth: 0 }}
                >
                  <summary style={{ cursor: "pointer", listStyle: "none", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge tone={TONE[e.source] || "default"}>{e.source}</Badge>
                      {/* Entri penutup gangguan adalah kabar baik di tengah daftar galat.
                          Tanpa penanda, ia terbaca sebagai masalah baru. */}
                      {e.context?.pulih ? <Badge tone="green">pulih</Badge> : null}
                      <span style={{ fontSize: 12, color: theme.textMuted }}>{fmtDate(e.ts)}</span>
                      <span style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: "monospace" }}>
                        {e.berkas}
                      </span>
                    </div>
                    <div
                      title={e.message}
                      style={{
                        fontSize: 13,
                        color: theme.text,
                        marginTop: 6,
                        minWidth: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {e.message}
                    </div>
                  </summary>
                  {e.context ? <pre style={pre}>{JSON.stringify(e.context, null, 2)}</pre> : null}
                  {e.stack ? <pre style={{ ...pre, color: "#94a3b8" }}>{e.stack}</pre> : null}
                </details>
              ))}
            </div>
            {d?.adaLagi ? (
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 12 }}>
                Hanya 200 entri terbaru yang ditampilkan. Persempit dengan pencarian untuk melihat yang lebih lama.
              </div>
            ) : null}
          </>
        ) : menyaring ? (
          <Empty icon="search" title="Tidak ada yang cocok" note="Ubah kata pencarian atau pilih sumber lain." />
        ) : (
          <Empty
            icon="alert"
            title="Tidak ada galat tercatat"
            note={
              d?.bisaDitulis
                ? "Folder log bisa ditulisi, jadi kosong di sini memang berarti tidak ada galat."
                : "Periksa dulu peringatan di atas — pencatatnya sedang tidak bisa menulis."
            }
          />
        )}
      </Card>
    </div>
  );
}
