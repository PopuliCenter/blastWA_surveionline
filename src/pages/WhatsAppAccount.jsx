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
import { TopUpGuide } from "../lib/topup";
import { BaileysCard } from "./waAccount/BaileysCard";
import { CopyField } from "./waAccount/CopyField";
import { SetupGuide } from "./waAccount/SetupGuide";
import { SendingSafety } from "./waAccount/SendingSafety";

export default function WhatsAppAccount() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listVendors(), []));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({
    accessToken: "",
    phoneNumberId: "",
    wabaId: "",
    appSecret: "",
    verifyToken: "",
    graphVersion: "v23.0",
  });
  const [qontak, setQontak] = useState({
    accessToken: "",
    channelIntegrationId: "",
    webhookSecret: "",
    baseUrl: "https://service-chat.qontak.com/api/open/v1",
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [metaTest, setMetaTest] = useState(null); // { ok, text }
  const [testing, setTesting] = useState(false);
  const [qontakTest, setQontakTest] = useState(null); // { ok, text }
  const [qtesting, setQtesting] = useState(false);

  const vendors = data || [];
  const vmeta = vendors.find((v) => v.name === "meta");
  const vqontak = vendors.find((v) => v.name === "qontak");
  const vbaileys = vendors.find((v) => v.name === "baileys");
  const activeReady = vendors.find((v) => v.active && v.configured);

  const saveCreds = async (vendor, creds) => {
    setErr("");
    setNote("");
    try {
      const filtered = Object.fromEntries(Object.entries(creds).filter(([, v]) => String(v).trim() !== ""));
      await api.setVendorCredentials(vendor, filtered);
      setNote(`Kredensial ${vendor} tersimpan (terenkripsi).`);
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  const toggle = async (vendor, active) => {
    setErr("");
    try {
      await api.setVendorActive(vendor, active);
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  const testMeta = async () => {
    setTesting(true);
    setMetaTest(null);
    try {
      const q = await api.getWaQuality();
      if (q.error) setMetaTest({ ok: false, text: q.error });
      else
        setMetaTest({
          ok: true,
          text: `Terhubung${q.display_phone_number ? ` — ${q.display_phone_number}` : ""}${q.verified_name ? ` (${q.verified_name})` : ""}.`,
        });
    } catch (e) {
      setMetaTest({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const testQontak = async () => {
    setQtesting(true);
    setQontakTest(null);
    try {
      const q = await api.checkQontak();
      if (q.ok)
        setQontakTest({
          ok: true,
          text: `Terhubung — token valid${typeof q.templates === "number" ? `, ${q.templates} template tersedia` : ""}.`,
        });
      else setQontakTest({ ok: false, text: q.error || `Gagal (HTTP ${q.status ?? "?"})` });
    } catch (e) {
      setQontakTest({ ok: false, text: e.message });
    } finally {
      setQtesting(false);
    }
  };

  const Status = ({ v }) =>
    v ? (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {v.decryptError ? <Badge tone="red">perlu input ulang</Badge> : null}
        <Badge tone={v.configured ? "green" : "yellow"}>{v.configured ? "terkonfigurasi" : "belum lengkap"}</Badge>
        {v.active ? <Badge tone="green">aktif</Badge> : <Badge tone="default">nonaktif</Badge>}
        {v.isDefault ? <Badge tone="purple">default</Badge> : null}
      </div>
    ) : (
      <Badge tone="default">belum diatur</Badge>
    );

  if (loading)
    return (
      <div>
        <PageHeader title="Akun WhatsApp" />
        <Loading />
      </div>
    );

  const metaCallback = `${apiBase}/webhook/meta`;
  const qontakCallback = `${apiBase}/webhook/qontak`;

  return (
    <div>
      <PageHeader
        title="Akun WhatsApp"
        subtitle="Hubungkan vendor pengirim (Meta Cloud API / Qontak). Kredensial disimpan terenkripsi di server."
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

      {/* Peringatan: kredensial tersimpan tapi gagal didekripsi (CREDENTIALS_ENC_KEY berubah). */}
      {vendors.some((v) => v.decryptError) ? (
        <div
          style={{
            padding: "13px 16px",
            borderRadius: 12,
            marginBottom: 16,
            background: theme.redSoft,
            border: `1px solid ${theme.red}33`,
            color: theme.red,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <strong>
            ⚠ Kredensial{" "}
            {vendors
              .filter((v) => v.decryptError)
              .map((v) => v.name.toUpperCase())
              .join(" & ")}{" "}
            tak bisa dibaca.
          </strong>{" "}
          Kunci enkripsi server (<code>CREDENTIALS_ENC_KEY</code>) kemungkinan berubah, sehingga kredensial lama tak
          bisa didekripsi. <strong>Input ulang</strong> kredensial di bawah lalu Simpan untuk mengaktifkan kembali.
        </div>
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
          background: activeReady ? theme.greenSoft : theme.yellowSoft,
          border: `1px solid ${activeReady ? theme.green : theme.yellow}22`,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: activeReady ? theme.green : theme.yellow,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={activeReady ? "check" : "whatsapp"} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: activeReady ? theme.green : theme.yellow }}>
            {activeReady
              ? `Siap mengirim via ${VENDOR_LABEL[activeReady.name] || activeReady.name}`
              : "Belum ada vendor yang siap"}
          </div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>
            {activeReady
              ? "Akun terhubung & aktif. Anda bisa membuat broadcast."
              : "Isi kredensial salah satu vendor di bawah, lalu aktifkan. Klik “Panduan Koneksi” bila butuh langkah detail."}
          </div>
        </div>
        <Button variant="secondary" size="sm" icon="invoice" onClick={() => setTopupOpen((o) => !o)}>
          {topupOpen ? "Tutup" : "Cara Top Up"}
        </Button>
      </div>

      {topupOpen ? (
        <div style={{ marginBottom: 16 }}>
          <TopUpGuide />
        </div>
      ) : null}
      {guideOpen ? <SetupGuide metaCallback={metaCallback} verifyToken={meta.verifyToken} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Meta Cloud API" actions={<Status v={vmeta} />}>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>
            Jalur resmi WhatsApp. Cocok untuk broadcast template & survei.{" "}
            <span
              style={{ color: theme.primary, cursor: "pointer", fontWeight: 600 }}
              onClick={() => setGuideOpen(true)}
            >
              Lihat langkahnya →
            </span>
          </div>
          <PasswordInput
            noAutofill
            label="Access Token (System User)"
            value={meta.accessToken}
            onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })}
            placeholder={vmeta?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : "EAAG..."}
            hint="Meta Business › System Users › Generate token (akses WhatsApp). Pakai token permanen."
          />
          <Input
            label="Phone Number ID"
            value={meta.phoneNumberId}
            onChange={(e) => setMeta({ ...meta, phoneNumberId: e.target.value })}
            hint="WhatsApp Manager › API Setup › di bawah nomor Anda."
          />
          <Input
            label="WhatsApp Business Account ID (WABA)"
            value={meta.wabaId}
            onChange={(e) => setMeta({ ...meta, wabaId: e.target.value })}
            placeholder={vmeta?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : "mis. 1027483456718760"}
            hint="Untuk mengambil daftar template dari Meta saat broadcast. WhatsApp Manager › Account tools / API Setup."
          />
          <PasswordInput
            noAutofill
            label="App Secret"
            value={meta.appSecret}
            onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })}
            hint="Meta for Developers › App › Settings › Basic › App Secret. Untuk verifikasi webhook."
          />
          <PasswordInput
            noAutofill
            label="Webhook Verify Token"
            value={meta.verifyToken}
            onChange={(e) => setMeta({ ...meta, verifyToken: e.target.value })}
            hint="Buat sendiri (bebas). Isikan sama persis di kolom Verify Token milik Meta."
          />
          <Input
            label="Graph API Version"
            value={meta.graphVersion}
            onChange={(e) => setMeta({ ...meta, graphVersion: e.target.value })}
            hint="Default v23.0 — biarkan bila ragu."
          />
          <CopyField label="Callback URL (untuk webhook Meta)" value={metaCallback} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Button onClick={() => saveCreds("meta", meta)}>Simpan Meta</Button>
            {vmeta?.hasStoredCredentials ? (
              <Button variant="secondary" icon="refresh" onClick={testMeta} disabled={testing}>
                {testing ? "Mengecek..." : "Cek Koneksi"}
              </Button>
            ) : null}
            {vmeta ? (
              <Button variant="secondary" onClick={() => toggle("meta", !vmeta.active)}>
                {vmeta.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            ) : null}
          </div>
          {metaTest ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: metaTest.ok ? theme.green : theme.red,
                background: metaTest.ok ? theme.greenSoft : theme.redSoft,
                borderRadius: 8,
                padding: "8px 11px",
              }}
            >
              {metaTest.ok ? "✓ " : "✕ "}
              {metaTest.text}
            </div>
          ) : null}
        </Card>

        <Card title="Mekari Qontak" actions={<Status v={vqontak} />}>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>
            Alternatif via partner resmi (BSP). Cocok bila Anda sudah berlangganan Qontak.
          </div>
          <PasswordInput
            noAutofill
            label="Access Token"
            value={qontak.accessToken}
            onChange={(e) => setQontak({ ...qontak, accessToken: e.target.value })}
            placeholder={vqontak?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : ""}
            hint="Qontak › Pengaturan › API / Integrasi."
          />
          <Input
            label="Channel Integration ID"
            value={qontak.channelIntegrationId}
            onChange={(e) => setQontak({ ...qontak, channelIntegrationId: e.target.value })}
            hint="ID channel WhatsApp di akun Qontak Anda."
          />
          <PasswordInput
            noAutofill
            label="Webhook Secret"
            value={qontak.webhookSecret}
            onChange={(e) => setQontak({ ...qontak, webhookSecret: e.target.value })}
            hint="Untuk verifikasi pesan masuk dari Qontak."
          />
          <Input
            label="Base URL"
            value={qontak.baseUrl}
            onChange={(e) => setQontak({ ...qontak, baseUrl: e.target.value })}
            hint="Biarkan default kecuali diarahkan lain."
          />
          <CopyField label="Callback URL (untuk webhook Qontak)" value={qontakCallback} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Button onClick={() => saveCreds("qontak", qontak)}>Simpan Qontak</Button>
            {vqontak?.hasStoredCredentials ? (
              <Button variant="secondary" icon="refresh" onClick={testQontak} disabled={qtesting}>
                {qtesting ? "Mengecek..." : "Cek Koneksi"}
              </Button>
            ) : null}
            {vqontak ? (
              <Button variant="secondary" onClick={() => toggle("qontak", !vqontak.active)}>
                {vqontak.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            ) : null}
          </div>
          {qontakTest ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: qontakTest.ok ? theme.green : theme.red,
                background: qontakTest.ok ? theme.greenSoft : theme.redSoft,
                borderRadius: 8,
                padding: "8px 11px",
              }}
            >
              {qontakTest.ok ? "✓ " : "✕ "}
              {qontakTest.text}
            </div>
          ) : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <BaileysCard v={vbaileys} onToggle={toggle} reloadVendors={reload} />
      </div>

      <div style={{ marginTop: 20 }}>
        <SendingSafety isMobile={isMobile} />
      </div>
    </div>
  );
}

const VENDOR_LABEL = { meta: "Meta Cloud API", qontak: "Qontak", baileys: "WhatsApp Langsung (QR)" };
