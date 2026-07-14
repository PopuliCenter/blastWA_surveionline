import { Card, Badge, theme } from "../../lib/ui";
import { GuideSteps, GuideNote, GuideHeading, GuideLink } from "../../lib/guide";

// Panduan broadcast: alur Segmen → Template → Blast → Laporan, pilihan vendor, biaya, & anti-banned.
export function BroadcastGuide() {
  const steps = [
    [
      "Siapkan kontak",
      "Menu Kontak → tambah manual atau impor dari Excel/CSV. Kontak yang pernah membalas BERHENTI otomatis ditandai opt-out dan dikecualikan dari blast.",
    ],
    [
      "Buat Segmen",
      'Klik tombol "Segmen" → beri nama (mis. "Responden Jakarta") → tambahkan kontak ke dalamnya. Segmen = daftar penerima blast.',
    ],
    [
      "Siapkan Template yang sudah Disetujui",
      'Menu Template → buat & ajukan ke Meta → tunggu status "Disetujui". Tanpa ini, blast lewat Meta/Qontak tidak bisa dikirim.',
    ],
    [
      "Buat Blast",
      'Klik "Buat Blast" → pilih Survei (opsional), Segmen, Vendor, dan Template. Isi Parameter bila template punya variabel {{1}}, {{2}} (pisahkan dengan koma, urut).',
    ],
    [
      "Jadwalkan atau kirim langsung",
      'Kosongkan "Jadwal" untuk kirim sekarang, atau isi tanggal/jam untuk mengirim nanti (status jadi "scheduled").',
    ],
    [
      "Pantau hasilnya",
      'Di tab "Riwayat Blast" ada kartu berisi Sent / Delivered / Dibaca / Gagal. Klik "Laporan" untuk rincian per nomor.',
    ],
  ];

  const vendors = [
    {
      badge: <Badge tone="green">Meta Cloud API</Badge>,
      good: "Resmi & aman. Dukung template, Flow, laporan status lengkap.",
      note: "Wajib template disetujui. Berbayar per pesan.",
    },
    {
      badge: <Badge tone="blue">Qontak</Badge>,
      good: "Resmi lewat BSP. Dukung template.",
      note: "Wajib template disetujui.",
    },
    {
      badge: <Badge tone="red">WhatsApp Langsung (QR)</Badge>,
      good: "Tanpa template & tanpa approval — kirim teks langsung.",
      note: "⚠ Jalur TIDAK RESMI (Baileys). Melanggar ToS WhatsApp & berisiko nomor diblokir permanen. Pakai hanya untuk uji coba dengan nomor yang tidak penting.",
    },
  ];

  return (
    <Card title="Panduan Broadcast" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Alurnya:</strong> Kontak → <strong>Segmen</strong> (daftar penerima) +{" "}
        <strong>Template</strong> (isi pesan yang disetujui Meta) → <strong>Blast</strong> (kirim) →{" "}
        <strong>Laporan</strong> (pantau terkirim/dibaca/gagal). Bila blast ditautkan ke sebuah{" "}
        <strong>Survei</strong>, jawaban responden otomatis masuk ke survei tersebut.
      </div>

      <GuideHeading>Langkah</GuideHeading>
      <GuideSteps steps={steps} />

      <GuideHeading>Pilihan vendor</GuideHeading>
      <div style={{ display: "grid", gap: 10 }}>
        {vendors.map((v) => (
          <div key={v.note} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12 }}>
            <div style={{ marginBottom: 5 }}>{v.badge}</div>
            <div style={{ fontSize: 12.5, color: theme.text }}>{v.good}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{v.note}</div>
          </div>
        ))}
      </div>

      <GuideNote tone="danger">
        <strong>⚠ Blast survei mode Flow butuh template khusus.</strong> Kalau survei yang dipilih ber-mode{" "}
        <strong>Flow</strong>, template-nya harus punya <strong>tombol Flow</strong> yang terhubung ke Flow ID survei
        itu. Template biasa (tanpa tombol Flow) hanya akan mengirim teks — formulirnya tidak akan muncul.
      </GuideNote>

      <GuideNote tone="warn">
        <strong>Sesi 24 jam.</strong> Template dipakai untuk <em>memulai</em> percakapan. Begitu responden membalas,
        terbuka jendela <strong>24 jam</strong> untuk berbalas pesan bebas (termasuk pertanyaan survei mode Chat). Lewat
        24 jam, percakapan hanya bisa dibuka lagi lewat template.
      </GuideNote>

      <GuideNote tone="info">
        <strong>Simulasi Biaya.</strong> Tab <strong>Simulasi Biaya</strong> memperkirakan ongkos blast = jumlah kontak ×
        tarif kategori template (perkiraan Indonesia: Marketing ±Rp800, Utility ±Rp350, Authentication ±Rp300 per pesan).
        Cek dulu sebelum blast ke segmen besar.
      </GuideNote>

      <GuideNote tone="warn">
        <strong>Jaga kualitas nomor (anti-banned).</strong> Jangan blast ke nomor yang tidak pernah memberi izin —
        laporan &quot;spam&quot; dari penerima menurunkan <em>quality rating</em> nomor Anda dan bisa berujung
        pembatasan/blokir. Selalu sertakan cara berhenti (mis. footer &quot;Balas BERHENTI…&quot;), pakai segmen yang
        bersih, dan pantau status nomor di menu <strong>Akun WhatsApp</strong>.
      </GuideNote>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <GuideLink href="https://developers.facebook.com/docs/whatsapp/pricing">Tarif resmi WhatsApp</GuideLink>
      </div>
    </Card>
  );
}
