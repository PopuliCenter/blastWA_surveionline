import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Toggle, Modal, Notice, Loading, Empty, useLoader, theme, fmtDate } from "../lib/ui";

export default function Surveys() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [err, setErr] = useState("");
  const surveys = data || [];

  const run = async (fn) => { setErr(""); try { await fn(); await reload(); } catch (e) { setErr(e.message); } };
  const save = async (draft, id) => run(async () => { if (id) await api.updateSurvey(id, draft); else await api.createSurvey(draft); setModal(null); });

  return (
    <div>
      <PageHeader title="Survei" subtitle="Buat survei & lihat jawaban responden." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
        <Button key="n" icon="plus" onClick={() => setModal({})}>Buat Survei</Button>,
      ]} />
      <Notice>{error || err}</Notice>
      {loading ? <Loading /> : surveys.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16 }}>
          {surveys.map((s) => (
            <Card key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: theme.text }}>{s.title}</div>
                <Badge tone={s.status === "active" ? "green" : s.status === "draft" ? "yellow" : "default"}>{s.status}</Badge>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>{s.description}</div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>{s.questions.length} pertanyaan • {s.responses} respons</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setResponsesFor(s)}>Respons ({s.responses})</Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(s)}>Edit</Button>
                <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteSurvey(s.id))} />
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon="survey" title="Belum ada survei" note="Buat survei lalu kirim lewat Broadcast." /></Card>}

      {modal !== null ? <SurveyModal survey={modal.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => save(d, modal.id)} /> : null}
      {responsesFor ? <ResponsesModal survey={responsesFor} onClose={() => setResponsesFor(null)} /> : null}
    </div>
  );
}

const TYPE_LABEL = { text: "Teks", rating: "Rating", number: "Angka", choice: "Pilihan", boolean: "Ya/Tidak", image: "Gambar" };

function qSummary(q) {
  if (q.type === "rating") return `skala ${q.options?.min ?? 1}-${q.options?.max ?? 5}`;
  if (q.type === "choice") return `${(q.options?.choices || []).length} pilihan`;
  return "";
}

function SurveyModal({ survey, onClose, onSave }) {
  const [title, setTitle] = useState(survey?.title || "");
  const [description, setDescription] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questions, setQuestions] = useState(() => (survey?.questions || []).map((q) => ({ ...q, required: q.required ?? true })));
  const [saving, setSaving] = useState(false);

  // composer
  const [c, setC] = useState({ text: "", type: "text", required: true, min: 1, max: 5, choices: "" });
  const setCk = (k, v) => setC({ ...c, [k]: v });

  const addQuestion = () => {
    if (!c.text.trim()) return;
    let options;
    if (c.type === "rating") options = { min: Number(c.min) || 1, max: Number(c.max) || 5 };
    if (c.type === "choice") options = { choices: c.choices.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) };
    setQuestions([...questions, { id: `t${Date.now()}`, text: c.text.trim(), type: c.type, required: c.required, options }]);
    setC({ text: "", type: "text", required: true, min: 1, max: 5, choices: "" });
  };

  const submit = async () => {
    setSaving(true);
    try { await onSave({ title, description, status, questions: questions.map((q) => ({ text: q.text, type: q.type || "text", required: q.required ?? true, options: q.options })) }); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={survey ? "Edit Survei" : "Buat Survei"} onClose={onClose} width={680}>
      <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Aktif" }, { value: "closed", label: "Ditutup" }]} />

      {/* Daftar pertanyaan */}
      <div style={{ display: "grid", gap: 7, marginBottom: 14 }}>
        {questions.map((q, i) => (
          <div key={q.id || i} style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: theme.text }}>
              {i + 1}. {q.text}
              <span style={{ marginLeft: 8 }}><Badge tone="blue">{TYPE_LABEL[q.type] || q.type}</Badge></span>
              {qSummary(q) ? <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>{qSummary(q)}</span> : null}
              {!q.required ? <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>• opsional</span> : null}
            </div>
            <Button variant="danger" size="sm" icon="trash" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>

      {/* Composer pertanyaan baru */}
      <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: theme.text }}>Tambah Pertanyaan</div>
        <Input label="Teks pertanyaan" value={c.text} onChange={(e) => setCk("text", e.target.value)} placeholder="cth: Seberapa puas Anda?" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <Select label="Tipe jawaban" value={c.type} onChange={(e) => setCk("type", e.target.value)} options={[
            { value: "text", label: "Teks bebas" }, { value: "rating", label: "Rating (skala angka)" }, { value: "number", label: "Angka" },
            { value: "choice", label: "Pilihan ganda" }, { value: "boolean", label: "Ya / Tidak" }, { value: "image", label: "Gambar / foto" },
          ]} />
          <div style={{ marginBottom: 14 }}><Toggle checked={c.required} onChange={(v) => setCk("required", v)} label="Wajib" /></div>
        </div>
        {c.type === "rating" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Nilai minimum" type="number" value={c.min} onChange={(e) => setCk("min", e.target.value)} />
            <Input label="Nilai maksimum" type="number" value={c.max} onChange={(e) => setCk("max", e.target.value)} />
          </div>
        ) : null}
        {c.type === "choice" ? (
          <Textarea label="Pilihan (satu per baris atau pisah koma)" value={c.choices} onChange={(e) => setCk("choices", e.target.value)} placeholder={"Sangat puas\nPuas\nBiasa\nTidak puas"} />
        ) : null}
        <Button icon="plus" onClick={addQuestion} disabled={!c.text.trim()}>Tambah Pertanyaan</Button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!title.trim() || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}

function ResponsesModal({ survey, onClose }) {
  const { data, loading, error } = useLoader(useCallback(() => api.surveyResponses(survey.id), [survey.id]));
  const responses = data || [];
  return (
    <Modal title={`Respons: ${survey.title}`} onClose={onClose} width={760}>
      <Notice>{error}</Notice>
      {loading ? <Loading /> : responses.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {responses.map((r) => (
            <div key={r.id} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ color: theme.text }}>{r.name || r.phone}</strong>
                <Badge tone={r.completedAt ? "green" : "yellow"}>{r.completedAt ? "selesai" : "berlangsung"}</Badge>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 10 }}>{r.phone} • {fmtDate(r.startedAt)}</div>
              {r.answers.length ? r.answers.map((a, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${theme.green}`, paddingLeft: 11, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{a.question}</div>
                  <div style={{ fontSize: 14, color: theme.text }}>{a.value}</div>
                </div>
              )) : <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada jawaban.</div>}
            </div>
          ))}
        </div>
      ) : <Empty icon="survey" title="Belum ada respons" />}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><Button variant="ghost" onClick={onClose}>Tutup</Button></div>
    </Modal>
  );
}
