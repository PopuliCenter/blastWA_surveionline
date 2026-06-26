import { Card, Badge, Icon, theme } from "./ui";

// Panduan top up / pembayaran biaya kirim WhatsApp (dipakai di Broadcast & Akun WhatsApp).
export function TopUpGuide() {
  const linkBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none", background: theme.primary, color: "#fff" };
  const metaSteps = [
    "Buka WhatsApp Manager / Meta Business Settings, lalu masuk ke Pengaturan Pembayaran (Billing & Payments).",
    "Klik “Add payment method” (Tambah metode pembayaran).",
    "Pilih Negara = Indonesia, mata uang = IDR (Rupiah), dan zona waktu.",
    "Pilih metode: kartu kredit/debit, atau PayPal/metode lain bila tersedia di wilayah Anda.",
    "Untuk prabayar: pilih “Add funds / Saldo” lalu isi nominal top up. Untuk pascabayar: atur ambang tagihan (billing threshold) — ditagih saat tercapai atau akhir bulan.",
    "Simpan. Nomor jadi aktif & pesan bisa terkirim. Invoice tersedia di Payment Settings.",
  ];
  return (
    <Card title="Cara Top Up & Pembayaran">
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Badge tone="blue">Jalur 1</Badge>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: theme.text }}>Langsung ke Meta (Cloud API)</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {metaSteps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 11 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: theme.primarySoft, color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <a href="https://business.facebook.com/billing_hub/accounts" target="_blank" rel="noopener noreferrer" style={linkBtn}><Icon name="link" size={15} />Buka Pengaturan Pembayaran Meta</a>
            <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}><Icon name="whatsapp" size={15} />WhatsApp Manager</a>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Badge tone="purple">Jalur 2</Badge>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: theme.text }}>Via Qontak (BSP)</span>
          </div>
          <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
            Bila pakai Qontak, top up <strong>tidak</strong> di Meta — saldo/pembayaran diisi lewat <strong>dashboard Qontak</strong> (paket langganan + saldo pesan). Hubungi tim Qontak untuk metode top up (transfer/VA) dan rincian tarifnya.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, background: theme.yellowSoft, borderRadius: 9, fontSize: 12.5, color: theme.yellow, display: "flex", gap: 8 }}>
        <Icon name="eye" size={16} />
        <span><strong>Prabayar vs Pascabayar:</strong> prabayar = isi saldo dulu (aman dari tagihan kejutan, cocok untuk kontrol anggaran survei). Pascabayar = kartu otomatis ditagih saat mencapai ambang. Ketersediaan opsi prabayar bisa berbeda per akun/wilayah.</span>
      </div>
    </Card>
  );
}
