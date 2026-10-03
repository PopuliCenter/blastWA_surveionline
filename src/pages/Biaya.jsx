import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirm";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Notice,
  Empty,
  Loading,
  useLoader,
  useIsMobile,
  theme,
} from "../lib/ui";

const hariIni = () => new Date().toISOString().slice(0, 10);
const awalBulan = () => `${new Date().toISOString().slice(0, 7)}-01`;

// Mata uang ditentukan kartu tarif, bukan ditebak dari lokal browser: invoice harus
// memakai satuan yang sama dengan tagihan Meta yang direkonsiliasi.
function uang(n, mataUang) {
  const d = mataUang === "IDR" ? 0 : 2;
  const s = Number(n || 0).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${mataUang === "IDR" ? "Rp " : `${mataUang} `}${s}`;
}

// Tarif SATUAN selalu 2 desimal, apa pun mata uangnya. Tarif Meta ditulis 586,33 per pesan;
// membulatkannya jadi "Rp 586" membuat 1.200 × Rp 586 tidak sama dengan subtotal yang
// tertera — pertanyaan pertama yang akan diajukan klien saat memeriksa invoice.
function uangTarif(n, mataUang) {
  const s = Number(n || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${mataUang === "IDR" ? "Rp " : `${mataUang} `}${s}`;
}

// Periode & tanggal berlaku adalah tanggal murni; fmtDate menyertakan jam, yang di sini
// hanya memperlihatkan pergeseran zona waktu dan tidak punya arti.
function tanggalSaja(v) {
  const d = new Date(typeof v === "string" && v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const TARIF_BARU = {
  berlakuSejak: hariIni(),
  mataUang: "IDR",
  marketing: "",
  utility: "",
  authentication: "",
  service: "",
  gratisServicePerBulan: 1000,
  pajakPersen: 0,
  catatan: "",
};

export default function Biaya() {
  const isMobile = useIsMobile();
  const tarif = useLoader(useCallback(() => api.listTarif(), []));
  const surveiList = useLoader(useCallback(() => api.biayaSurvei(), []));

  const [dari, setDari] = useState(awalBulan);
  const [sampai, setSampai] = useState(hariIni);
  const [margin, setMargin] = useState("0");
  const [hasil, setHasil] = useState(null);
  const [err, setErr] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const [tarifModal, setTarifModal] = useState(null);
  const [simpanErr, setSimpanErr] = useState("");

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [klien, setKlien] = useState({ nama: "", alamat: "", nomor: "", catatan: "" });

  const hitung = async () => {
    setErr("");
    setSibuk(true);
    try {
      setHasil(await api.hitungBiaya({ dari, sampai, marginPersen: Number(margin) || 0 }));
    } catch (e) {
      setHasil(null);
      setErr(e.message);
    } finally {
      setSibuk(false);
    }
  };

  // Memilih survei hanya MENGISI tanggalnya. Biayanya tetap dihitung per periode — itu
  // satu-satunya cara yang bisa dicocokkan baris per baris dengan invoice Meta.
  const pakaiSurvei = (id) => {
    const s = (surveiList.data || []).find((x) => x.id === id);
    if (!s?.mulai) return;
    setDari(String(s.mulai).slice(0, 10));
    setSampai(String(s.selesai || s.mulai).slice(0, 10));
    setHasil(null);
  };

  const simpanTarif = async () => {
    setSimpanErr("");
    try {
      const d = tarifModal;
      const body = {
        berlakuSejak: d.berlakuSejak,
        mataUang: d.mataUang,
        marketing: Number(d.marketing),
        utility: Number(d.utility),
        authentication: Number(d.authentication),
        service: Number(d.service),
        gratisServicePerBulan: Number(d.gratisServicePerBulan),
        pajakPersen: Number(d.pajakPersen),
        catatan: d.catatan || undefined,
      };
      if (d.id) await api.updateTarif(d.id, body);
      else await api.createTarif(body);
      setTarifModal(null);
      await tarif.reload();
      setHasil(null);
    } catch (e) {
      setSimpanErr(e.message);
    }
  };

  const hapusTarif = async (t) => {
    if (
      !(await confirmDialog({
        title: "Hapus kartu tarif",
        message: `Hapus tarif yang berlaku sejak ${tanggalSaja(t.berlakuSejak)}? Invoice yang sudah dicetak tidak berubah, tetapi perhitungan ulang untuk periode itu tidak lagi punya tarif.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    await api.deleteTarif(t.id);
    await tarif.reload();
    setHasil(null);
  };

  const cetakInvoice = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      setErr("Jendela cetak diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.");
      return;
    }
    w.document.write(invoiceHtml({ hasil, klien, dari, sampai }));
    w.document.close();
    w.focus();
  };

  const tarifAktif = tarif.data || [];
  const mu = hasil?.mataUang || "IDR";

  const grid2 = { display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "1fr 1fr", gap: 14 };
  const barisTotal = (label, nilai, tebal) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderTop: `1px solid ${theme.border}`,
        fontWeight: tebal ? 700 : 500,
        fontSize: tebal ? 15 : 13.5,
        color: theme.text,
      }}
    >
      <span style={{ minWidth: 0 }}>{label}</span>
      <span style={{ whiteSpace: "nowrap" }}>{nilai}</span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Biaya & Invoice"
        subtitle="Estimasi biaya pesan WhatsApp dari data terkirim, dengan tarif yang Anda isi sendiri."
      />

      {err ? <Notice>{err}</Notice> : null}

      <Card title="Hitung biaya satu periode">
        <Notice kind="info">
          Biaya dihitung per <strong>periode tanggal</strong>, bukan per survei — hanya periode yang bisa dicocokkan
          baris per baris dengan invoice Meta. Memilih survei di bawah akan mengisikan tanggalnya saja.
        </Notice>

        <div style={grid2}>
          <Select
            label="Isi tanggal dari survei (opsional)"
            value=""
            onChange={(e) => pakaiSurvei(e.target.value)}
            options={[
              { value: "", label: "— pilih survei, tanggal terisi otomatis —" },
              ...(surveiList.data || [])
                .filter((s) => s.mulai)
                .map((s) => ({ value: s.id, label: `${s.title} (${s.responses} respons)` })),
            ]}
          />
          <Input
            label="Margin (%)"
            type="number"
            min="0"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            hint="Ditampilkan sebagai baris terpisah dari biaya Meta."
          />
          <Input label="Dari tanggal" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          <Input
            label="Sampai tanggal"
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            hint="Termasuk hari ini."
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Button onClick={hitung} disabled={sibuk || !dari || !sampai}>
            {sibuk ? "Menghitung..." : "Hitung Biaya"}
          </Button>
          {hasil ? (
            <Button variant="secondary" onClick={() => setInvoiceOpen(true)}>
              Buat Invoice
            </Button>
          ) : null}
        </div>
      </Card>

      {hasil ? (
        <Card title={`Rincian ${tanggalSaja(hasil.periode.dari)} – ${tanggalSaja(hasil.periode.sampai)}`}>
          {hasil.templateTakDikenal?.length ? (
            <Notice kind="warning">
              Template berikut tidak lagi ada di daftar template sehingga dihitung sebagai Marketing (tarif
              tertinggi), agar estimasi tidak lebih rendah dari tagihan Meta: {hasil.templateTakDikenal.join(", ")}.
            </Notice>
          ) : null}

          {hasil.baris.length ? (
            <div style={{ display: "grid", gap: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "minmax(0,1fr) auto" : "minmax(0,1fr) 90px 120px 130px",
                  gap: 10,
                  padding: "0 0 8px",
                  fontSize: 12.5,
                  color: theme.textMuted,
                  fontWeight: 700,
                }}
              >
                <span>Komponen</span>
                {isMobile ? null : <span style={{ textAlign: "right" }}>Jumlah</span>}
                {isMobile ? null : <span style={{ textAlign: "right" }}>Tarif</span>}
                <span style={{ textAlign: "right" }}>Subtotal</span>
              </div>
              {hasil.baris.map((b) => (
                <div
                  key={b.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "minmax(0,1fr) auto" : "minmax(0,1fr) 90px 120px 130px",
                    gap: 10,
                    padding: "9px 0",
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ minWidth: 0 }} title={b.label}>
                    {b.label}
                    {isMobile ? (
                      <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                        {b.jumlah.toLocaleString("id-ID")} × {uangTarif(b.tarif, mu)}
                      </div>
                    ) : null}
                  </span>
                  {isMobile ? null : (
                    <span style={{ textAlign: "right" }}>{b.jumlah.toLocaleString("id-ID")}</span>
                  )}
                  {isMobile ? null : <span style={{ textAlign: "right" }}>{uangTarif(b.tarif, mu)}</span>}
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{uang(b.subtotal, mu)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon="invoice"
              title="Tidak ada biaya pada periode ini"
              note="Seluruh pesan service masih di dalam jatah gratis, dan tidak ada pesan template terkirim."
            />
          )}

          <div style={{ marginTop: 14 }}>
            {barisTotal("Subtotal biaya Meta", uang(hasil.subtotal, mu))}
            {hasil.marginPersen > 0 ? barisTotal(`Margin ${hasil.marginPersen}%`, uang(hasil.margin, mu)) : null}
            {hasil.pajakPersen > 0 ? barisTotal(`Pajak ${hasil.pajakPersen}%`, uang(hasil.pajak, mu)) : null}
            {barisTotal("Total", uang(hasil.total, mu), true)}
          </div>

          <div
            style={{
              background: theme.surfaceAlt,
              borderRadius: 10,
              padding: 14,
              marginTop: 14,
              fontSize: 12.5,
              color: theme.textMuted,
            }}
          >
            <div>
              Pesan <strong>service</strong> terkirim {hasil.serviceTerkirim.toLocaleString("id-ID")} — {" "}
              {hasil.serviceGratis.toLocaleString("id-ID")} gratis, {hasil.serviceDitagih.toLocaleString("id-ID")}{" "}
              ditagih. Jatah gratis {hasil.tarif.gratisServicePerBulan.toLocaleString("id-ID")} per bulan kalender,
              tidak diakumulasi.
            </div>
            <div style={{ marginTop: 6 }}>
              Memakai kartu tarif yang berlaku sejak {tanggalSaja(hasil.tarif.berlakuSejak)}. Pesan yang gagal diantar
              tidak dihitung. Angka ini <strong>estimasi</strong> — yang mengikat tetap invoice resmi Meta.
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title="Kartu tarif"
        actions={<Button size="sm" onClick={() => setTarifModal({ ...TARIF_BARU })}>Tambah Tarif</Button>}
      >
        <Notice kind="info">
          Tarif diisi manual dan <strong>berversi</strong>. Saat Meta mengubah harga, tambahkan set baru dengan
          tanggal berlakunya — jangan menimpa yang lama, supaya invoice yang sudah diajukan tetap bisa dihitung ulang
          dengan angka yang sama.
        </Notice>

        {tarif.loading ? (
          <Loading />
        ) : tarifAktif.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {tarifAktif.map((t) => (
              <div key={t.id} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong style={{ fontSize: 13.5 }}>Berlaku sejak {tanggalSaja(t.berlakuSejak)}</strong>
                  <Badge>{t.mataUang}</Badge>
                  {t.pajakPersen > 0 ? <Badge tone="yellow">Pajak {t.pajakPersen}%</Badge> : null}
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>
                  Marketing {uangTarif(t.marketing, t.mataUang)} · Utility {uangTarif(t.utility, t.mataUang)} ·{" "}
                  Authentication {uangTarif(t.authentication, t.mataUang)} · Service{" "}
                  {uangTarif(t.service, t.mataUang)} ·{" "}
                  {t.gratisServicePerBulan.toLocaleString("id-ID")} service gratis/bulan
                </div>
                {t.catatan ? (
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{t.catatan}</div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="edit"
                    onClick={() => setTarifModal({ ...t, berlakuSejak: String(t.berlakuSejak).slice(0, 10) })}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon="trash" title="Hapus tarif" onClick={() => hapusTarif(t)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="invoice" title="Belum ada kartu tarif" note="Tambahkan tarif agar biaya bisa dihitung." />
        )}
      </Card>

      {tarifModal ? (
        <Modal
          title={tarifModal.id ? "Edit kartu tarif" : "Tambah kartu tarif"}
          onClose={() => setTarifModal(null)}
          dirty
          width={620}
        >
          {simpanErr ? <Notice>{simpanErr}</Notice> : null}
          <div style={grid2}>
            <Input
              label="Berlaku sejak"
              type="date"
              value={tarifModal.berlakuSejak}
              onChange={(e) => setTarifModal({ ...tarifModal, berlakuSejak: e.target.value })}
              hint="Dipakai untuk pesan yang dikirim pada/sesudah tanggal ini."
            />
            <Select
              label="Mata uang (samakan dengan invoice Meta)"
              value={tarifModal.mataUang}
              onChange={(e) => setTarifModal({ ...tarifModal, mataUang: e.target.value })}
              options={[
                { value: "IDR", label: "IDR" },
                { value: "USD", label: "USD" },
              ]}
            />
            <Input
              label="Marketing (per pesan)"
              type="number"
              step="any"
              value={tarifModal.marketing}
              onChange={(e) => setTarifModal({ ...tarifModal, marketing: e.target.value })}
            />
            <Input
              label="Utility (per pesan)"
              type="number"
              step="any"
              value={tarifModal.utility}
              onChange={(e) => setTarifModal({ ...tarifModal, utility: e.target.value })}
            />
            <Input
              label="Authentication (per pesan)"
              type="number"
              step="any"
              value={tarifModal.authentication}
              onChange={(e) => setTarifModal({ ...tarifModal, authentication: e.target.value })}
            />
            <Input
              label="Service (per pesan)"
              type="number"
              step="any"
              value={tarifModal.service}
              onChange={(e) => setTarifModal({ ...tarifModal, service: e.target.value })}
            />
            <Input
              label="Service gratis per bulan"
              type="number"
              value={tarifModal.gratisServicePerBulan}
              onChange={(e) => setTarifModal({ ...tarifModal, gratisServicePerBulan: e.target.value })}
              hint="Per nomor, tidak diakumulasi."
            />
            <Input
              label="Pajak (%)"
              type="number"
              step="any"
              value={tarifModal.pajakPersen}
              onChange={(e) => setTarifModal({ ...tarifModal, pajakPersen: e.target.value })}
              hint="Isi 0 bila pajak diurus terpisah."
            />
          </div>
          <Input
            label="Catatan (opsional)"
            value={tarifModal.catatan || ""}
            onChange={(e) => setTarifModal({ ...tarifModal, catatan: e.target.value })}
            hint="Mis. sumber angkanya, agar bisa ditelusuri nanti."
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Button onClick={simpanTarif}>Simpan</Button>
            <Button variant="secondary" onClick={() => setTarifModal(null)}>
              Batal
            </Button>
          </div>
        </Modal>
      ) : null}

      {invoiceOpen ? (
        <Modal
          title="Buat invoice"
          onClose={() => setInvoiceOpen(false)}
          dirty
          width={620}
        >
          <div style={grid2}>
            <Input
              label="Nama klien"
              value={klien.nama}
              onChange={(e) => setKlien({ ...klien, nama: e.target.value })}
            />
            <Input
              label="Nomor invoice"
              value={klien.nomor}
              onChange={(e) => setKlien({ ...klien, nomor: e.target.value })}
              hint="Mis. INV/2026/10/001"
            />
          </div>
          <Input
            label="Alamat klien (opsional)"
            value={klien.alamat}
            onChange={(e) => setKlien({ ...klien, alamat: e.target.value })}
          />
          <Input
            label="Catatan (opsional)"
            value={klien.catatan}
            onChange={(e) => setKlien({ ...klien, catatan: e.target.value })}
            hint="Mis. nama survei atau nomor kontrak."
          />
          <Notice kind="info">
            Invoice terbuka di jendela baru dan langsung bisa dicetak atau disimpan sebagai PDF lewat dialog cetak
            browser.
          </Notice>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Button onClick={cetakInvoice} disabled={!klien.nama.trim()}>
              Cetak / Simpan PDF
            </Button>
            <Button variant="secondary" onClick={() => setInvoiceOpen(false)}>
              Batal
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// Dokumen invoice dibuat sebagai HTML mandiri di jendela baru, bukan dengan CSS cetak di
// aplikasi: dialog cetak browser akan membawa seluruh tata letak dashboard kalau dicetak
// dari halaman ini, dan melawannya dengan @media print jauh lebih rapuh.
function invoiceHtml({ hasil, klien, dari, sampai }) {
  const mu = hasil.mataUang;
  const n = (v) =>
    `${mu === "IDR" ? "Rp " : `${mu} `}${Number(v || 0).toLocaleString("id-ID", {
      minimumFractionDigits: mu === "IDR" ? 0 : 2,
      maximumFractionDigits: mu === "IDR" ? 0 : 2,
    })}`;
  // Tarif satuan selalu 2 desimal — lihat catatan pada uangTarif di atas.
  const nt = (v) =>
    `${mu === "IDR" ? "Rp " : `${mu} `}${Number(v || 0).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tgl = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const baris = hasil.baris
    .map(
      (b) => `<tr>
        <td>${esc(b.label)}</td>
        <td class="r">${b.jumlah.toLocaleString("id-ID")}</td>
        <td class="r">${nt(b.tarif)}</td>
        <td class="r">${n(b.subtotal)}</td>
      </tr>`,
    )
    .join("");

  const total = (label, nilai, tebal) =>
    `<tr class="${tebal ? "total" : ""}"><td colspan="3" class="r">${esc(label)}</td><td class="r">${n(nilai)}</td></tr>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Invoice ${esc(klien.nomor || "")} — ${esc(klien.nama)}</title>
<style>
  *{box-sizing:border-box} body{font:13px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;padding:40px;max-width:820px}
  h1{font-size:22px;margin:0 0 2px} .muted{color:#64748b}
  .head{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:26px}
  .box{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:0 0 18px}
  table{width:100%;border-collapse:collapse;margin:0 0 18px}
  th,td{padding:9px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  .r{text-align:right;white-space:nowrap}
  tr.total td{font-weight:700;font-size:15px;border-top:2px solid #0f172a;border-bottom:none}
  .note{font-size:11.5px;color:#64748b;margin-top:22px;border-top:1px solid #e2e8f0;padding-top:12px}
  @media print{body{padding:0}}
</style></head><body>
<div class="head">
  <div><h1>Invoice</h1><div class="muted">${esc(klien.nomor || "")}</div></div>
  <div class="muted" style="text-align:right">
    <div>Tanggal: ${esc(tgl)}</div>
    <div>Periode: ${esc(dari)} s.d. ${esc(sampai)}</div>
  </div>
</div>

<div class="box">
  <div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.05em">Ditagihkan kepada</div>
  <div style="font-weight:700;margin-top:4px">${esc(klien.nama)}</div>
  ${klien.alamat ? `<div class="muted">${esc(klien.alamat)}</div>` : ""}
</div>

<table>
  <thead><tr><th>Komponen</th><th class="r">Jumlah</th><th class="r">Tarif</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${baris || `<tr><td colspan="4" class="muted">Tidak ada komponen berbayar pada periode ini.</td></tr>`}
    ${total("Subtotal biaya Meta", hasil.subtotal)}
    ${hasil.marginPersen > 0 ? total(`Margin ${hasil.marginPersen}%`, hasil.margin) : ""}
    ${hasil.pajakPersen > 0 ? total(`Pajak ${hasil.pajakPersen}%`, hasil.pajak) : ""}
    ${total("Total", hasil.total, true)}
  </tbody>
</table>

${klien.catatan ? `<div class="box">${esc(klien.catatan)}</div>` : ""}

<div class="note">
  Pesan service terkirim ${hasil.serviceTerkirim.toLocaleString("id-ID")}, di antaranya
  ${hasil.serviceGratis.toLocaleString("id-ID")} berada dalam jatah gratis
  (${hasil.tarif.gratisServicePerBulan.toLocaleString("id-ID")} per bulan kalender, tidak diakumulasi) dan
  ${hasil.serviceDitagih.toLocaleString("id-ID")} ditagih. Tarif mengikuti kartu tarif yang berlaku sejak
  ${esc(new Date(hasil.tarif.berlakuSejak).toLocaleDateString("id-ID", { timeZone: "UTC" }))}. Pesan yang gagal diantar tidak dihitung.
  Angka pada dokumen ini dihitung dari catatan pengiriman sistem; dokumen yang mengikat untuk biaya pihak ketiga
  adalah invoice resmi Meta.
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}
