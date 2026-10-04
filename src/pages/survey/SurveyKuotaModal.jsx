import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { Modal, Button, Input, Select, Notice, Loading, Badge, useLoader, useIsMobile, theme } from "../../lib/ui";

// Kuota responden per survei: batas global dan batas per provinsi.
//
// Dibuka dari daftar survei, bukan dari dalam builder, karena kuota diubah SAAT lapangan
// berjalan — menaikkan jatah satu provinsi di tengah pengumpulan data tidak boleh menuntut
// pemakai membuka seluruh editor survei.

const sisa = (target, terisi) => (typeof target === "number" ? Math.max(0, target - terisi) : null);
const persen = (target, terisi) => (target > 0 ? Math.min(100, Math.round((terisi / target) * 100)) : 0);

function Bilah({ target, terisi }) {
  const p = persen(target, terisi);
  const penuh = typeof target === "number" && terisi >= target;
  return (
    <div style={{ background: theme.border, borderRadius: 999, height: 6, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${p}%`, height: "100%", background: penuh ? theme.red : theme.green }} />
    </div>
  );
}

export function SurveyKuotaModal({ survey, onClose }) {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.getKuota(survey.id), [survey.id]));
  const [global, setGlobal] = useState(null); // null = belum disentuh, pakai nilai server
  const [ubah, setUbah] = useState({}); // kodeProvinsi -> nilai input
  const [tambah, setTambah] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState("");

  const d = data;
  const nilaiGlobal = global !== null ? global : (d?.targetResponden ?? "");
  const kotor = global !== null || Object.keys(ubah).length > 0;

  // Hanya provinsi yang RELEVAN yang ditampilkan: sudah punya kuota, atau sudah ada
  // respondennya. Menampilkan 38 baris sekaligus membuat yang penting tenggelam.
  // Kuota provinsi dianggap dipakai bila sudah tersimpan ATAU sedang diisi di layar ini —
  // peringatannya harus muncul saat orang sedang mengetik angkanya, bukan setelah disimpan.
  const adaKuotaProvinsi =
    (d?.provinsi || []).some((p) => typeof p.target === "number") ||
    Object.values(ubah).some((v) => String(v).trim() !== "");

  const tampil = (d?.provinsi || []).filter(
    (p) => p.target !== null || p.terisi > 0 || Object.prototype.hasOwnProperty.call(ubah, p.kodeProvinsi),
  );
  const belumAda = (d?.provinsi || []).filter((p) => !tampil.some((t) => t.kodeProvinsi === p.kodeProvinsi));

  const simpan = async () => {
    setErr("");
    setSibuk(true);
    try {
      const provinsi = Object.entries(ubah).map(([kodeProvinsi, v]) => ({
        kodeProvinsi,
        target: String(v).trim() === "" ? null : Number(v),
      }));
      await api.saveKuota(survey.id, {
        ...(global !== null ? { targetResponden: String(global).trim() === "" ? null : Number(global) } : {}),
        ...(provinsi.length ? { provinsi } : {}),
      });
      setGlobal(null);
      setUbah({});
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Modal title={`Kuota responden — ${survey.title}`} onClose={onClose} dirty={kotor} width={700}>
      <Notice kind="info">
        Begitu kuota terpenuhi, survei berhenti menerima responden baru: pemicu dibalas sopan dan blast melewati sisa
        penerimanya <strong>tanpa mengirim pesan</strong> — di situlah biayanya tertahan. Yang dihitung hanya responden
        yang <strong>selesai</strong>, jadi formulir yang dikirim tapi tidak diisi tidak memakan jatah orang lain.
      </Notice>

      {error ? <Notice>{error}</Notice> : null}
      {err ? <Notice>{err}</Notice> : null}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <Input
              label="Target responden seluruh survei"
              type="number"
              min="0"
              value={nilaiGlobal}
              onChange={(e) => setGlobal(e.target.value)}
              hint="Kosongkan bila tanpa batas."
            />
            <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 8 }}>
              Terisi {d.terisiGlobal.toLocaleString("id-ID")}
              {typeof d.targetResponden === "number"
                ? ` dari ${d.targetResponden.toLocaleString("id-ID")} · sisa ${sisa(d.targetResponden, d.terisiGlobal).toLocaleString("id-ID")}`
                : " · tanpa batas"}
              {d.tanpaProvinsi > 0 ? ` · ${d.tanpaProvinsi.toLocaleString("id-ID")} tanpa data provinsi` : ""}
            </div>
            {d.penolakConsent > 0 ? (
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 4 }}>
                {d.penolakConsent.toLocaleString("id-ID")} responden berhenti di pertanyaan penyaring — biasanya
                persetujuan — dan <strong>tidak dihitung</strong>. Responsnya tercatat selesai karena survei memang
                berakhir di situ, tetapi tidak berisi data.
              </div>
            ) : null}
            {typeof d.targetResponden === "number" ? (
              <Bilah target={d.targetResponden} terisi={d.terisiGlobal} />
            ) : null}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 8px" }}>Kuota per provinsi</div>

          {adaKuotaProvinsi && d.sumberProvinsi === "pertanyaan" ? (
            <div style={{ fontSize: 12.5, color: theme.textMuted, margin: "0 0 10px" }}>
              Provinsi responden diambil dari pertanyaan{" "}
              <strong>&ldquo;{(d.teksPertanyaanProvinsi || "").slice(0, 60)}&rdquo;</strong> — jawabannya diterjemahkan
              ke kode provinsi resmi, jadi kuota di bawah ikut bertambah tanpa perlu mengubah instrumen yang sedang
              berjalan.
            </div>
          ) : null}

          {adaKuotaProvinsi && !d.sumberProvinsi ? (
            <Notice kind="warning">
              Survei ini <strong>belum punya sumber provinsi</strong> — tidak ada pertanyaan bertipe Wilayah, dan
              belum ada pertanyaan lain yang ditandai sebagai sumber provinsi. Akibatnya responden yang datang sendiri
              lewat kata pemicu tidak terhitung ke provinsi mana pun, kuota di bawah tidak akan pernah penuh, dan
              sebarannya meleset tanpa gejala. Tambahkan pertanyaan bertipe Wilayah di editor survei, atau jalankan{" "}
              <code>npm run backfill:provinsi -- --apply</code> yang akan menandai pertanyaan provinsi yang sudah ada.
            </Notice>
          ) : null}

          <div style={{ fontSize: 12.5, color: theme.textMuted, margin: "0 0 10px" }}>
            Daftar provinsi di sini memakai kode resmi Kepmendagri yang <strong>sama persis</strong> dengan pilihan pada
            pertanyaan tipe Wilayah, jadi nama dan kodenya tidak mungkin berbeda antara kuota dan jawaban. Nama provinsi
            dari berkas impor juga dicocokkan ke kode yang sama, termasuk bentuk panjangnya.
            {d.tanpaProvinsi > 0 ? (
              <>
                {" "}
                Saat ini <strong>{d.tanpaProvinsi.toLocaleString("id-ID")} responden selesai</strong> belum punya data
                provinsi dan tidak terhitung ke kuota mana pun.
              </>
            ) : null}
          </div>

          {tampil.length ? (
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {tampil.map((p) => {
                const nilai = Object.prototype.hasOwnProperty.call(ubah, p.kodeProvinsi)
                  ? ubah[p.kodeProvinsi]
                  : (p.target ?? "");
                const penuh = typeof p.target === "number" && p.terisi >= p.target;
                return (
                  <div
                    key={p.kodeProvinsi}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) 150px",
                      gap: 10,
                      alignItems: "start",
                      background: theme.surfaceAlt,
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.nama}</span>
                        {penuh ? <Badge tone="red">Penuh</Badge> : null}
                      </div>
                      <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 3 }}>
                        Terisi {p.terisi.toLocaleString("id-ID")}
                        {typeof p.target === "number"
                          ? ` dari ${p.target.toLocaleString("id-ID")} · sisa ${sisa(p.target, p.terisi).toLocaleString("id-ID")}`
                          : " · tanpa batas"}
                      </div>
                      {typeof p.target === "number" ? <Bilah target={p.target} terisi={p.terisi} /> : null}
                    </div>
                    <Input
                      label="Target"
                      type="number"
                      min="0"
                      value={nilai}
                      onChange={(e) => setUbah({ ...ubah, [p.kodeProvinsi]: e.target.value })}
                      hint="Kosong = tanpa batas"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>
              Belum ada provinsi yang dibatasi. Tambahkan di bawah.
            </div>
          )}

          <Select
            label="Tambah provinsi"
            value={tambah}
            onChange={(e) => {
              const k = e.target.value;
              if (k) setUbah({ ...ubah, [k]: "" });
              setTambah("");
            }}
            options={[
              { value: "", label: "— pilih provinsi —" },
              ...belumAda.map((p) => ({ value: p.kodeProvinsi, label: p.nama })),
            ]}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Button onClick={simpan} disabled={sibuk || !kotor}>
              {sibuk ? "Menyimpan..." : "Simpan Kuota"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
