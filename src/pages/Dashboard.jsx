import { useCallback } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  Loading,
  Notice,
  Empty,
  useLoader,
  useIsMobile,
  theme,
  fmtDate,
  Icon,
} from "../lib/ui";

const pctOf = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

// Progress bar berlabel + persentase
function Rate({ label, value, total, tone, hint }) {
  const pct = pctOf(value, total);
  return (
    <div style={{ marginBottom: 13 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 12.5,
          marginBottom: 5,
        }}
      >
        <span style={{ color: theme.textMuted }}>
          {label}
          {hint ? <span style={{ fontSize: 11, marginLeft: 5 }}>· {hint}</span> : null}
        </span>
        <span style={{ color: theme.text, fontWeight: 700 }}>
          {pct}%{" "}
          <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: 11.5 }}>
            ({(value || 0).toLocaleString("id-ID")})
          </span>
        </span>
      </div>
      <div style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{ height: "100%", width: `${pct}%`, background: tone, borderRadius: 999, transition: "width .3s" }}
        />
      </div>
    </div>
  );
}

// Kotak angka kecil
function Mini({ label, value, tone, icon }) {
  return (
    <div
      style={{
        flex: "1 1 92px",
        background: theme.surfaceAlt,
        borderRadius: 10,
        padding: "11px 12px",
        textAlign: "center",
      }}
    >
      {icon ? (
        <div style={{ color: tone || theme.textMuted, marginBottom: 3 }}>
          <Icon name={icon} size={16} />
        </div>
      ) : null}
      <div style={{ fontSize: 21, fontWeight: 800, color: tone || theme.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// Baris bar (grafik horizontal)
function BarRow({ label, value, max, tone, sub }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 3 }}>
        <span
          style={{
            color: theme.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "68%",
          }}
        >
          {label}
        </span>
        <span style={{ color: theme.textMuted, flexShrink: 0 }}>{sub}</span>
      </div>
      <div style={{ height: 9, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{ height: "100%", width: `${value > 0 ? Math.max(pct, 4) : 0}%`, background: tone, borderRadius: 999 }}
        />
      </div>
    </div>
  );
}

const QUALITY = {
  GREEN: ["green", "Tinggi (Hijau)"],
  YELLOW: ["yellow", "Sedang (Kuning)"],
  RED: ["red", "Rendah (Merah)"],
  UNKNOWN: ["default", "Belum dinilai"],
};

export default function Dashboard() {
  const isMobile = useIsMobile();
  const stats = useLoader(useCallback(() => api.stats(), []));
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const blasts = useLoader(useCallback(() => api.listBlasts(), []));
  const consent = useLoader(useCallback(() => api.getConsentSummary(), []));
  const policy = useLoader(useCallback(() => api.getSendingPolicy(), []));
  const convos = useLoader(useCallback(() => api.conversations(), []));
  const quality = useLoader(useCallback(() => api.getWaQuality().catch(() => ({ error: "n/a" })), []));

  if (stats.error)
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Notice>{stats.error}</Notice>
      </div>
    );
  if (stats.loading)
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Loading />
      </div>
    );
  const s = stats.data;

  // Rasio pengiriman
  const attempted = (s.sent || 0) + (s.failed || 0);

  // Inbox
  const cs = convos.data || [];
  // eslint-disable-next-line react-hooks/purity -- sengaja baca waktu sekarang untuk hitung sesi 24 jam aktif
  const now = Date.now();
  const inbox = {
    total: cs.length,
    unread: cs.filter((c) => c.unread > 0 && !c.resolved).length,
    active: cs.filter((c) => c.sessionExpiresAt && new Date(c.sessionExpiresAt).getTime() > now && !c.resolved).length,
  };

  // Consent
  const cd = consent.data || {};
  const consentTotal = cd.total || 0;

  // Sending policy
  const pol = policy.data || {};
  const used = pol.usedToday || 0;
  const limit = pol.dailyLimit || 0;
  const usedPct = pctOf(used, limit);

  // Meta quality
  const q = quality.data && !quality.data.error ? quality.data : null;
  const qTone = q ? (QUALITY[q.quality_rating] || QUALITY.UNKNOWN)[0] : "default";
  const qLabel = q ? (QUALITY[q.quality_rating] || QUALITY.UNKNOWN)[1] : "Belum tersambung";

  // Grafik blast (delivered per blast, terbaru)
  const bl = (blasts.data || []).slice(0, 8);
  const blMax = Math.max(1, ...bl.map((b) => b.sent || 0));

  // Grafik respons per survei (terbanyak)
  const svByResp = [...(surveys.data || [])].sort((a, b) => (b.responses || 0) - (a.responses || 0)).slice(0, 6);
  const svMax = Math.max(1, ...svByResp.map((v) => v.responses || 0));

  const grid2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional WhatsApp & survei Anda."
        actions={[
          <span
            key="r"
            onClick={() => {
              stats.reload();
              surveys.reload();
              blasts.reload();
              consent.reload();
              policy.reload();
              convos.reload();
              quality.reload();
            }}
            style={{
              cursor: "pointer",
              color: theme.textMuted,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <Icon name="refresh" size={16} />
            Refresh
          </span>,
        ]}
      />

      {/* Kartu ringkas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Pesan Terkirim"
          value={(s.sent || 0).toLocaleString("id-ID")}
          note={`${pctOf(s.delivered, s.sent)}% sampai • ${pctOf(s.opened, s.sent)}% dibaca`}
          tone="green"
          icon="broadcast"
        />
        <StatCard
          label="Total Kontak"
          value={(s.contacts || 0).toLocaleString("id-ID")}
          note={`${s.segments} segmen • ${cd.optedOut ?? 0} opt-out`}
          tone="blue"
          icon="contacts"
        />
        <StatCard
          label="Survei"
          value={s.surveys}
          note={`${s.activeSurveys ?? 0} aktif • ${s.responses} respons`}
          tone="purple"
          icon="survey"
        />
        <StatCard
          label="Gagal Kirim"
          value={s.failed}
          note={attempted ? `${pctOf(s.failed, attempted)}% dari percobaan` : "belum ada kirim"}
          tone={s.failed > 0 ? "yellow" : "default"}
          icon="autoreply"
        />
      </div>

      {/* Funnel + Kesehatan */}
      <div style={grid2}>
        <Card title="Funnel Pengiriman">
          {attempted === 0 ? (
            <Empty icon="broadcast" title="Belum ada pengiriman" note="Kirim broadcast dulu untuk melihat rasio." />
          ) : (
            <>
              <Rate label="Terkirim → Sampai (delivered)" value={s.delivered} total={s.sent} tone={theme.green} />
              <Rate label="Terkirim → Dibaca (read)" value={s.opened} total={s.sent} tone={theme.purple} />
              <Rate label="Gagal kirim" value={s.failed} total={attempted} tone={theme.red} />
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                Basis: {(s.sent || 0).toLocaleString("id-ID")} terkirim, {attempted.toLocaleString("id-ID")} percobaan.
                Rasio "dibaca" bergantung setelan read-receipt penerima.
              </div>
            </>
          )}
        </Card>

        <Card title="Kesehatan Akun (anti-banned)">
          {/* Consent */}
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
            Status Langganan Kontak
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Mini label="Total" value={consentTotal} tone={theme.text} />
            <Mini label="Berlangganan" value={cd.subscribed ?? 0} tone={theme.green} />
            <Mini label="Opt-out" value={cd.optedOut ?? 0} tone={theme.red} />
          </div>
          {/* Pemakaian harian */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
            <span style={{ color: theme.textMuted }}>Pemakaian harian (warm-up)</span>
            <span style={{ color: theme.text, fontWeight: 700 }}>
              {used} / {limit || "∞"}
            </span>
          </div>
          <div
            style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, usedPct)}%`,
                background: usedPct > 90 ? theme.red : usedPct > 70 ? theme.yellow : theme.green,
                borderRadius: 999,
              }}
            />
          </div>
          {/* Kualitas nomor Meta */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: theme.surfaceAlt,
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Kualitas nomor (Meta)</div>
              <div style={{ fontSize: 12.5, color: theme.text, marginTop: 2 }}>
                {q?.display_phone_number || (quality.loading ? "memuat…" : "belum tersambung")}
                {q?.messaging_limit_tier ? ` • tier ${String(q.messaging_limit_tier).replace("TIER_", "")}` : ""}
              </div>
            </div>
            <Badge tone={qTone}>{qLabel}</Badge>
          </div>
        </Card>
      </div>

      {/* Inbox & Survei + Grafik blast */}
      <div style={grid2}>
        <Card title="Ringkasan Inbox & Survei">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Mini label="Percakapan" value={inbox.total} tone={theme.text} icon="chat" />
            <Mini
              label="Belum dibalas"
              value={inbox.unread}
              tone={inbox.unread ? theme.red : theme.textMuted}
              icon="autoreply"
            />
            <Mini label="Sesi aktif" value={inbox.active} tone={theme.green} icon="whatsapp" />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Mini label="Survei aktif" value={s.activeSurveys ?? 0} tone={theme.purple} icon="survey" />
            <Mini label="Respons selesai" value={s.responsesCompleted ?? 0} tone={theme.green} icon="check" />
            <Mini
              label="Penyelesaian"
              value={`${pctOf(s.responsesCompleted, s.responses)}%`}
              tone={theme.blue}
              icon="report"
            />
          </div>
        </Card>

        <Card title="Performa Blast Terakhir">
          {bl.length ? (
            <div>
              {bl.map((b) => (
                <BarRow
                  key={b.id}
                  label={b.surveyTitle && b.surveyTitle !== "-" ? b.surveyTitle : b.message || b.segmentName || "Blast"}
                  value={b.sent || 0}
                  max={blMax}
                  tone={theme.primary}
                  sub={`${b.sent || 0}✓ · ${b.opened || 0} dibaca`}
                />
              ))}
            </div>
          ) : (
            <Empty icon="broadcast" title="Belum ada blast" />
          )}
        </Card>
      </div>

      {/* Respons per survei + Survei terbaru */}
      <div style={grid2}>
        <Card title="Respons per Survei">
          {svByResp.length && svByResp.some((v) => v.responses) ? (
            <div>
              {svByResp.map((v) => (
                <BarRow
                  key={v.id}
                  label={v.title}
                  value={v.responses || 0}
                  max={svMax}
                  tone={theme.purple}
                  sub={`${v.responses || 0} respons`}
                />
              ))}
            </div>
          ) : (
            <Empty icon="survey" title="Belum ada respons" />
          )}
        </Card>

        <Card title="Survei Terbaru">
          {surveys.loading ? (
            <Loading />
          ) : (surveys.data || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {(surveys.data || []).slice(0, 5).map((sv) => (
                <div
                  key={sv.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: theme.surfaceAlt,
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5 }}>{sv.title}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                      {sv.questions.length} pertanyaan • {sv.responses} respons{sv.mode === "flow" ? " • Flow" : ""}
                    </div>
                  </div>
                  <Badge tone={sv.status === "active" ? "green" : sv.status === "draft" ? "yellow" : "default"}>
                    {sv.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="survey" title="Belum ada survei" />
          )}
        </Card>
      </div>

      {/* Blast terakhir (detail) */}
      <Card title="Blast Terakhir">
        {blasts.loading ? (
          <Loading />
        ) : (blasts.data || []).length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {(blasts.data || []).slice(0, 6).map((b) => (
              <div key={b.id} style={{ padding: "10px 12px", background: theme.surfaceAlt, borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 13.5, color: theme.text }}>{b.surveyTitle}</strong>
                  <Badge
                    tone={
                      b.status === "completed"
                        ? "green"
                        : b.status === "failed"
                          ? "red"
                          : b.status === "scheduled"
                            ? "yellow"
                            : "blue"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                  {b.segmentName} • {b.vendor} • {fmtDate(b.sentAt)}
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                  Terkirim {b.sent} • Sampai {b.delivered} • Dibaca {b.opened}
                  {b.failed ? ` • Gagal ${b.failed}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="broadcast" title="Belum ada blast" />
        )}
      </Card>
    </div>
  );
}
