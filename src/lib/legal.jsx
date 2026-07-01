import { useState } from "react";
import { Modal, theme } from "./ui";

// Kebijakan Privasi & Syarat/Ketentuan untuk Populi WA. Ditampilkan lewat LegalModal.
// Catatan: sesuaikan detail perusahaan/kontak bila perlu.
const ORG = "Populi Center";
const CONTACT_EMAIL = "info@populicenter.org";
const WEBSITE = "www.populicenter.org";
const UPDATED = "1 Juli 2026";

const H = ({ children }) => <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, margin: "16px 0 6px" }}>{children}</div>;
const P = ({ children }) => <p style={{ margin: "0 0 8px", fontSize: 13, color: theme.textMuted, lineHeight: 1.65 }}>{children}</p>;
const LI = ({ children }) => <li style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6, marginBottom: 4 }}>{children}</li>;

function Privacy() {
  return (
    <div>
      <P>Diperbarui {UPDATED}. Kebijakan ini menjelaskan bagaimana {ORG} ("kami") mengumpulkan dan menggunakan data dalam platform survei & broadcast WhatsApp ini.</P>
      <H>Data yang kami kumpulkan</H>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <LI><strong>Kontak:</strong> nomor WhatsApp, nama, dan atribut yang Anda impor (mis. kota, demografi).</LI>
        <LI><strong>Pesan & jawaban survei:</strong> isi percakapan dan tanggapan responden.</LI>
        <LI><strong>Akun pengguna:</strong> nama, username/email, peran (untuk admin platform).</LI>
        <LI><strong>Kredensial vendor</strong> (Meta/Qontak/dll.) — disimpan <strong>terenkripsi</strong>.</LI>
      </ul>
      <H>Tujuan penggunaan</H>
      <P>Data dipakai untuk menjalankan survei, mengirim pesan yang Anda minta, menampilkan laporan, dan menjaga keamanan layanan. Kami <strong>tidak menjual</strong> data Anda ke pihak ketiga.</P>
      <H>Persetujuan & opt-out</H>
      <P>Pesan hanya dikirim ke kontak yang memberi persetujuan (opt-in). Responden dapat membalas <strong>BERHENTI</strong> kapan saja untuk berhenti menerima pesan; nomor tersebut otomatis dikecualikan dari pengiriman berikutnya.</P>
      <H>Penyimpanan & keamanan</H>
      <P>Data disimpan di basis data terlindungi; kredensial vendor dienkripsi (AES-256-GCM), kata sandi di-hash. Akses dibatasi lewat autentikasi. Kami menyimpan data selama diperlukan untuk operasional atau sesuai kewajiban hukum.</P>
      <H>Pihak ketiga</H>
      <P>Pengiriman WhatsApp diproses melalui penyedia resmi (Meta WhatsApp Cloud API / BSP) sesuai kebijakan mereka. Penggunaan WhatsApp tunduk pada kebijakan Meta.</P>
      <H>Hak Anda</H>
      <P>Anda dapat meminta akses, koreksi, atau penghapusan data kontak Anda dengan menghubungi kami di {CONTACT_EMAIL}.</P>
      <H>Kontak</H>
      <P>{ORG} — {CONTACT_EMAIL} — {WEBSITE}</P>
    </div>
  );
}

function Terms() {
  return (
    <div>
      <P>Diperbarui {UPDATED}. Dengan menggunakan platform ini, Anda menyetujui ketentuan berikut.</P>
      <H>Penggunaan yang sah</H>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <LI>Gunakan platform hanya untuk tujuan sah dan sesuai hukum yang berlaku.</LI>
        <LI>Kirim pesan <strong>hanya ke kontak yang telah memberi izin (opt-in)</strong>. Dilarang spam atau mengirim ke daftar yang dibeli/di-scrape.</LI>
        <LI>Patuhi <strong>Kebijakan Bisnis & Perpesanan WhatsApp/Meta</strong>. Pelanggaran dapat menyebabkan nomor diblokir oleh WhatsApp.</LI>
        <LI>Jangan mengirim konten melanggar hukum, menyesatkan, atau melanggar hak orang lain.</LI>
      </ul>
      <H>Akun</H>
      <P>Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan seluruh aktivitas di dalamnya. Segera beri tahu kami bila ada akses tidak sah.</P>
      <H>Ketersediaan layanan</H>
      <P>Layanan disediakan "sebagaimana adanya". Kami berupaya menjaga ketersediaan namun tidak menjamin bebas gangguan. Jalur "WhatsApp Langsung" (non-resmi) memiliki risiko pemblokiran nomor dan digunakan atas tanggung jawab Anda.</P>
      <H>Batasan tanggung jawab</H>
      <P>Sepanjang diizinkan hukum, {ORG} tidak bertanggung jawab atas kerugian tidak langsung akibat penggunaan platform, termasuk pemblokiran nomor oleh WhatsApp akibat pelanggaran kebijakan oleh pengguna.</P>
      <H>Kontak</H>
      <P>{ORG} — {CONTACT_EMAIL} — {WEBSITE}</P>
    </div>
  );
}

export function LegalModal({ initialTab = "privacy", onClose }) {
  const [tab, setTab] = useState(initialTab);
  const tabBtn = (on) => ({ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: on ? theme.primary : theme.surfaceAlt, color: on ? "#fff" : theme.textMuted });
  return (
    <Modal title="Ketentuan Layanan" onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab("privacy")} style={tabBtn(tab === "privacy")}>Kebijakan Privasi</button>
        <button onClick={() => setTab("terms")} style={tabBtn(tab === "terms")}>Syarat &amp; Ketentuan</button>
      </div>
      <div style={{ maxHeight: "60vh", overflowY: "auto" }}>{tab === "privacy" ? <Privacy /> : <Terms />}</div>
    </Modal>
  );
}
