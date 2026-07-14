import { Card, Badge, theme } from "../../lib/ui";
import { GuideSteps, GuideNote, GuideHeading, GuideLink } from "../../lib/guide";

// Panduan pembuatan survei: perbedaan mode Chat vs WhatsApp Flow + langkah & jebakannya.
export function SurveyGuide() {
  const modes = [
    {
      badge: <Badge tone="default">chat</Badge>,
      title: "Chat — tanya-jawab per pesan",
      good: [
        "Jalan di semua vendor (Meta, Qontak, Baileys)",
        "Tidak perlu setup tambahan di Meta",
        "Bisa pertanyaan Gambar/foto",
        "Ubah pertanyaan kapan saja, langsung berlaku",
      ],
      bad: ["Responden membalas satu per satu (lebih lama)", "Rawan salah ketik → sistem menanya ulang"],
    },
    {
      badge: <Badge tone="blue">flow</Badge>,
      title: "WhatsApp Flow — formulir multi-layar",
      good: [
        "Responden mengisi seperti Google Form di dalam WhatsApp",
        "Dibagi beberapa layar dengan tombol Lanjut (tidak menumpuk)",
        "Punya pemilih tanggal & kotak persetujuan (consent)",
        "Sekali kirim, jawaban rapi & tervalidasi",
      ],
      bad: [
        "HANYA untuk Meta Cloud API",
        "Tipe Gambar/foto TIDAK didukung (dilewati)",
        "Skip logic (percabangan) belum berlaku — semua soal tampil",
        "Setiap ubah pertanyaan → WAJIB publish ulang di Meta",
      ],
    },
  ];

  const chatSteps = [
    ["Buat Survei", "Klik Buat Survei → isi judul & deskripsi → biarkan Mode = Chat."],
    [
      "Tambah pertanyaan",
      "Pilih tipe: Teks bebas, Rating (skala angka), Angka, Pilihan ganda (1 jawaban), Pilihan ganda (boleh >1), Ya/Tidak, atau Gambar/foto. Rating bisa diberi label jangkar (mis. 1 = Sangat buruk, 10 = Sangat baik).",
    ],
    [
      "Atur pemicu (opsional)",
      'Aktifkan "Mulai otomatis" lalu isi kata kunci pemicu, mis. "isi survei". Begitu responden mengirim kata itu, bot langsung memulai survei.',
    ],
    ["Aktifkan & uji", 'Set status ke "active" → simpan → kirim kata pemicu dari WhatsApp Anda untuk mencoba.'],
  ];

  const flowSteps = [
    ["Buat survei mode Flow", "Buat Survei → isi pertanyaan → pilih Mode = WhatsApp Flow → klik Simpan."],
    [
      "Atur pembagian layar",
      'Isi "Pertanyaan per layar" (default 4) — Flow otomatis dipecah jadi beberapa layar bertombol Lanjut. Untuk kontrol penuh, buka pertanyaan → aktifkan "Mulai layar baru di sini" + beri "Judul seksi" (mis. Data Demografi). Penanda manual ini menimpa pembagian otomatis.',
    ],
    [
      "Simpan DULU, baru salin JSON",
      'Buka lagi survei (Edit) → klik "Lihat / Salin Flow JSON". Wajib simpan dulu supaya JSON memakai ID pertanyaan final — ini yang membuat jawaban bisa dipetakan balik dengan benar.',
    ],
    [
      "Buat Flow di Meta",
      "Buka WhatsApp Manager → Flows → Create Flow → pilih Endpoint: none → masuk ke Flow Builder → hapus JSON contoh → tempel JSON dari langkah 2 → Save → Publish.",
      "https://business.facebook.com/wa/manage/flows/",
    ],
    [
      "Salin Flow ID kembali ke sini",
      'Setelah Publish, salin Flow ID dari Meta → tempel ke kolom "Flow ID (dari Meta)" di survei → Simpan. Isi juga label tombol (mis. "Isi Survei").',
    ],
    ["Aktifkan & uji", 'Set status "active" → kirim pemicu / blast → responden akan menerima tombol pembuka formulir.'],
  ];

  return (
    <Card title="Panduan Membuat Survei" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        Ada <strong style={{ color: theme.text }}>2 mode survei</strong>. Pilih sesuai kebutuhan — keduanya memakai
        pertanyaan yang sama, hanya cara responden menjawabnya yang beda.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        {modes.map((m) => (
          <div key={m.title} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {m.badge}
              <strong style={{ fontSize: 13, color: theme.text }}>{m.title}</strong>
            </div>
            {m.good.map((g) => (
              <div key={g} style={{ display: "flex", gap: 7, fontSize: 12.5, color: theme.text, marginBottom: 4 }}>
                <span style={{ color: theme.green, flexShrink: 0 }}>✓</span>
                {g}
              </div>
            ))}
            {m.bad.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12.5, color: theme.textMuted, marginBottom: 4 }}>
                <span style={{ color: theme.red, flexShrink: 0 }}>✕</span>
                {b}
              </div>
            ))}
          </div>
        ))}
      </div>

      <GuideHeading>Langkah — mode Chat</GuideHeading>
      <GuideSteps steps={chatSteps} />

      <GuideHeading>Langkah — mode WhatsApp Flow</GuideHeading>
      <GuideSteps steps={flowSteps} />

      <GuideNote tone="danger">
        <strong>
          ⚠ PALING PENTING (mode Flow): setiap kali Anda menambah, menghapus, atau mengubah pertanyaan, Flow di Meta
          WAJIB di-publish ulang.
        </strong>{" "}
        Flow menyimpan nama field berdasarkan ID pertanyaan. Kalau pertanyaan berubah tapi Flow di Meta masih versi lama,
        jawaban responden <strong>masuk kosong</strong> padahal mereka merasa sudah mengisi. Caranya: Edit survei →{" "}
        <strong>Lihat / Salin Flow JSON</strong> → tempel ulang di Flow Builder Meta → <strong>Publish</strong>. Sistem
        mencatat peringatan &quot;Flow tidak sinkron&quot; di log bila ini terjadi.
      </GuideNote>

      <GuideNote tone="warn">
        <strong>Sesi 24 jam.</strong> Formulir Flow &amp; balasan bebas hanya bisa dikirim dalam 24 jam sejak pesan
        terakhir responden. Di luar itu, mulai percakapan lewat <strong>Template</strong> (menu Broadcast) yang sudah
        disetujui Meta.
      </GuideNote>

      <GuideNote tone="info">
        <strong>Batasan Flow yang perlu diketahui.</strong> <strong>Skip logic (percabangan)</strong> baru berlaku di
        mode <strong>Chat</strong> — di Flow semua pertanyaan tetap tampil. Tipe <strong>Gambar/foto</strong> tidak
        didukung Flow (otomatis dilewati). Untuk layar yang isinya <em>dihitung server</em> (mis. pertanyaan lanjutan
        yang dipersonalisasi), Meta mewajibkan <strong>Flow Endpoint</strong> terenkripsi — belum dipakai di sini.
      </GuideNote>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <GuideLink href="https://developers.facebook.com/docs/whatsapp/flows">Dokumentasi WhatsApp Flows</GuideLink>
      </div>
    </Card>
  );
}
