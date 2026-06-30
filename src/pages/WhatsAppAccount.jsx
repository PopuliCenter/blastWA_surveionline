import { useCallback, useEffect, useState } from "react";
import { api, apiBase } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, PasswordInput, Notice, Loading, Toggle, useLoader, useIsMobile, theme, Icon } from "../lib/ui";
import { TopUpGuide } from "../lib/topup";

export default function WhatsAppAccount() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listVendors(), []));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({ accessToken: "", phoneNumberId: "", appSecret: "", verifyToken: "", graphVersion: "v23.0" });
  const [qontak, setQontak] = useState({ accessToken: "", channelIntegrationId: "", webhookSecret: "", baseUrl: "https://service-chat.qontak.com/api/open/v1" });
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
    setErr(""); setNote("");
    try {
      const filtered = Object.fromEntries(Object.entries(creds).filter(([, v]) => String(v).trim() !== ""));
      await api.setVendorCredentials(vendor, filtered);
      setNote(`Kredensial ${vendor} tersimpan (terenkripsi).`);
      await reload();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (vendor, active) => { setErr(""); try { await api.setVendorActive(vendor, active); await reload(); } catch (e) { setErr(e.message); } };

  const testMeta = async () => {
    setTesting(true); setMetaTest(null);
    try {
      const q = await api.getWaQuality();
      if (q.error) setMetaTest({ ok: false, text: q.error });
      else setMetaTest({ ok: true, text: `Terhubung${q.display_phone_number ? ` — ${q.display_phone_number}` : ""}${q.verified_name ? ` (${q.verified_name})` : ""}.` });
    } catch (e) { setMetaTest({ ok: false, text: e.message }); } finally { setTesting(false); }
  };

  const testQontak = async () => {
    setQtesting(true); setQontakTest(null);
    try {
      const q = await api.checkQontak();
      if (q.ok) setQontakTest({ ok: true, text: `Terhubung — token valid${typeof q.templates === "number" ? `, ${q.templates} template tersedia` : ""}.` });
      else setQontakTest({ ok: false, text: q.error || `Gagal (HTTP ${q.status ?? "?"})` });
    } catch (e) { setQontakTest({ ok: false, text: e.message }); } finally { setQtesting(false); }
  };

  const Status = ({ v }) => v ? (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <Badge tone={v.configured ? "green" : "yellow"}>{v.configured ? "terkonfigurasi" : "belum lengkap"}</Badge>
      {v.active ? <Badge tone="green">aktif</Badge> : <Badge tone="default">nonaktif</Badge>}
      {v.isDefault ? <Badge tone="purple">default</Badge> : null}
    </div>
  ) : <Badge tone="default">belum diatur</Badge>;

  if (loading) return <div><PageHeader title="Akun WhatsApp" /><Loading /></div>;

  const metaCallback = `${apiBase}/webhook/meta`;
  const qontakCallback = `${apiBase}/webhook/qontak`;

  return (
    <div>
      <PageHeader title="Akun WhatsApp" subtitle="Hubungkan vendor pengirim (Meta Cloud API / Qontak). Kredensial disimpan terenkripsi di server." actions={[
        <Button key="g" variant="secondary" icon="eye" onClick={() => setGuideOpen((o) => !o)}>{guideOpen ? "Tutup Panduan" : "Panduan Koneksi"}</Button>,
        <Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
      ]} />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      {/* Banner status koneksi */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, marginBottom: 16, background: activeReady ? theme.greenSoft : theme.yellowSoft, border: `1px solid ${activeReady ? theme.green : theme.yellow}22` }}>
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: activeReady ? theme.green : theme.yellow, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={activeReady ? "check" : "whatsapp"} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: activeReady ? theme.green : theme.yellow }}>{activeReady ? `Siap mengirim via ${VENDOR_LABEL[activeReady.name] || activeReady.name}` : "Belum ada vendor yang siap"}</div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>{activeReady ? "Akun terhubung & aktif. Anda bisa membuat broadcast." : "Isi kredensial salah satu vendor di bawah, lalu aktifkan. Klik “Panduan Koneksi” bila butuh langkah detail."}</div>
        </div>
        <Button variant="secondary" size="sm" icon="invoice" onClick={() => setTopupOpen((o) => !o)}>{topupOpen ? "Tutup" : "Cara Top Up"}</Button>
      </div>

      {topupOpen ? <div style={{ marginBottom: 16 }}><TopUpGuide /></div> : null}
      {guideOpen ? <SetupGuide metaCallback={metaCallback} verifyToken={meta.verifyToken} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Meta Cloud API" actions={<Status v={vmeta} />}>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>Jalur resmi WhatsApp. Cocok untuk broadcast template & survei. <span style={{ color: theme.primary, cursor: "pointer", fontWeight: 600 }} onClick={() => setGuideOpen(true)}>Lihat langkahnya →</span></div>
          <PasswordInput label="Access Token (System User)" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} placeholder={vmeta?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : "EAAG..."} hint="Meta Business › System Users › Generate token (akses WhatsApp). Pakai token permanen." />
          <Input label="Phone Number ID" value={meta.phoneNumberId} onChange={(e) => setMeta({ ...meta, phoneNumberId: e.target.value })} hint="WhatsApp Manager › API Setup › di bawah nomor Anda." />
          <PasswordInput label="App Secret" value={meta.appSecret} onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })} hint="Meta for Developers › App › Settings › Basic › App Secret. Untuk verifikasi webhook." />
          <PasswordInput label="Webhook Verify Token" value={meta.verifyToken} onChange={(e) => setMeta({ ...meta, verifyToken: e.target.value })} hint="Buat sendiri (bebas). Isikan sama persis di kolom Verify Token milik Meta." />
          <Input label="Graph API Version" value={meta.graphVersion} onChange={(e) => setMeta({ ...meta, graphVersion: e.target.value })} hint="Default v23.0 — biarkan bila ragu." />
          <CopyField label="Callback URL (untuk webhook Meta)" value={metaCallback} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Button onClick={() => saveCreds("meta", meta)}>Simpan Meta</Button>
            {vmeta?.hasStoredCredentials ? <Button variant="secondary" icon="refresh" onClick={testMeta} disabled={testing}>{testing ? "Mengecek..." : "Cek Koneksi"}</Button> : null}
            {vmeta ? <Button variant="secondary" onClick={() => toggle("meta", !vmeta.active)}>{vmeta.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
          {metaTest ? <div style={{ marginTop: 10, fontSize: 12.5, color: metaTest.ok ? theme.green : theme.red, background: metaTest.ok ? theme.greenSoft : theme.redSoft, borderRadius: 8, padding: "8px 11px" }}>{metaTest.ok ? "✓ " : "✕ "}{metaTest.text}</div> : null}
        </Card>

        <Card title="Mekari Qontak" actions={<Status v={vqontak} />}>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>Alternatif via partner resmi (BSP). Cocok bila Anda sudah berlangganan Qontak.</div>
          <PasswordInput label="Access Token" value={qontak.accessToken} onChange={(e) => setQontak({ ...qontak, accessToken: e.target.value })} placeholder={vqontak?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : ""} hint="Qontak › Pengaturan › API / Integrasi." />
          <Input label="Channel Integration ID" value={qontak.channelIntegrationId} onChange={(e) => setQontak({ ...qontak, channelIntegrationId: e.target.value })} hint="ID channel WhatsApp di akun Qontak Anda." />
          <PasswordInput label="Webhook Secret" value={qontak.webhookSecret} onChange={(e) => setQontak({ ...qontak, webhookSecret: e.target.value })} hint="Untuk verifikasi pesan masuk dari Qontak." />
          <Input label="Base URL" value={qontak.baseUrl} onChange={(e) => setQontak({ ...qontak, baseUrl: e.target.value })} hint="Biarkan default kecuali diarahkan lain." />
          <CopyField label="Callback URL (untuk webhook Qontak)" value={qontakCallback} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Button onClick={() => saveCreds("qontak", qontak)}>Simpan Qontak</Button>
            {vqontak?.hasStoredCredentials ? <Button variant="secondary" icon="refresh" onClick={testQontak} disabled={qtesting}>{qtesting ? "Mengecek..." : "Cek Koneksi"}</Button> : null}
            {vqontak ? <Button variant="secondary" onClick={() => toggle("qontak", !vqontak.active)}>{vqontak.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
          {qontakTest ? <div style={{ marginTop: 10, fontSize: 12.5, color: qontakTest.ok ? theme.green : theme.red, background: qontakTest.ok ? theme.greenSoft : theme.redSoft, borderRadius: 8, padding: "8px 11px" }}>{qontakTest.ok ? "✓ " : "✕ "}{qontakTest.text}</div> : null}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}><BaileysCard v={vbaileys} onToggle={toggle} reloadVendors={reload} /></div>

      <div style={{ marginTop: 20 }}><SendingSafety isMobile={isMobile} /></div>
    </div>
  );
}

const VENDOR_LABEL = { meta: "Meta Cloud API", qontak: "Qontak", baileys: "WhatsApp Langsung (QR)" };

// ── WhatsApp Langsung via scan QR (Baileys, TIDAK resmi) ─────────────────────
const BAILEYS_STATUS = {
  connected: ["green", "terhubung"],
  qr: ["yellow", "menunggu scan QR"],
  connecting: ["yellow", "menyambungkan…"],
  logged_out: ["red", "logout"],
  disconnected: ["default", "terputus"],
};

function BaileysCard({ v, onToggle, reloadVendors }) {
  const [state, setState] = useState(null); // { status, qr, me, connected }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try { setState(await api.baileysStatus()); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Polling saat belum terhubung (agar QR & status ter-update). Berhenti bila sudah connected.
  useEffect(() => {
    if (state?.status === "connected") return;
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [state?.status, refresh]);

  const connect = async () => {
    setBusy(true); setErr("");
    try { await api.baileysConnect(); await refresh(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setErr("");
    try { await api.baileysLogout(); await refresh(); await reloadVendors?.(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const st = state?.status || "disconnected";
  const [tone, label] = BAILEYS_STATUS[st] || BAILEYS_STATUS.disconnected;
  const connected = st === "connected";

  return (
    <Card title="WhatsApp Langsung (Scan QR)" actions={
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone={tone}>{label}</Badge>
        {v?.active ? <Badge tone="green">aktif</Badge> : <Badge tone="default">nonaktif</Badge>}
      </div>
    }>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.55 }}>
        Kirim/terima pakai nomor HP biasa via scan QR (seperti WhatsApp Web) — <strong>tanpa</strong> Meta API, template, atau biaya.
      </div>
      <div style={{ fontSize: 12, color: theme.red, background: theme.redSoft, borderRadius: 9, padding: "9px 12px", marginBottom: 14, lineHeight: 1.5 }}>
        ⚠ <strong>Jalur tidak resmi</strong> (melanggar ToS WhatsApp). Ada <strong>risiko nomor diblokir</strong>, apalagi untuk blast massal. Pakai nomor uji/non-kritis, mulai volume kecil, dan patuhi Pengaman Pengiriman di bawah.
      </div>

      {err ? <Notice>{err}</Notice> : null}

      {connected ? (
        <div style={{ background: theme.greenSoft, color: theme.green, borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 14 }}>
          ✓ Terhubung{state?.me?.id ? ` — ${String(state.me.id).split(":")[0].split("@")[0]}` : ""}{state?.me?.name ? ` (${state.me.name})` : ""}
        </div>
      ) : st === "qr" && state?.qr ? (
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <img src={state.qr} alt="QR WhatsApp" style={{ width: 240, height: 240, borderRadius: 12, border: `1px solid ${theme.border}`, background: "#fff", padding: 8 }} />
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.55 }}>
            Buka <strong>WhatsApp di HP</strong> → <strong>Perangkat Tertaut</strong> → <strong>Tautkan Perangkat</strong> → arahkan kamera ke QR ini. QR berganti otomatis bila kedaluwarsa.
          </div>
        </div>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 14 }}>
          {st === "connecting" ? "Sedang menyambungkan…" : "Klik “Hubungkan / Tampilkan QR” untuk mulai, lalu scan dengan WhatsApp di HP."}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!connected ? <Button onClick={connect} icon="whatsapp" disabled={busy}>{busy ? "Memproses…" : "Hubungkan / Tampilkan QR"}</Button> : null}
        {connected || st === "qr" || st === "connecting" ? <Button variant="secondary" onClick={logout} disabled={busy}>Putuskan / Logout</Button> : null}
        {v ? <Button variant="secondary" onClick={() => onToggle("baileys", !v.active)}>{v.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
        <Button variant="ghost" icon="refresh" onClick={refresh}>Refresh</Button>
      </div>
    </Card>
  );
}

// Field read-only dengan tombol salin
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={value} onFocus={(e) => e.target.select()} style={{ flex: 1, padding: "10px 12px", background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 12.5, fontFamily: "monospace", boxSizing: "border-box", outline: "none" }} />
        <Button variant="secondary" size="sm" icon={copied ? "check" : "download"} onClick={copy}>{copied ? "Disalin" : "Salin"}</Button>
      </div>
    </div>
  );
}

// Panduan langkah-langkah koneksi Meta (tutorial)
function SetupGuide({ metaCallback }) {
  const linkBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, textDecoration: "none", background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` };
  const steps = [
    ["Buat akun & aplikasi di Meta for Developers", "Buka developers.facebook.com → Login → My Apps → Create App → pilih tipe Business. Beri nama aplikasi.", "https://developers.facebook.com/apps/"],
    ["Tambahkan produk WhatsApp", "Di dashboard aplikasi → menu Add Product → pilih WhatsApp → Set up. Ikuti wizard hingga muncul halaman API Setup.", null],
    ["Salin Phone Number ID & daftarkan nomor", "Di WhatsApp → API Setup: pakai nomor uji yang disediakan, ATAU klik Add phone number untuk daftarkan nomor Anda (butuh OTP). Salin Phone Number ID-nya ke kolom di kartu Meta.", "https://business.facebook.com/wa/manage/"],
    ["Buat Access Token permanen", "Meta Business Settings → Users → System Users → buat 1 system user (peran Admin) → Assign assets (pilih aplikasi & nomor WhatsApp) → Generate new token → centang izin whatsapp_business_messaging & whatsapp_business_management → salin token (pakai yang TANPA kedaluwarsa).", "https://business.facebook.com/settings"],
    ["Salin App Secret", "Dashboard aplikasi → Settings → Basic → klik Show pada App Secret → salin ke kolom App Secret.", null],
    ["Pasang Webhook", "WhatsApp → Configuration → Webhook → Edit. Tempel Callback URL (di bawah), isi Verify Token bebas (samakan persis dengan kolom 'Webhook Verify Token' di form) → Verify and save → Subscribe ke field 'messages'.", null],
    ["Isi di aplikasi ini, Simpan, lalu Cek Koneksi", "Masukkan Access Token, Phone Number ID, App Secret, Verify Token ke kartu Meta di atas → klik Simpan Meta → klik Cek Koneksi untuk memastikan tersambung.", null],
  ];
  return (
    <Card title="Tutorial Menautkan ke Meta Cloud API" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        <strong style={{ color: theme.text }}>Perlu disiapkan:</strong> akun Meta Business, 1 nomor HP baru yang bisa terima OTP (jangan nomor pribadi penting), dan metode pembayaran (untuk kirim ke nomor asli). Ikuti langkah berurutan di bawah.
      </div>
      <div style={{ display: "grid", gap: 13 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: theme.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{s[0]}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.55 }}>{s[1]}</div>
              {s[2] ? <a href={s[2]} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, marginTop: 7, padding: "5px 10px", fontSize: 11.5 }}><Icon name="link" size={13} />Buka halaman</a> : null}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}><CopyField label="Callback URL (tempel di langkah 6)" value={metaCallback} /></div>
      <div style={{ fontSize: 12, color: theme.yellow, background: theme.yellowSoft, borderRadius: 8, padding: "9px 12px", lineHeight: 1.5 }}>
        ⚠ Webhook butuh server yang bisa diakses publik (HTTPS). Untuk uji di komputer sendiri, jalankan tunnel seperti <strong>ngrok</strong> lalu pakai URL ngrok sebagai Callback URL. Saat sudah online (di server/hosting), pakai domain aslinya.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" style={linkBtn}><Icon name="link" size={13} />Dokumentasi resmi Meta</a>
      </div>
    </Card>
  );
}

// ── Pengaman pengiriman (anti-banned) ───────────────────────────────────────
// Preset cepat untuk batas harian + jeda antar pesan.
const SENDING_PRESETS = [
  { key: "baileys", label: "Baileys (hati-hati)", dailyLimit: 40, jitterMinMs: 8000, jitterMaxMs: 30000, hint: "Jalur QR tidak resmi / nomor baru: pelan & sebar (8–30 dtk, 40/hari). Naikkan bertahap." },
  { key: "official", label: "Resmi (Meta/Qontak)", dailyLimit: 500, jitterMinMs: 800, jitterMaxMs: 2500, hint: "Jalur resmi dengan template: lebih longgar (0,8–2,5 dtk, 500/hari)." },
];

const QUALITY_MAP = {
  GREEN: ["green", "Tinggi (Hijau)"],
  YELLOW: ["yellow", "Sedang (Kuning)"],
  RED: ["red", "Rendah (Merah)"],
  UNKNOWN: ["default", "Belum dinilai"],
};

function SendingSafety({ isMobile }) {
  const policy = useLoader(useCallback(() => api.getSendingPolicy(), []));
  const consent = useLoader(useCallback(() => api.getConsentSummary(), []));
  const [quality, setQuality] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [f, setF] = useState(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (policy.data) setF({ enabled: policy.data.enabled, dailyLimit: policy.data.dailyLimit, jitterMinMs: policy.data.jitterMinMs, jitterMaxMs: policy.data.jitterMaxMs }); }, [policy.data]);

  const save = async () => {
    setSaving(true); setErr(""); setNote("");
    try {
      await api.updateSendingPolicy({ enabled: f.enabled, dailyLimit: Number(f.dailyLimit) || 1, jitterMinMs: Number(f.jitterMinMs) || 0, jitterMaxMs: Number(f.jitterMaxMs) || 0 });
      setNote("Kebijakan pengiriman tersimpan."); await policy.reload();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const checkQuality = async () => {
    setQLoading(true); setQuality(null);
    try { setQuality(await api.getWaQuality()); } catch (e) { setQuality({ error: e.message }); } finally { setQLoading(false); }
  };

  const used = policy.data?.usedToday ?? 0;
  const limit = policy.data?.dailyLimit ?? 0;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <Card title="Pengaman Pengiriman (anti-banned)">
      <Notice>{policy.error || consent.error || err}</Notice>
      <Notice kind="success">{note}</Notice>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
        {/* Kebijakan warm-up / batas harian */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 10 }}>Batas Harian & Jeda (Warm-up)</div>
          {!f ? <Loading /> : (
            <>
              <div style={{ marginBottom: 12 }}><Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Aktifkan pembatasan" /></div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Preset cepat (isi otomatis, lalu klik Simpan):</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SENDING_PRESETS.map((p) => (
                    <Button key={p.key} variant="secondary" size="sm" onClick={() => setF({ ...f, enabled: true, dailyLimit: p.dailyLimit, jitterMinMs: p.jitterMinMs, jitterMaxMs: p.jitterMaxMs })} title={p.hint}>{p.label}</Button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                  <span>Terpakai hari ini</span><span>{used} / {limit}</span>
                </div>
                <div style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct > 90 ? theme.red : pct > 70 ? theme.yellow : theme.green, borderRadius: 999 }} />
                </div>
              </div>
              <Input label="Batas pesan / hari" type="number" value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} hint="Naikkan bertahap untuk nomor baru (mis. 50 → 250 → 1000…)." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Jeda min (ms)" type="number" value={f.jitterMinMs} onChange={(e) => setF({ ...f, jitterMinMs: e.target.value })} />
                <Input label="Jeda maks (ms)" type="number" value={f.jitterMaxMs} onChange={(e) => setF({ ...f, jitterMaxMs: e.target.value })} />
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Kebijakan"}</Button>
            </>
          )}
        </div>

        {/* Kualitas nomor + consent */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>Kualitas Nomor (Meta)</span>
            <Button variant="secondary" size="sm" icon="refresh" onClick={checkQuality} disabled={qLoading}>{qLoading ? "Cek..." : "Cek Status"}</Button>
          </div>
          {quality ? (
            quality.error ? (
              <>
                <Notice>{quality.error}</Notice>
                {/(access token|expired|session has expired|kedaluwarsa|oauth)/i.test(quality.error) ? (
                  <div style={{ background: theme.yellowSoft, color: theme.yellow, borderRadius: 9, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
                    <strong>Token Meta kedaluwarsa.</strong> Token sementara hanya berlaku beberapa jam/hari. Solusinya pakai <strong>token permanen</strong>:
                    <div style={{ marginTop: 6 }}>1. Buka <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, fontWeight: 600 }}>Meta Business Settings</a> → Users → <strong>System Users</strong>.</div>
                    <div>2. Pilih/buat system user → <strong>Generate new token</strong> → pilih aplikasi Anda → centang izin <em>whatsapp_business_messaging</em> &amp; <em>whatsapp_business_management</em> → <strong>jangan</strong> set masa berlaku (token permanen).</div>
                    <div>3. Salin token → tempel ke kolom <strong>Access Token</strong> di kartu Meta di atas → <strong>Simpan Meta</strong> → klik <strong>Cek Status</strong> lagi.</div>
                    <div style={{ marginTop: 6 }}>Detail langkah ada di tombol <strong>Panduan Koneksi</strong> (langkah 4).</div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: theme.textMuted }}>Rating kualitas</span><Badge tone={(QUALITY_MAP[quality.quality_rating] || QUALITY_MAP.UNKNOWN)[0]}>{(QUALITY_MAP[quality.quality_rating] || QUALITY_MAP.UNKNOWN)[1]}</Badge></div>
                {quality.messaging_limit_tier ? <Row k="Tier limit" v={String(quality.messaging_limit_tier).replace("TIER_", "")} /> : null}
                {quality.verified_name ? <Row k="Nama terverifikasi" v={quality.verified_name} /> : null}
                {quality.display_phone_number ? <Row k="Nomor" v={quality.display_phone_number} /> : null}
                {quality.name_status ? <Row k="Status nama" v={quality.name_status} /> : null}
              </div>
            )
          ) : <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 14 }}>Klik "Cek Status" untuk melihat rating kualitas & tier dari Meta.</div>}

          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 8 }}>Status Langganan Kontak</div>
          {consent.loading ? <Loading /> : consent.data ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Mini label="Total" value={consent.data.total} tone={theme.text} />
              <Mini label="Berlangganan" value={consent.data.subscribed} tone={theme.green} />
              <Mini label="Opt-out" value={consent.data.optedOut} tone={theme.red} />
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: theme.primarySoft, borderRadius: 9, fontSize: 12.5, color: theme.primary, display: "flex", gap: 8 }}>
        <Icon name="check" size={16} />
        <span>Tips: kirim hanya ke kontak yang opt-in, mulai dari volume kecil, dan responden bisa balas <strong>BERHENTI</strong> untuk keluar (otomatis dikecualikan dari blast). Pantau rating tetap Hijau di WhatsApp Manager.</span>
      </div>
    </Card>
  );
}

function Row({ k, v }) {
  return <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: theme.textMuted }}>{k}</span><span style={{ color: theme.text, fontWeight: 600 }}>{v}</span></div>;
}
function Mini({ label, value, tone }) {
  return (
    <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted }}>{label}</div>
    </div>
  );
}
