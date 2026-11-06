import { Card, Icon, theme } from "../../lib/ui";

// Langkah menyambungkan DM Instagram lewat "Instagram API with Instagram Login" (tanpa
// Halaman Facebook). Urutannya mengikuti docs/RENCANA-INSTAGRAM.md §3. Langkah App Review
// sengaja ditulis tegas: tanpa itu webhook hanya mengirim DM dari akun yang berperan di
// aplikasi, sehingga uji coba tampak berhasil tapi DM responden sungguhan tidak pernah masuk.
export function PanduanInstagram() {
  const linkBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 9,
    fontSize: 11.5,
    fontWeight: 600,
    textDecoration: "none",
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    marginTop: 7,
  };
  const steps = [
    [
      "Siapkan akun Instagram profesional",
      "Akun milik lembaga harus bertipe Bisnis atau Kreator (Pengaturan › Jenis akun dan alat). Akun pribadi tidak bisa memakai API pesan.",
      null,
    ],
    [
      "Izinkan akses ke pesan",
      "Di aplikasi Instagram: Pengaturan › Pesan dan balasan cerita › Kontrol pesan › Alat yang terhubung › aktifkan Izinkan akses ke pesan. Periksa lagi setelah menghubungkan ulang akun, karena pengaturan ini bisa mati sendiri.",
      null,
    ],
    [
      "Buat aplikasi Meta tipe Business dengan produk Instagram",
      "developers.facebook.com › My Apps › Create App › tipe Business, hubungkan ke portofolio bisnis lembaga. Sebaiknya aplikasi terpisah dari aplikasi WhatsApp, supaya urusan App Review Instagram tidak ikut menyeret WhatsApp. Tambahkan produk Instagram › API setup with Instagram login.",
      "https://developers.facebook.com/apps/",
    ],
    [
      "Hubungkan akun & buat Access Token",
      "Di API setup with Instagram login › Generate access tokens › Add account › masuk dengan akun Instagram tadi › Generate token. Salin token ke kolom Access Token, dan ID akun yang tertera ke kolom ID Akun Instagram. Token berlaku 60 hari; server memperpanjangnya otomatis selama masih berlaku.",
      null,
    ],
    [
      "Salin App Secret",
      "Salin Instagram app secret yang tertera di halaman API setup with Instagram login ke kolom App Secret. Dipakai untuk memeriksa tanda tangan webhook dan permintaan penghapusan data dari Meta.",
      null,
    ],
    [
      "Simpan kredensial di sini dulu",
      "Isi Access Token, ID Akun Instagram, App Secret, dan Webhook Verify Token (klik Buat acak bila perlu) › Simpan Instagram. Server baru bisa menjawab verifikasi webhook dari Meta setelah Verify Token dan App Secret tersimpan.",
      null,
    ],
    [
      "Pasang webhook & berlangganan field messages",
      "Configure webhooks › tempel Callback URL dan Verify Token yang SUDAH DISIMPAN › Verify and save › berlangganan field messages. Lalu nyalakan Webhook subscription untuk akun Instagram Anda di daftar akun: menyimpan callback saja belum membuat DM akun itu terkirim.",
      null,
    ],
    [
      "Isi URL privasi",
      "Di pengaturan Business login: isi Deauthorize callback URL dan Data deletion request URL dengan URL di kartu di samping, serta URL kebijakan privasi publik yang menjelaskan cara meminta penghapusan data.",
      null,
    ],
    [
      "App Review, lalu mode Live",
      "Ajukan Advanced Access untuk izin instagram_business_manage_messages (perlu Business Verification dan video layar alur survei). Sebelum disetujui, hanya DM dari akun yang berperan di aplikasi yang masuk. Setelah disetujui, ubah aplikasi ke mode Live. Tinjauan bisa makan beberapa hari sampai beberapa minggu, jadi mulai jauh sebelum survei.",
      null,
    ],
    [
      "Uji coba",
      "Dari akun Instagram LAIN, kirim DM berisi kata pemicu survei: survei harus berjalan sebagai chatbot dan responnya muncul di halaman Respons dengan Saluran Instagram.",
      null,
    ],
  ];
  return (
    <Card title="Panduan Menyambungkan Instagram" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Perlu disiapkan:</strong> akun Instagram profesional milik lembaga, akses
        ke portofolio bisnis Meta (Business Verification), dan kebijakan privasi publik. Ikuti langkah berurutan.
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{s[0]}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.55 }}>{s[1]}</div>
              {s[2] ? (
                <a href={s[2]} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                  <Icon name="link" size={13} />
                  Buka halaman
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: theme.yellow,
          background: theme.yellowSoft,
          borderRadius: 8,
          padding: "9px 12px",
          lineHeight: 1.5,
        }}
      >
        ⚠ Webhook butuh server yang bisa diakses publik (HTTPS). Untuk uji di komputer sendiri, pakai tunnel seperti{" "}
        <strong>ngrok</strong> dan masukkan URL tunnel itu di Meta.
      </div>
      <a
        href="https://developers.facebook.com/docs/instagram-platform"
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...linkBtn, marginTop: 12, padding: "8px 12px", fontSize: 12.5 }}
      >
        <Icon name="link" size={13} />
        Dokumentasi resmi Meta
      </a>
    </Card>
  );
}
