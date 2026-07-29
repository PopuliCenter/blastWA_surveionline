import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirm";
import { PageHeader, Card, Button, Badge, Notice, Loading, Empty, useLoader, theme } from "../lib/ui";
import { SurveyBuilder } from "./survey/SurveyBuilder";
import { ResponsesModal } from "./survey/ResponsesModal";
import { SurveyPreviewModal } from "./survey/SurveyPreviewModal";
import { SurveyGuide } from "./survey/SurveyGuide";

export default function Surveys() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [previewFor, setPreviewFor] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [err, setErr] = useState("");
  const surveys = data || [];

  const run = async (fn) => {
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  const save = async (draft, id) =>
    run(async () => {
      if (id) await api.updateSurvey(id, draft);
      else await api.createSurvey(draft);
      setModal(null);
    });
  const delSurvey = async (s) => {
    const withResp = s.responses ? ` beserta ${s.responses} respons yang sudah masuk` : "";
    if (
      !(await confirmDialog({
        title: "Hapus survei",
        message: `Hapus survei "${s.title}"${withResp}? Tindakan ini permanen dan tidak bisa dibatalkan.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    run(() => api.deleteSurvey(s.id));
  };

  // Builder mengambil alih seluruh halaman — pertanyaan & pengaturannya terlalu banyak untuk modal.
  if (modal !== null)
    return (
      <SurveyBuilder
        survey={modal.id ? modal : null}
        error={err}
        onClose={() => {
          setErr("");
          setModal(null);
        }}
        onSave={(d) => save(d, modal.id)}
      />
    );

  return (
    <div>
      <PageHeader
        title="Survei"
        subtitle="Buat survei & lihat jawaban responden."
        actions={[
          <Button key="g" variant="secondary" icon="doc" onClick={() => setGuideOpen((v) => !v)}>
            {guideOpen ? "Tutup Panduan" : "Panduan"}
          </Button>,
          <Button key="r" variant="ghost" icon="refresh" onClick={reload}>
            Refresh
          </Button>,
          <Button key="n" icon="plus" onClick={() => setModal({})}>
            Buat Survei
          </Button>,
        ]}
      />
      {guideOpen ? <SurveyGuide /> : null}
      <Notice>{error || err}</Notice>
      {loading ? (
        <Loading />
      ) : surveys.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16 }}>
          {surveys.map((s) => (
            <Card
              key={s.id}
              style={{ display: "flex", flexDirection: "column" }}
              bodyStyle={{ display: "flex", flexDirection: "column", flex: 1 }}
            >
              {/* Judul memakai lebar penuh; badge turun ke bawahnya supaya judul panjang
                  tidak terdesak jadi banyak baris. */}
              <div style={{ fontWeight: 700, fontSize: 15.5, color: theme.text, lineHeight: 1.35 }}>{s.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <Badge tone={s.status === "active" ? "green" : s.status === "draft" ? "yellow" : "default"}>
                  {s.status}
                </Badge>
                {s.mode === "flow" ? <Badge tone="blue">flow</Badge> : null}
                {s.triggerEnabled ? <Badge tone="purple">bot</Badge> : null}
                {s.oncePerContact ? <Badge tone="yellow">sekali isi</Badge> : null}
              </div>
              {s.description ? (
                <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
                  {s.description}
                </div>
              ) : null}
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>
                {s.questions.length} pertanyaan • {s.responses} respons
                {s.triggerEnabled && s.triggerKeywords?.length
                  ? ` • pemicu: ${s.triggerKeywords.slice(0, 3).join(", ")}${s.triggerKeywords.length > 3 ? "…" : ""}`
                  : ""}
              </div>
              {/* marginTop auto → baris tombol menempel di dasar kartu, sejajar antar kartu */}
              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 14, flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setResponsesFor(s)}>
                  Respons ({s.responses})
                </Button>
                <Button variant="secondary" size="sm" icon="eye" onClick={() => setPreviewFor(s)}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(s)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="trash"
                  title="Hapus survei"
                  onClick={() => delSurvey(s)}
                  style={{ marginLeft: "auto" }}
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon="survey" title="Belum ada survei" note="Buat survei lalu kirim lewat Broadcast." />
        </Card>
      )}

      {responsesFor ? <ResponsesModal survey={responsesFor} onClose={() => setResponsesFor(null)} /> : null}
      {previewFor ? <SurveyPreviewModal survey={previewFor} onClose={() => setPreviewFor(null)} /> : null}
    </div>
  );
}
