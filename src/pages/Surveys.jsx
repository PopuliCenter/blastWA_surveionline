import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Notice, Loading, Empty, useLoader, theme } from "../lib/ui";
import { SurveyModal } from "./survey/SurveyModal";
import { ResponsesModal } from "./survey/ResponsesModal";
import { SurveyPreviewModal } from "./survey/SurveyPreviewModal";

export default function Surveys() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [previewFor, setPreviewFor] = useState(null);
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

  return (
    <div>
      <PageHeader
        title="Survei"
        subtitle="Buat survei & lihat jawaban responden."
        actions={[
          <Button key="r" variant="ghost" icon="refresh" onClick={reload}>
            Refresh
          </Button>,
          <Button key="n" icon="plus" onClick={() => setModal({})}>
            Buat Survei
          </Button>,
        ]}
      />
      <Notice>{error || err}</Notice>
      {loading ? (
        <Loading />
      ) : surveys.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16 }}>
          {surveys.map((s) => (
            <Card key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: theme.text }}>{s.title}</div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {s.mode === "flow" ? <Badge tone="blue">flow</Badge> : null}
                  {s.triggerEnabled ? <Badge tone="purple">bot</Badge> : null}
                  <Badge tone={s.status === "active" ? "green" : s.status === "draft" ? "yellow" : "default"}>
                    {s.status}
                  </Badge>
                </div>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>{s.description}</div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>
                {s.questions.length} pertanyaan • {s.responses} respons
                {s.triggerEnabled && s.triggerKeywords?.length
                  ? ` • pemicu: ${s.triggerKeywords.slice(0, 3).join(", ")}${s.triggerKeywords.length > 3 ? "…" : ""}`
                  : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setResponsesFor(s)}>
                  Respons ({s.responses})
                </Button>
                <Button variant="secondary" size="sm" icon="eye" onClick={() => setPreviewFor(s)}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(s)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteSurvey(s.id))} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon="survey" title="Belum ada survei" note="Buat survei lalu kirim lewat Broadcast." />
        </Card>
      )}

      {modal !== null ? (
        <SurveyModal
          survey={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(d) => save(d, modal.id)}
        />
      ) : null}
      {responsesFor ? <ResponsesModal survey={responsesFor} onClose={() => setResponsesFor(null)} /> : null}
      {previewFor ? <SurveyPreviewModal survey={previewFor} onClose={() => setPreviewFor(null)} /> : null}
    </div>
  );
}
