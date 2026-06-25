import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Notice, Loading, Toggle, useLoader, useIsMobile, theme, Icon } from "../lib/ui";

export default function WhatsAppAccount() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listVendors(), []));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({ accessToken: "", phoneNumberId: "", appSecret: "", verifyToken: "", graphVersion: "v23.0" });
  const [qontak, setQontak] = useState({ accessToken: "", channelIntegrationId: "", webhookSecret: "", baseUrl: "https://service-chat.qontak.com/api/open/v1" });

  const vendors = data || [];
  const vmeta = vendors.find((v) => v.name === "meta");
  const vqontak = vendors.find((v) => v.name === "qontak");

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

  const Status = ({ v }) => v ? (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <Badge tone={v.configured ? "green" : "yellow"}>{v.configured ? "terkonfigurasi" : "belum lengkap"}</Badge>
      {v.isDefault ? <Badge tone="purple">default</Badge> : null}
      {v.hasStoredCredentials ? <Badge tone="blue">kredensial tersimpan</Badge> : null}
    </div>
  ) : null;

  if (loading) return <div><PageHeader title="Akun WhatsApp" /><Loading /></div>;

  return (
    <div>
      <PageHeader title="Akun WhatsApp" subtitle="Hubungkan vendor pengirim (Meta Cloud API / Qontak). Kredensial disimpan terenkripsi di server." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>]} />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Meta Cloud API" actions={<Status v={vmeta} />}>
          <Input label="Access Token (System User)" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} placeholder={vmeta?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : "EAAG..."} />
          <Input label="Phone Number ID" value={meta.phoneNumberId} onChange={(e) => setMeta({ ...meta, phoneNumberId: e.target.value })} />
          <Input label="App Secret" value={meta.appSecret} onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })} />
          <Input label="Webhook Verify Token" value={meta.verifyToken} onChange={(e) => setMeta({ ...meta, verifyToken: e.target.value })} />
          <Input label="Graph API Version" value={meta.graphVersion} onChange={(e) => setMeta({ ...meta, graphVersion: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("meta", meta)}>Simpan Meta</Button>
            {vmeta ? <Button variant="secondary" onClick={() => toggle("meta", !vmeta.active)}>{vmeta.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </Card>

        <Card title="Mekari Qontak" actions={<Status v={vqontak} />}>
          <Input label="Access Token" value={qontak.accessToken} onChange={(e) => setQontak({ ...qontak, accessToken: e.target.value })} placeholder={vqontak?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : ""} />
          <Input label="Channel Integration ID" value={qontak.channelIntegrationId} onChange={(e) => setQontak({ ...qontak, channelIntegrationId: e.target.value })} />
          <Input label="Webhook Secret" value={qontak.webhookSecret} onChange={(e) => setQontak({ ...qontak, webhookSecret: e.target.value })} />
          <Input label="Base URL" value={qontak.baseUrl} onChange={(e) => setQontak({ ...qontak, baseUrl: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("qontak", qontak)}>Simpan Qontak</Button>
            {vqontak ? <Button variant="secondary" onClick={() => toggle("qontak", !vqontak.active)}>{vqontak.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 20 }}><SendingSafety isMobile={isMobile} /></div>
    </div>
  );
}

// ── Pengaman pengiriman (anti-banned) ───────────────────────────────────────
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
            quality.error ? <Notice>{quality.error}</Notice> : (
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
