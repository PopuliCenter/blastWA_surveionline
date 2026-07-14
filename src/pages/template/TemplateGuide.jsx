import { Card, Badge, theme } from "../../lib/ui";
import { GuideSteps, GuideNote, GuideHeading, GuideLink } from "../../lib/guide";

// Panduan template: kenapa perlu, alur pengajuan ke Meta, kategori, variabel, & sebab penolakan.
export function TemplateGuide() {
  const steps = [
    [
      "Susun template",
      'Klik "Pakai Contoh" (paling cepat — sudah ada contoh Blast Survei, Rilis ke Media, Undangan Acara) atau "Buat Template" dari nol.',
    ],
    [
      "Isi kolomnya",
      "Nama (huruf kecil & garis bawah, mis. undangan_survei) · Kategori · Bahasa · Header (opsional) · Isi pesan · Footer · Tombol.",
    ],
    [
      "Pakai variabel {{1}}, {{2}} untuk personalisasi",
      'Tulis mis. "Halo {{1}}, kami dari {{2}}…". WAJIB isi juga "Contoh nilai" untuk tiap variabel — Meta memakainya saat review, dan template ditolak bila contohnya kosong.',
    ],
    [
      "Ajukan ke Meta",
      'Simpan → klik "Ajukan ke Meta" pada kartu template. Statusnya berubah jadi "Menunggu Meta". Review biasanya menit–jam.',
    ],
    [
      "Sinkron status",
      'Setelah ditunggu, klik "Sinkron status Meta" (tombol atas). Status akan berubah jadi "Disetujui" atau "Ditolak" mengikuti status ASLI di Meta.',
    ],
    [
      "Pakai di Broadcast",
      'Template berstatus "Disetujui" baru bisa dipilih saat membuat Blast. Yang masih Draf/Menunggu tidak akan terkirim.',
    ],
  ];

  const cats = [
    { badge: <Badge tone="purple">MARKETING</Badge>, t: "Promosi, undangan, ajakan survei. Tarif paling mahal." },
    { badge: <Badge tone="blue">UTILITY</Badge>, t: "Notifikasi/transaksi (status pesanan, pengingat). Lebih murah." },
    { badge: <Badge tone="default">AUTHENTICATION</Badge>, t: "Khusus kode OTP." },
  ];

  const statuses = [
    { badge: <Badge tone="default">Draf</Badge>, t: "Baru dibuat, belum diajukan. Belum bisa dipakai blast." },
    { badge: <Badge tone="yellow">Menunggu Meta</Badge>, t: "Sudah diajukan, sedang direview Meta." },
    { badge: <Badge tone="green">Disetujui</Badge>, t: "Siap dipakai di Broadcast." },
    { badge: <Badge tone="red">Ditolak</Badge>, t: "Perbaiki isinya lalu ajukan ulang (atau Duplikat & revisi)." },
  ];

  return (
    <Card title="Panduan Template Pesan" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Kenapa perlu template?</strong> WhatsApp melarang mengirim pesan pertama
        secara bebas. Untuk <em>memulai</em> percakapan (mis. blast survei ke kontak yang belum pernah membalas), Anda
        wajib memakai template yang sudah <strong>disetujui Meta</strong>. Setelah responden membalas, terbuka jendela{" "}
        <strong>24 jam</strong> untuk berbalas pesan bebas tanpa template.
      </div>

      <GuideHeading>Langkah pembuatan</GuideHeading>
      <GuideSteps steps={steps} />

      <GuideHeading>Kategori (memengaruhi biaya &amp; aturan)</GuideHeading>
      <div style={{ display: "grid", gap: 8 }}>
        {cats.map((c) => (
          <div key={c.t} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5 }}>
            <span style={{ flexShrink: 0, minWidth: 118 }}>{c.badge}</span>
            <span style={{ color: theme.textMuted }}>{c.t}</span>
          </div>
        ))}
      </div>
      <GuideNote tone="warn">
        <strong>Pilih kategori dengan jujur.</strong> Menaruh pesan promosi/ajakan survei di kategori{" "}
        <strong>UTILITY</strong> (agar lebih murah) adalah sebab penolakan paling umum — Meta akan menolak atau
        memindahkan kategorinya sendiri. Ajakan survei = <strong>MARKETING</strong>.
      </GuideNote>

      <GuideHeading>Arti status</GuideHeading>
      <div style={{ display: "grid", gap: 8 }}>
        {statuses.map((s) => (
          <div key={s.t} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5 }}>
            <span style={{ flexShrink: 0, minWidth: 118 }}>{s.badge}</span>
            <span style={{ color: theme.textMuted }}>{s.t}</span>
          </div>
        ))}
      </div>

      <GuideNote tone="danger">
        <strong>Header media (Gambar/Dokumen/Video) belum bisa diajukan otomatis dari sini.</strong> Untuk template
        berheader media, buat &amp; ajukan langsung di <strong>WhatsApp Manager → Message Templates</strong>. Dari
        aplikasi ini, pakai header <strong>Teks</strong> atau <strong>Tanpa header</strong>.
      </GuideNote>

      <GuideNote tone="info">
        <strong>Butuh WABA ID.</strong> Tombol &quot;Ajukan ke Meta&quot; &amp; &quot;Sinkron status Meta&quot; hanya
        jalan bila <strong>WhatsApp Business Account ID</strong> sudah diisi di menu <strong>Akun WhatsApp</strong>.
      </GuideNote>

      <GuideNote tone="warn">
        <strong>Sebab penolakan yang sering terjadi:</strong> contoh nilai variabel kosong · kategori tidak sesuai isi ·
        nama template mengandung spasi/huruf besar · isi pesan menyesatkan atau terlalu &quot;jualan&quot; · tautan
        mencurigakan. Bila ditolak, revisi isinya lalu <strong>Ajukan</strong> lagi.
      </GuideNote>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <GuideLink href="https://business.facebook.com/wa/manage/message-templates/">
          WhatsApp Manager — Message Templates
        </GuideLink>
        <GuideLink href="https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates">
          Aturan template Meta
        </GuideLink>
      </div>
    </Card>
  );
}
