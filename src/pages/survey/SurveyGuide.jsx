import { Card, Icon, Badge, theme } from "../../lib/ui";

// Panduan pembuatan survei: perbedaan mode Chat vs WhatsApp Flow + langkah & jebakannya.
export function SurveyGuide() {
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
      title: "WhatsApp Flow — formulir 1 layar",
      good: [
        "Responden mengisi seperti Google Form di dalam WhatsApp",
        "Sekali kirim, jawaban rapi & tervalidasi",
        "Angka penyelesaian biasanya lebih tinggi",
      ],
      bad: [
        "HANYA untuk Meta Cloud API",
        "Tipe Gambar/foto TIDAK didukung (dilewati)",
        "Wajib dibuat & diterbitkan dulu di Meta",
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

  const Step = ({ i, s }) => (
    <div style={{ display: "flex", gap: 12 }}>
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
  );

  return (
    <Card title="Panduan Membuat Survei" style={{ marginBottom: 16 }}>
      {/* Perbandingan 2 mode */}
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

      {/* Langkah mode Chat */}
      <h4 style={{ margin: "20px 0 12px", fontSize: 14, color: theme.text }}>Langkah — mode Chat</h4>
      <div style={{ display: "grid", gap: 13 }}>
        {chatSteps.map((s, i) => (
          <Step key={i} i={i} s={s} />
        ))}
      </div>

      {/* Langkah mode Flow */}
      <h4 style={{ margin: "22px 0 12px", fontSize: 14, color: theme.text }}>Langkah — mode WhatsApp Flow</h4>
      <div style={{ display: "grid", gap: 13 }}>
        {flowSteps.map((s, i) => (
          <Step key={i} i={i} s={s} />
        ))}
      </div>

      {/* Jebakan utama Flow — sumber kehilangan data */}
      <div
        style={{
          marginTop: 16,
          fontSize: 12.5,
          color: theme.red,
          background: theme.redSoft,
          borderRadius: 8,
          padding: "11px 13px",
          lineHeight: 1.6,
        }}
      >
        <strong>⚠ PALING PENTING (mode Flow): setiap kali Anda menambah, menghapus, atau mengubah pertanyaan, Flow di
        Meta WAJIB di-publish ulang.</strong>{" "}
        Flow menyimpan nama field berdasarkan ID pertanyaan. Kalau pertanyaan berubah tapi Flow di Meta masih versi lama,
        jawaban responden <strong>masuk kosong</strong> padahal mereka merasa sudah mengisi. Caranya: Edit survei →{" "}
        <strong>Lihat / Salin Flow JSON</strong> → tempel ulang di Flow Builder Meta → <strong>Publish</strong>. Sistem
        akan mencatat peringatan &quot;Flow tidak sinkron&quot; di log bila ini terjadi.
      </div>

      {/* Catatan tambahan */}
      <div
        style={{
          marginTop: 10,
          fontSize: 12.5,
          color: theme.yellow,
          background: theme.yellowSoft,
          borderRadius: 8,
          padding: "11px 13px",
          lineHeight: 1.6,
        }}
      >
        <strong>Sesi 24 jam.</strong> Formulir Flow &amp; balasan bebas hanya bisa dikirim dalam 24 jam sejak pesan
        terakhir responden. Di luar itu, mulai percakapan lewat <strong>Template</strong> (menu Broadcast) yang sudah
        disetujui Meta.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <a
          href="https://developers.facebook.com/docs/whatsapp/flows"
          target="_blank"
          rel="noopener noreferrer"
          style={linkBtn}
        >
          <Icon name="link" size={13} />
          Dokumentasi WhatsApp Flows
        </a>
      </div>
    </Card>
  );
}
