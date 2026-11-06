import { useCallback, useState } from "react";
import { api, apiBase } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  PasswordInput,
  Notice,
  Loading,
  useLoader,
  useIsMobile,
  theme,
  Icon,
} from "../lib/ui";
import { CopyField } from "./waAccount/CopyField";
import { PanduanInstagram } from "./igAccount/PanduanInstagram";

const FORM_KOSONG = { accessToken: "", igUserId: "", appSecret: "", verifyToken: "" };

// Verify Token hanya perlu sama persis di dua tempat (di sini dan di Meta), bukan diingat
// orang. Dibuat acak supaya tidak ada yang memakai kata mudah ditebak seperti "populi".
function tokenAcak() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export default function InstagramAccount() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listVendors(), []));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const vig = (data || []).find((v) => v.name === "instagram");
  const tersimpan = Boolean(vig?.hasStoredCredentials);
  // Dinonaktifkan: kredensial tetap tersimpan, tetapi server tidak memuatnya — jadi
  // `configured` ikut false dan tidak bisa dipakai untuk membedakan keadaan ini.
  const dinonaktifkan = Boolean(vig && !vig.active && tersimpan);
  // Token saja belum cukup: tanpa App Secret dan Verify Token setiap webhook ditolak, dan
  // tidak ada DM yang diproses walau halaman ini menyatakan terhubung.
  const kurangWebhook = Boolean(vig?.configured && vig?.active && vig?.webhookSiap === false);
  const terhubung = Boolean(vig?.configured && vig?.active && !kurangWebhook);

  const simpan = async () => {
    setErr("");
    setNote("");
    setSaving(true);
    try {
      // Kolom kosong tidak dikirim, sehingga server mempertahankan nilai lamanya: mengganti
      // Verify Token saja tidak boleh menghapus Access Token yang sudah tersimpan.
      const terisi = Object.fromEntries(Object.entries(form).filter(([, v]) => String(v).trim() !== ""));
      if (!Object.keys(terisi).length) {
        setErr("Belum ada kolom yang diisi.");
        return;
      }
      await api.setVendorCredentials("instagram", terisi);
      setNote("Kredensial Instagram tersimpan (terenkripsi).");
      // Token & secret dikosongkan supaya tidak terus terpampang di layar. Verify Token
      // dibiarkan: nilainya masih harus disalin ke Meta, dan server tidak menampilkannya ulang.
      setForm((f) => ({ ...FORM_KOSONG, verifyToken: f.verifyToken }));
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    setErr("");
    try {
      await api.setVendorActive("instagram", !vig.active);
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (loading)
    return (
      <div>
        <PageHeader title="Akun Instagram" />
        <Loading />
      </div>
    );

  const callback = `${apiBase}/webhook/instagram`;
  const urlHapusData = `${apiBase}/webhook/instagram/hapus-data`;
  const urlDeauthorize = `${apiBase}/webhook/instagram/deauthorize`;
  const placeholderTersimpan = tersimpan ? "tersimpan — isi untuk ganti" : "";

  return (
    <div>
      <PageHeader
        title="Akun Instagram"
        subtitle="Jalankan survei lewat DM Instagram (mode Chatbot). Kredensial disimpan terenkripsi di server."
        actions={[
          <Button key="g" variant="secondary" icon="eye" onClick={() => setGuideOpen((o) => !o)}>
            {guideOpen ? "Tutup Panduan" : "Panduan Koneksi"}
          </Button>,
          <Button key="r" variant="ghost" icon="refresh" onClick={reload}>
            Refresh
          </Button>,
        ]}
      />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      {vig?.decryptError ? (
        <Notice>
          <strong>⚠ Kredensial Instagram tak bisa dibaca.</strong> Kunci enkripsi server (
          <code>CREDENTIALS_ENC_KEY</code>) kemungkinan berubah. <strong>Input ulang</strong> semua kolom di bawah lalu
          Simpan.
        </Notice>
      ) : null}

      {/* Banner status koneksi */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 16px",
          borderRadius: 12,
          marginBottom: 16,
          background: terhubung ? theme.greenSoft : theme.yellowSoft,
          border: `1px solid ${terhubung ? theme.greenLine : theme.yellowLine}`,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: terhubung ? theme.green : theme.yellow,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={terhubung ? "check" : "instagram"} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: terhubung ? theme.green : theme.yellow }}>
            {terhubung
              ? "Instagram terhubung"
              : dinonaktifkan
                ? "Instagram dinonaktifkan"
                : kurangWebhook
                  ? "Instagram belum siap menerima DM"
                  : "Instagram belum terhubung"}
          </div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>
            {terhubung
              ? "DM yang berisi kata pemicu survei akan dijawab otomatis sebagai chatbot."
              : dinonaktifkan
                ? "Kredensial tetap tersimpan. Tekan Aktifkan untuk menyalakan kembali."
                : kurangWebhook
                  ? "App Secret atau Verify Token belum diisi — webhook dari Meta akan ditolak dan DM tidak diproses."
                  : "Isi kredensial di bawah. Klik “Panduan Koneksi” untuk langkah di sisi Meta."}
          </div>
        </div>
      </div>

      {guideOpen ? <PanduanInstagram /> : null}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card
          title="Kredensial"
          actions={
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {vig?.decryptError ? <Badge tone="red">perlu input ulang</Badge> : null}
              {vig ? (
                <>
                  {dinonaktifkan ? (
                    <Badge tone="default">tersimpan</Badge>
                  ) : (
                    <Badge tone={vig.configured && !kurangWebhook ? "green" : "yellow"}>
                      {vig.configured && !kurangWebhook ? "terkonfigurasi" : "belum lengkap"}
                    </Badge>
                  )}
                  {vig.active ? <Badge tone="green">aktif</Badge> : <Badge tone="default">nonaktif</Badge>}
                </>
              ) : (
                <Badge tone="default">belum diatur</Badge>
              )}
            </div>
          }
        >
          <PasswordInput
            noAutofill
            label="Access Token"
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            placeholder={placeholderTersimpan || "IGAA..."}
            hint="API setup with Instagram login › Generate access tokens. Berlaku 60 hari, diperpanjang otomatis oleh server."
          />
          <Input
            label="ID Akun Instagram"
            value={form.igUserId}
            onChange={(e) => setForm({ ...form, igUserId: e.target.value })}
            placeholder={placeholderTersimpan || "mis. 17841400000000000"}
            hint="Tertera di samping akun pada halaman yang sama. Boleh kosong — server memakai akun pemilik token."
          />
          <PasswordInput
            noAutofill
            label="App Secret"
            value={form.appSecret}
            onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
            placeholder={placeholderTersimpan}
            hint="Instagram app secret. Wajib: tanpa ini webhook dan permintaan hapus data dari Meta ditolak."
          />
          <PasswordInput
            noAutofill
            label="Webhook Verify Token"
            value={form.verifyToken}
            onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
            placeholder={placeholderTersimpan}
            hint="Buat sendiri (atau klik Buat acak), lalu isikan sama persis di kolom Verify Token milik Meta."
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Button onClick={simpan} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Instagram"}
            </Button>
            <Button variant="secondary" icon="sparkle" onClick={() => setForm({ ...form, verifyToken: tokenAcak() })}>
              Buat acak
            </Button>
            {vig?.hasStoredCredentials ? (
              <Button variant="secondary" onClick={toggle}>
                {vig.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            ) : null}
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Card title="Untuk diisi di Meta">
            <CopyField label="Callback URL (webhook)" value={callback} />
            {form.verifyToken ? (
              <CopyField label="Verify Token (simpan di sini, lalu tempel di Meta)" value={form.verifyToken} />
            ) : (
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
                Verify Token yang tersimpan tidak ditampilkan ulang. Untuk menggantinya, isi kolom Verify Token lalu
                Simpan, dan tempel nilai yang sama di Meta.
              </div>
            )}
            <CopyField label="Data deletion request URL" value={urlHapusData} />
            <CopyField label="Deauthorize callback URL" value={urlDeauthorize} />
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
              Berlangganan field <strong>messages</strong> di Configure webhooks, dan nyalakan Webhook subscription
              untuk akun Instagram-nya.
            </div>
          </Card>

          <Card title="Batasan Instagram">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: theme.textMuted, lineHeight: 1.65 }}>
              <li>
                Survei selalu berjalan sebagai <strong>Chatbot</strong> (tanya-jawab per pesan), walau survei memakai
                mode Form — WhatsApp Flow tidak ada di Instagram.
              </li>
              <li>
                <strong>Tidak bisa broadcast</strong> atau memulai percakapan duluan. Responden harus mengirim DM lebih
                dulu: lewat iklan ke Instagram Direct, tautan <code>ig.me</code>, atau kata pemicu yang disebar.
              </li>
              <li>
                <strong>Tidak ada lokasi dan nomor HP.</strong> Permintaan lokasi dilewati; tanyakan provinsi lewat
                pertanyaan biasa, sebaiknya di awal survei.
              </li>
              <li>Balasan hanya bisa dikirim dalam 24 jam sejak pesan terakhir responden.</li>
              <li>
                Responden ditandai <strong>Sumber Kontak = Instagram</strong> dan <strong>Saluran = Instagram</strong>{" "}
                di Respons, ekspor, dan Google Sheets.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
