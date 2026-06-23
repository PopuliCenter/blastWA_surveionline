import { useCallback } from "react";
import { api } from "../lib/api";
import { PageHeader, StatCard, Card, Badge, Loading, Notice, Empty, useLoader, theme, fmtDate } from "../lib/ui";

export default function Dashboard() {
  const stats = useLoader(useCallback(() => api.stats(), []));
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const blasts = useLoader(useCallback(() => api.listBlasts(), []));

  if (stats.error) return <div><PageHeader title="Dashboard" /><Notice>{stats.error}</Notice></div>;
  if (stats.loading) return <div><PageHeader title="Dashboard" /><Loading /></div>;
  const s = stats.data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan operasional WhatsApp & survei Anda." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard label="Pesan Terkirim" value={s.sent} note={`${s.delivered} delivered • ${s.opened} dibaca`} tone="green" icon="broadcast" />
        <StatCard label="Total Kontak" value={s.contacts} note={`${s.segments} segmen`} tone="blue" icon="contacts" />
        <StatCard label="Survei" value={s.surveys} note={`${s.responses} respons masuk`} tone="purple" icon="survey" />
        <StatCard label="Gagal Kirim" value={s.failed} note="perlu dicek bila > 0" tone="yellow" icon="autoreply" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        <Card title="Survei Terbaru">
          {surveys.loading ? <Loading /> : (surveys.data || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {(surveys.data || []).slice(0, 6).map((sv) => (
                <div key={sv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: theme.surfaceAlt, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5 }}>{sv.title}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{sv.questions.length} pertanyaan • {sv.responses} respons</div>
                  </div>
                  <Badge tone={sv.status === "active" ? "green" : sv.status === "draft" ? "yellow" : "default"}>{sv.status}</Badge>
                </div>
              ))}
            </div>
          ) : <Empty icon="survey" title="Belum ada survei" />}
        </Card>

        <Card title="Blast Terakhir">
          {blasts.loading ? <Loading /> : (blasts.data || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {(blasts.data || []).slice(0, 6).map((b) => (
                <div key={b.id} style={{ padding: "10px 12px", background: theme.surfaceAlt, borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 13.5, color: theme.text }}>{b.surveyTitle}</strong>
                    <Badge tone={b.status === "completed" ? "green" : b.status === "failed" ? "red" : "blue"}>{b.status}</Badge>
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{b.segmentName} • {b.vendor} • {fmtDate(b.sentAt)}</div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>Terkirim {b.sent} • Delivered {b.delivered} • Dibaca {b.opened}</div>
                </div>
              ))}
            </div>
          ) : <Empty icon="broadcast" title="Belum ada blast" />}
        </Card>
      </div>
    </div>
  );
}
