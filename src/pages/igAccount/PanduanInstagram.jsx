import { Card, Icon, theme } from "../../lib/ui";

// Langkah menyambungkan DM Instagram lewat Facebook Login (akun IG terhubung ke Halaman
// Facebook) — cara yang tersedia untuk aplikasi Meta baru. Urutannya mengikuti docs/RENCANA-INSTAGRAM.md §3. Langkah App Review
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
      "Hubungkan akun Instagram ke Halaman Facebook",
      "Akun Instagram lembaga harus akun profesional (Bisnis atau Kreator) dan terhubung ke Halaman Facebook Populi Center: Meta Business Suite › Settings › Accounts › Instagram accounts. Di aplikasi Instagram: Pengaturan › Pesan dan balasan cerita › Kontrol pesan › Alat yang terhubung › aktifkan Izinkan akses ke pesan.",
      "https://business.facebook.com/settings",
    ],
    [
      "Buat aplikasi Meta dengan use case Instagram",
      "developers.facebook.com › My Apps › Create App › use case Manage messaging & content on Instagram › portofolio Populi Center. Sebaiknya aplikasi terpisah dari aplikasi WhatsApp. Lalu Use cases › Customize › API setup with Facebook login.",
      "https://developers.facebook.com/apps/",
    ],
    [
      "Tambahkan izin pesan",
      "Di Permissions and features, tambahkan instagram_basic, instagram_manage_messages, pages_manage_metadata, pages_show_list, dan business_management, serta fitur Business Asset User Profile Access (supaya nama dan username responden terbaca). Label di layar Meta bisa sedikit berbeda.",
      null,
    ],
    [
      "Ambil token Halaman, ID Halaman, dan App Secret",
      "Di API setup with Facebook login › Generate access tokens: hubungkan Halaman Populi Center dan akun IG-nya, lalu salin token Halaman ke kolom Access Token. Token yang tidak kedaluwarsa bisa dibuat lewat Business Settings › Users › System users › Generate token (pilih aplikasi ini dan aset Halaman). ID Halaman: Business Settings › Accounts › Pages. App Secret: App settings › Basic.",
      null,
    ],
    [
      "Simpan kredensial di sini dulu",
      "Isi Access Token, ID Halaman Facebook, App Secret, dan Webhook Verify Token (klik Buat acak bila perlu) › Simpan Instagram. Server baru bisa menjawab verifikasi webhook dari Meta setelah Verify Token dan App Secret tersimpan.",
      null,
    ],
    [
      "Pasang webhook & berlangganan field messages",
      "Configure webhooks › tempel Callback URL dan Verify Token yang SUDAH DISIMPAN › Verify and save › berlangganan field messages. Pastikan Halaman juga berlangganan aplikasi ini (Webhook subscription di daftar akun pada langkah token): tanpa itu DM tidak dikirim ke server.",
      null,
    ],
    [
      "Isi URL privasi",
      "App settings › Basic: Privacy Policy URL (halaman publik yang menyebut Instagram) dan Data deletion › callback URL. Deauthorize callback URL ada di pengaturan Facebook Login for Business. Pakai URL di kartu di samping.",
      null,
    ],
    [
      "Uji coba dengan akun berperan",
      "Sebelum App Review, hanya DM dari orang yang punya peran di aplikasi (admin, developer, tester) yang masuk. Tambahkan peran di App roles › Roles, lalu kirim DM berisi kata pemicu survei dari akun Instagram orang itu: survei harus berjalan sebagai chatbot, dan responnya muncul di halaman Respons dengan Saluran Instagram.",
      null,
    ],
    [
      "App Review, lalu mode Live",
      "Ajukan Advanced Access untuk instagram_manage_messages dan izin lain di langkah 3 (perlu Business Verification dan video layar alur survei). Setelah disetujui, ubah aplikasi ke mode Live. Tinjauan bisa makan beberapa hari sampai beberapa minggu, jadi mulai jauh sebelum survei.",
      null,
    ],
  ];
  return (
    <Card title="Panduan Menyambungkan Instagram" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Perlu disiapkan:</strong> akun Instagram profesional milik lembaga yang
        terhubung ke Halaman Facebook, akses ke portofolio bisnis Meta (Business Verification), dan kebijakan privasi
        publik. Ikuti langkah berurutan.
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
