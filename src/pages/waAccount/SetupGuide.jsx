import { Card, Icon, theme } from "../../lib/ui";
import { CopyField } from "./CopyField";

// Panduan langkah-langkah koneksi Meta (tutorial)
export function SetupGuide({ metaCallback }) {
  const linkBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: "none",
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };
  const steps = [
    [
      "Buat akun & aplikasi di Meta for Developers",
      "Buka developers.facebook.com → Login → My Apps → Create App → pilih tipe Business. Beri nama aplikasi.",
      "https://developers.facebook.com/apps/",
    ],
    [
      "Tambahkan produk WhatsApp",
      "Di dashboard aplikasi → menu Add Product → pilih WhatsApp → Set up. Ikuti wizard hingga muncul halaman API Setup.",
      null,
    ],
    [
      "Salin Phone Number ID & daftarkan nomor",
      "Di WhatsApp → API Setup: pakai nomor uji yang disediakan, ATAU klik Add phone number untuk daftarkan nomor Anda (butuh OTP). Salin Phone Number ID-nya ke kolom di kartu Meta.",
      "https://business.facebook.com/wa/manage/",
    ],
    [
      "Buat Access Token permanen",
      "Meta Business Settings → Users → System Users → buat 1 system user (peran Admin) → Assign assets (pilih aplikasi & nomor WhatsApp) → Generate new token → centang izin whatsapp_business_messaging & whatsapp_business_management → salin token (pakai yang TANPA kedaluwarsa).",
      "https://business.facebook.com/settings",
    ],
    [
      "Salin App Secret",
      "Dashboard aplikasi → Settings → Basic → klik Show pada App Secret → salin ke kolom App Secret.",
      null,
    ],
    [
      "Pasang Webhook",
      "WhatsApp → Configuration → Webhook → Edit. Tempel Callback URL (di bawah), isi Verify Token bebas (samakan persis dengan kolom 'Webhook Verify Token' di form) → Verify and save → Subscribe ke field 'messages'.",
      null,
    ],
    [
      "Isi di aplikasi ini, Simpan, lalu Cek Koneksi",
      "Masukkan Access Token, Phone Number ID, App Secret, Verify Token ke kartu Meta di atas → klik Simpan Meta → klik Cek Koneksi untuk memastikan tersambung.",
      null,
    ],
  ];
  return (
    <Card title="Tutorial Menautkan ke Meta Cloud API" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Perlu disiapkan:</strong> akun Meta Business, 1 nomor HP baru yang bisa
        terima OTP (jangan nomor pribadi penting), dan metode pembayaran (untuk kirim ke nomor asli). Ikuti langkah
        berurutan di bawah.
      </div>
      <div style={{ display: "grid", gap: 13 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: theme.primary,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12.5,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{s[0]}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.55 }}>{s[1]}</div>
              {s[2] ? (
                <a
                  href={s[2]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...linkBtn, marginTop: 7, padding: "5px 10px", fontSize: 11.5 }}
                >
                  <Icon name="link" size={13} />
                  Buka halaman
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <CopyField label="Callback URL (tempel di langkah 6)" value={metaCallback} />
      </div>
      <div
        style={{
          fontSize: 12,
          color: theme.yellow,
          background: theme.yellowSoft,
          borderRadius: 8,
          padding: "9px 12px",
          lineHeight: 1.5,
        }}
      >
        ⚠ Webhook butuh server yang bisa diakses publik (HTTPS). Untuk uji di komputer sendiri, jalankan tunnel seperti{" "}
        <strong>ngrok</strong> lalu pakai URL ngrok sebagai Callback URL. Saat sudah online (di server/hosting), pakai
        domain aslinya.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtn}
        >
          <Icon name="link" size={13} />
          Dokumentasi resmi Meta
        </a>
      </div>
    </Card>
  );
}
