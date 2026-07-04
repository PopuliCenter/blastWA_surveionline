import { useState } from "react";
import { Card, Notice, Select, Input, Button, theme } from "../../lib/ui";
import { TopUpGuide } from "../../lib/topup";
import { RATE_KEY, DEFAULT_RATES, CAT_LABEL, rupiah, loadRates } from "./constants";

export function CostSimulator({ segments }) {
  const [rates, setRates] = useState(loadRates);
  const [category, setCategory] = useState("marketing");
  const [count, setCount] = useState(1000);
  const [segId, setSegId] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const pickSeg = (id) => {
    setSegId(id);
    const s = segments.find((x) => x.id === id);
    if (s) setCount(s.contacts.length);
  };
  const setRate = (k, v) => setRates({ ...rates, [k]: Number(v) || 0 });
  const saveRates = () => {
    localStorage.setItem(RATE_KEY, JSON.stringify(rates));
    setSavedNote("Tarif tersimpan.");
    setTimeout(() => setSavedNote(""), 1500);
  };

  const rate = rates[category] || 0;
  const n = Number(count) || 0;
  const total = rate * n;
  // perbandingan semua kategori untuk jumlah yang sama
  const compare = Object.keys(CAT_LABEL).map((k) => ({ k, label: CAT_LABEL[k], rate: rates[k], total: rates[k] * n }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      <Card title="Simulasi Biaya Kirim">
        <Notice kind="success">{savedNote}</Notice>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Select
            label="Kategori pesan"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={Object.entries(CAT_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Ambil jumlah dari segmen (opsional)"
            value={segId}
            onChange={(e) => pickSeg(e.target.value)}
            options={[
              { value: "", label: "— isi manual —" },
              ...segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length})` })),
            ]}
          />
          <Input
            label="Jumlah penerima"
            type="number"
            value={count}
            onChange={(e) => {
              setSegId("");
              setCount(e.target.value);
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch", marginTop: 6 }}>
          <div style={{ flex: "1 1 220px", background: theme.primarySoft, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: theme.primary, fontWeight: 600 }}>Perkiraan total biaya</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: theme.primary, marginTop: 6 }}>{rupiah(total)}</div>
            <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 4 }}>
              {n.toLocaleString("id-ID")} pesan × {rupiah(rate)} / pesan
            </div>
          </div>
          <div style={{ flex: "1 1 220px", background: theme.surfaceAlt, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 8 }}>
              Bandingkan kategori (jumlah sama)
            </div>
            {compare.map((c) => (
              <div
                key={c.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  padding: "3px 0",
                  color: c.k === category ? theme.primary : theme.textMuted,
                  fontWeight: c.k === category ? 700 : 500,
                }}
              >
                <span style={{ textTransform: "capitalize" }}>{c.k}</span>
                <span>{rupiah(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Tarif per Pesan (bisa diedit)">
        <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>
          Angka di bawah adalah <strong>perkiraan</strong> tarif Indonesia. Sesuaikan dengan tarif terbaru di akun Meta
          Anda, lalu simpan.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {Object.keys(DEFAULT_RATES).map((k) => (
            <Input
              key={k}
              label={`${k[0].toUpperCase()}${k.slice(1)} (Rp/pesan)`}
              type="number"
              value={rates[k]}
              onChange={(e) => setRate(k, e.target.value)}
            />
          ))}
        </div>
        <Button onClick={saveRates}>Simpan Tarif</Button>
      </Card>

      <TopUpGuide />

      <Card title="Catatan Penting">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.textMuted, lineHeight: 1.7 }}>
          <li>
            Sejak <strong>Juli 2025</strong> Meta memakai harga <strong>per pesan</strong> (template terkirim), bukan
            per percakapan.
          </li>
          <li>
            Pesan <strong>balasan dari pengguna</strong> (service, dalam 24 jam) <strong>gratis</strong> — biaya hanya
            untuk template yang Anda kirim duluan.
          </li>
          <li>
            Tarif berbeda per <strong>kategori</strong> & per <strong>negara</strong>; kategori ditentukan saat membuat
            template.
          </li>
          <li>
            Pembayaran lewat <strong>akun Meta</strong>: bisa prabayar (top-up saldo) atau pascabayar (kartu
            kredit/credit line) — biaya WhatsApp ditagih di sana.
          </li>
        </ul>
      </Card>
    </div>
  );
}
