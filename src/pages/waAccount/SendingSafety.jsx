import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, Button, Badge, Input, Notice, Loading, Toggle, useLoader, theme, Icon } from "../../lib/ui";

// ── Pengaman pengiriman (anti-banned) ───────────────────────────────────────
// Preset cepat untuk batas harian + jeda antar pesan.
const SENDING_PRESETS = [
  {
    key: "baileys",
    label: "Baileys (hati-hati)",
    dailyLimit: 40,
    jitterMinMs: 8000,
    jitterMaxMs: 30000,
    hint: "Jalur QR tidak resmi / nomor baru: pelan & sebar (8–30 dtk, 40/hari). Naikkan bertahap.",
  },
  {
    key: "official",
    label: "Resmi (Meta/Qontak)",
    dailyLimit: 500,
    jitterMinMs: 800,
    jitterMaxMs: 2500,
    hint: "Jalur resmi dengan template: lebih longgar (0,8–2,5 dtk, 500/hari).",
  },
];

const QUALITY_MAP = {
  GREEN: ["green", "Tinggi (Hijau)"],
  YELLOW: ["yellow", "Sedang (Kuning)"],
  RED: ["red", "Rendah (Merah)"],
  UNKNOWN: ["default", "Belum dinilai"],
};

export function SendingSafety({ isMobile }) {
  const policy = useLoader(useCallback(() => api.getSendingPolicy(), []));
  const consent = useLoader(useCallback(() => api.getConsentSummary(), []));
  const [quality, setQuality] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [f, setF] = useState(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policy.data)
      setF({
        enabled: policy.data.enabled,
        dailyLimit: policy.data.dailyLimit,
        jitterMinMs: policy.data.jitterMinMs,
        jitterMaxMs: policy.data.jitterMaxMs,
      });
  }, [policy.data]);

  const save = async () => {
    setSaving(true);
    setErr("");
    setNote("");
    try {
      await api.updateSendingPolicy({
        enabled: f.enabled,
        dailyLimit: Number(f.dailyLimit) || 1,
        jitterMinMs: Number(f.jitterMinMs) || 0,
        jitterMaxMs: Number(f.jitterMaxMs) || 0,
      });
      setNote("Kebijakan pengiriman tersimpan.");
      await policy.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const checkQuality = async () => {
    setQLoading(true);
    setQuality(null);
    try {
      setQuality(await api.getWaQuality());
    } catch (e) {
      setQuality({ error: e.message });
    } finally {
      setQLoading(false);
    }
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
          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 10 }}>
            Batas Harian & Jeda (Warm-up)
          </div>
          {!f ? (
            <Loading />
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Aktifkan pembatasan" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
                  Preset cepat (isi otomatis, lalu klik Simpan):
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SENDING_PRESETS.map((p) => (
                    <Button
                      key={p.key}
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setF({
                          ...f,
                          enabled: true,
                          dailyLimit: p.dailyLimit,
                          jitterMinMs: p.jitterMinMs,
                          jitterMaxMs: p.jitterMaxMs,
                        })
                      }
                      title={p.hint}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: theme.textMuted,
                    marginBottom: 4,
                  }}
                >
                  <span>Terpakai hari ini</span>
                  <span>
                    {used} / {limit}
                  </span>
                </div>
                <div style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct > 90 ? theme.red : pct > 70 ? theme.yellow : theme.green,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
              <Input
                label="Batas pesan / hari"
                type="number"
                value={f.dailyLimit}
                onChange={(e) => setF({ ...f, dailyLimit: e.target.value })}
                hint="Naikkan bertahap untuk nomor baru (mis. 50 → 250 → 1000…)."
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input
                  label="Jeda min (ms)"
                  type="number"
                  value={f.jitterMinMs}
                  onChange={(e) => setF({ ...f, jitterMinMs: e.target.value })}
                />
                <Input
                  label="Jeda maks (ms)"
                  type="number"
                  value={f.jitterMaxMs}
                  onChange={(e) => setF({ ...f, jitterMaxMs: e.target.value })}
                />
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Kebijakan"}
              </Button>
            </>
          )}
        </div>

        {/* Kualitas nomor + consent */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>Kualitas Nomor (Meta)</span>
            <Button variant="secondary" size="sm" icon="refresh" onClick={checkQuality} disabled={qLoading}>
              {qLoading ? "Cek..." : "Cek Status"}
            </Button>
          </div>
          {quality ? (
            quality.error ? (
              <>
                <Notice>{quality.error}</Notice>
                {/(access token|expired|session has expired|kedaluwarsa|oauth)/i.test(quality.error) ? (
                  <div
                    style={{
                      background: theme.yellowSoft,
                      color: theme.yellow,
                      borderRadius: 9,
                      padding: "10px 12px",
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      marginBottom: 14,
                    }}
                  >
                    <strong>Token Meta kedaluwarsa.</strong> Token sementara hanya berlaku beberapa jam/hari. Solusinya
                    pakai <strong>token permanen</strong>:
                    <div style={{ marginTop: 6 }}>
                      1. Buka{" "}
                      <a
                        href="https://business.facebook.com/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: theme.primary, fontWeight: 600 }}
                      >
                        Meta Business Settings
                      </a>{" "}
                      → Users → <strong>System Users</strong>.
                    </div>
                    <div>
                      2. Pilih/buat system user → <strong>Generate new token</strong> → pilih aplikasi Anda → centang
                      izin <em>whatsapp_business_messaging</em> &amp; <em>whatsapp_business_management</em> →{" "}
                      <strong>jangan</strong> set masa berlaku (token permanen).
                    </div>
                    <div>
                      3. Salin token → tempel ke kolom <strong>Access Token</strong> di kartu Meta di atas →{" "}
                      <strong>Simpan Meta</strong> → klik <strong>Cek Status</strong> lagi.
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Detail langkah ada di tombol <strong>Panduan Koneksi</strong> (langkah 4).
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div
                style={{
                  background: theme.surfaceAlt,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12.5,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: theme.textMuted }}>Rating kualitas</span>
                  <Badge tone={(QUALITY_MAP[quality.quality_rating] || QUALITY_MAP.UNKNOWN)[0]}>
                    {(QUALITY_MAP[quality.quality_rating] || QUALITY_MAP.UNKNOWN)[1]}
                  </Badge>
                </div>
                {quality.messaging_limit_tier ? (
                  <Row k="Tier limit" v={String(quality.messaging_limit_tier).replace("TIER_", "")} />
                ) : null}
                {quality.verified_name ? <Row k="Nama terverifikasi" v={quality.verified_name} /> : null}
                {quality.display_phone_number ? <Row k="Nomor" v={quality.display_phone_number} /> : null}
                {quality.name_status ? <Row k="Status nama" v={quality.name_status} /> : null}
              </div>
            )
          ) : (
            <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 14 }}>
              Klik "Cek Status" untuk melihat rating kualitas & tier dari Meta.
            </div>
          )}

          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 8 }}>
            Status Langganan Kontak
          </div>
          {consent.loading ? (
            <Loading />
          ) : consent.data ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Mini label="Total" value={consent.data.total} tone={theme.text} />
              <Mini label="Berlangganan" value={consent.data.subscribed} tone={theme.green} />
              <Mini label="Opt-out" value={consent.data.optedOut} tone={theme.red} />
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: theme.primarySoft,
          borderRadius: 9,
          fontSize: 12.5,
          color: theme.primary,
          display: "flex",
          gap: 8,
        }}
      >
        <Icon name="check" size={16} />
        <span>
          Tips: kirim hanya ke kontak yang opt-in, mulai dari volume kecil, dan responden bisa balas{" "}
          <strong>BERHENTI</strong> untuk keluar (otomatis dikecualikan dari blast). Pantau rating tetap Hijau di
          WhatsApp Manager.
        </span>
      </div>
    </Card>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: theme.textMuted }}>{k}</span>
      <span style={{ color: theme.text, fontWeight: 600 }}>{v}</span>
    </div>
  );
}
function Mini({ label, value, tone }) {
  return (
    <div
      style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "8px 14px", textAlign: "center", minWidth: 92 }}
    >
      <div style={{ fontSize: 19, fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted }}>{label}</div>
    </div>
  );
}
