import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { exportResponses } from "../lib/exportSurvey";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Toggle, Modal, Notice, Loading, Empty, useLoader, useSelection, Checkbox, BulkBar, theme, fmtDate, Icon } from "../lib/ui";

export default function Surveys() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [previewFor, setPreviewFor] = useState(null);
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
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {s.mode === "flow" ? <Badge tone="blue">flow</Badge> : null}
                  {s.triggerEnabled ? <Badge tone="purple">bot</Badge> : null}
                  <Badge tone={s.status === "active" ? "green" : s.status === "draft" ? "yellow" : "default"}>{s.status}</Badge>
                </div>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>{s.description}</div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>{s.questions.length} pertanyaan • {s.responses} respons{s.triggerEnabled && s.triggerKeywords?.length ? ` • pemicu: ${s.triggerKeywords.slice(0, 3).join(", ")}${s.triggerKeywords.length > 3 ? "…" : ""}` : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setResponsesFor(s)}>Respons ({s.responses})</Button>
                <Button variant="secondary" size="sm" icon="eye" onClick={() => setPreviewFor(s)}>Preview</Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(s)}>Edit</Button>
                <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteSurvey(s.id))} />
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon="survey" title="Belum ada survei" note="Buat survei lalu kirim lewat Broadcast." /></Card>}

      {modal !== null ? <SurveyModal survey={modal.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => save(d, modal.id)} /> : null}
      {responsesFor ? <ResponsesModal survey={responsesFor} onClose={() => setResponsesFor(null)} /> : null}
      {previewFor ? <SurveyPreviewModal survey={previewFor} onClose={() => setPreviewFor(null)} /> : null}
    </div>
  );
}

const TYPE_LABEL = { text: "Teks", rating: "Rating", number: "Angka", choice: "Pilihan", boolean: "Ya/Tidak", image: "Gambar" };
const QTYPE_OPTIONS = [
  { value: "text", label: "Teks bebas" }, { value: "rating", label: "Rating (skala angka)" }, { value: "number", label: "Angka" },
  { value: "choice", label: "Pilihan ganda" }, { value: "boolean", label: "Ya / Tidak" }, { value: "image", label: "Gambar / foto" },
];

function qSummary(q) {
  if (q.type === "rating") return `skala ${q.options?.min ?? 1}-${q.options?.max ?? 5}`;
  if (q.type === "choice") return `${(q.options?.choices || []).length} pilihan`;
  return "";
}

// ── Preview: replicate surveyEngine logic client-side ──────────────────────

function previewFormatQuestion(q, idx, total) {
  const min = q.options?.min ?? 1;
  const max = q.options?.max ?? 10;
  const choices = q.options?.choices || [];
  let text = `*Pertanyaan ${idx + 1} dari ${total}*\n${q.text}`;
  if (q.type === "rating") text += `\n\n_Balas dengan angka ${min}–${max}_`;
  else if (q.type === "choice") text += "\n\n" + choices.map((c, i) => `${i + 1}. ${c}`).join("\n") + "\n\n_Balas nomor atau teks pilihan_";
  else if (q.type === "boolean") text += "\n\n_Balas: Ya / Tidak_";
  else if (q.type === "number") text += "\n\n_Balas dengan angka_";
  else if (q.type === "image") text += "\n\n_Kirim foto sebagai simulasi (ketik nama file)_";
  if (!q.required) text += "\n\n_Opsional — ketik *lewati* untuk melewati_";
  return text;
}

function previewValidate(q, answer) {
  const a = answer.trim();
  if (!q.required && /^(lewati|skip|lewat|-)$/i.test(a)) return { ok: true, saved: "[dilewati]" };
  switch (q.type) {
    case "text":
      if (!a) return { ok: false, err: "Jawaban tidak boleh kosong." };
      return { ok: true, saved: a };
    case "number": {
      const n = parseFloat(a);
      if (isNaN(n)) return { ok: false, err: "Masukkan angka yang valid." };
      return { ok: true, saved: String(n) };
    }
    case "rating": {
      const n = parseInt(a);
      const min = q.options?.min ?? 1;
      const max = q.options?.max ?? 10;
      if (isNaN(n) || n < min || n > max) return { ok: false, err: `Masukkan angka ${min}–${max}.` };
      return { ok: true, saved: String(n) };
    }
    case "choice": {
      const choices = q.options?.choices || [];
      const idx = parseInt(a) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < choices.length) return { ok: true, saved: choices[idx] };
      const match = choices.find((c) => c.toLowerCase() === a.toLowerCase());
      if (match) return { ok: true, saved: match };
      return { ok: false, err: `Pilih: ${choices.map((c, i) => `${i + 1}. ${c}`).join(" | ")}` };
    }
    case "boolean": {
      if (/^(ya|yes|y|1|iya)$/i.test(a)) return { ok: true, saved: "Ya" };
      if (/^(tidak|no|n|0|tdk|tdak)$/i.test(a)) return { ok: true, saved: "Tidak" };
      return { ok: false, err: 'Balas dengan "Ya" atau "Tidak".' };
    }
    case "image":
      if (!a) return { ok: false, err: "Ketik nama file gambar sebagai simulasi." };
      return { ok: true, saved: `[gambar] ${a}` };
    default:
      if (!a) return { ok: false, err: "Jawaban tidak boleh kosong." };
      return { ok: true, saved: a };
  }
}

function getQuickReplies(q) {
  if (!q) return [];
  if (q.type === "boolean") return ["Ya", "Tidak"];
  if (q.type === "choice") return (q.options?.choices || []).map((_, i) => String(i + 1));
  return [];
}

function inputPlaceholder(q) {
  if (!q) return "";
  if (q.type === "rating") { const min = q.options?.min ?? 1; const max = q.options?.max ?? 10; return `Angka ${min}–${max}…`; }
  if (q.type === "number") return "Ketik angka…";
  if (q.type === "boolean") return "Ya / Tidak…";
  if (q.type === "choice") return "Nomor atau teks pilihan…";
  if (q.type === "image") return "Nama file gambar (simulasi)…";
  if (!q.required) return "Jawaban atau ketik lewati…";
  return "Ketik jawaban…";
}

// Render teks dengan markdown WA: *bold* _italic_
function WaText({ text }) {
  const lines = text.split("\n");
  return (
    <span>
      {lines.map((line, li) => {
        const parts = line.split(/(\*[^*]+\*|_[^_]+_)/);
        return (
          <span key={li}>
            {li > 0 && <br />}
            {parts.map((p, pi) => {
              if (p.startsWith("*") && p.endsWith("*")) return <strong key={pi}>{p.slice(1, -1)}</strong>;
              if (p.startsWith("_") && p.endsWith("_")) return <em key={pi} style={{ color: "#666", fontSize: "0.93em" }}>{p.slice(1, -1)}</em>;
              return p;
            })}
          </span>
        );
      })}
    </span>
  );
}

function SurveyPreviewModal({ survey, onClose }) {
  const questions = survey.questions || [];
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef();

  const reset = () => {
    setStep(0); setDone(false); setAnswers([]); setInput("");
    const init = [{ from: "bot", text: survey.description ? `*${survey.title}*\n${survey.description}` : `*${survey.title}*\nSurvei dimulai.` }];
    if (questions.length) init.push({ from: "bot", text: previewFormatQuestion(questions[0], 0, questions.length) });
    else { init.push({ from: "bot", text: "Survei ini belum memiliki pertanyaan." }); setDone(true); }
    setMessages(init);
  };

  useEffect(() => { reset(); }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed || done) return;
    const q = questions[step];
    const result = previewValidate(q, trimmed);
    if (!result.ok) {
      setMessages((prev) => [...prev,
        { from: "user", text: trimmed },
        { from: "bot", text: `❌ ${result.err}\n\n${previewFormatQuestion(q, step, questions.length)}`, error: true },
      ]);
      setInput(""); return;
    }
    const newAnswers = [...answers, { question: q.text, type: q.type, value: result.saved }];
    setAnswers(newAnswers);
    const next = step + 1;
    if (next >= questions.length) {
      setMessages((prev) => [...prev,
        { from: "user", text: trimmed },
        { from: "bot", text: "✅ *Terima kasih!*\nJawaban Anda telah direkam. Survei selesai." },
      ]);
      setDone(true);
    } else {
      setMessages((prev) => [...prev,
        { from: "user", text: trimmed },
        { from: "bot", text: previewFormatQuestion(questions[next], next, questions.length) },
      ]);
      setStep(next);
    }
    setInput("");
  };

  const currentQ = !done && step < questions.length ? questions[step] : null;
  const quickReplies = getQuickReplies(currentQ);
  const progress = questions.length ? (done ? 1 : step / questions.length) : 1;

  return (
    <Modal title="" onClose={onClose} width={480}>
      {/* WA-style header */}
      <div style={{ margin: "-20px -20px 0", background: "#075E54", borderRadius: "12px 12px 0 0", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="survey" size={18} style={{ color: "#fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{survey.title}</div>
          <div style={{ color: "#b2dfdb", fontSize: 11.5 }}>Simulasi preview survei</div>
        </div>
        <Badge tone={survey.status === "active" ? "green" : "yellow"}>{survey.status}</Badge>
      </div>

      {/* Progress bar */}
      <div style={{ margin: "0 -20px", height: 3, background: "#e0e0e0" }}>
        <div style={{ height: "100%", background: "#25D366", width: `${progress * 100}%`, transition: "width 0.4s ease" }} />
      </div>

      {/* Chat area */}
      <div style={{ height: 360, overflowY: "auto", background: "#ECE5DD", margin: "0 -20px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", fontSize: 13.5, lineHeight: 1.5,
              background: m.from === "user" ? "#DCF8C6" : "#fff",
              borderRadius: m.from === "user" ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
              padding: "8px 12px",
              boxShadow: "0 1px 2px rgba(0,0,0,.15)",
              borderLeft: m.error ? "3px solid #ef4444" : "none",
            }}>
              <WaText text={m.text} />
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick reply chips */}
      {quickReplies.length > 0 && !done && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "10px 0 4px" }}>
          {quickReplies.map((r, i) => (
            <button key={i} onClick={() => send(r)} style={{
              padding: "5px 14px", background: "#fff", color: "#075E54",
              border: "1.5px solid #075E54", borderRadius: 20, fontSize: 12.5,
              cursor: "pointer", fontWeight: 600, transition: "background 0.15s",
            }} onMouseOver={(e) => e.target.style.background = "#e8f5e9"} onMouseOut={(e) => e.target.style.background = "#fff"}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ display: "flex", gap: 8, marginTop: quickReplies.length ? 4 : 12, alignItems: "center" }}>
        {!done ? (
          <>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={inputPlaceholder(currentQ)}
              style={{ flex: 1, padding: "9px 14px", border: `1.5px solid ${theme.border}`, borderRadius: 22, fontSize: 13.5, outline: "none", background: "#fff" }}
            />
            <button onClick={() => send(input)} disabled={!input.trim()} style={{
              width: 38, height: 38, borderRadius: "50%", border: "none", cursor: input.trim() ? "pointer" : "default",
              background: input.trim() ? "#25D366" : "#ccc", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name="send" size={15} />
            </button>
          </>
        ) : (
          <button onClick={reset} style={{ flex: 1, padding: "9px", background: "#075E54", color: "#fff", border: "none", borderRadius: 22, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Ulangi Preview
          </button>
        )}
      </div>

      {/* Answer summary after completion */}
      {done && answers.length > 0 && (
        <div style={{ marginTop: 16, background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.text, display: "flex", alignItems: "center", gap: 7 }}>
            <Icon name="survey" size={15} />
            Ringkasan Jawaban ({answers.length}/{questions.length})
          </div>
          {answers.map((a, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${a.value === "[dilewati]" ? theme.border : theme.green}`, paddingLeft: 10, marginBottom: 9 }}>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 2 }}>{a.question} <Badge tone="blue">{TYPE_LABEL[a.type] || a.type}</Badge></div>
              <div style={{ fontSize: 13.5, color: a.value === "[dilewati]" ? theme.textMuted : theme.text, fontStyle: a.value === "[dilewati]" ? "italic" : "normal" }}>{a.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </Modal>
  );
}

function SurveyModal({ survey, onClose, onSave }) {
  const [title, setTitle] = useState(survey?.title || "");
  const [description, setDescription] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questions, setQuestions] = useState(() => (survey?.questions || []).map((q) => ({ ...q, required: q.required ?? true })));
  const [triggerEnabled, setTriggerEnabled] = useState(survey?.triggerEnabled ?? false);
  const [triggerKeywords, setTriggerKeywords] = useState(survey?.triggerKeywords || []);
  const [kwInput, setKwInput] = useState("");
  const [mode, setMode] = useState(survey?.mode || "chat");
  const [flowId, setFlowId] = useState(survey?.flowId || "");
  const [flowCta, setFlowCta] = useState(survey?.flowCta || "Isi Survei");
  const [flowJsonOpen, setFlowJsonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [c, setC] = useState({ text: "", type: "text", required: true, min: 1, max: 5, choices: "" });
  const setCk = (k, v) => setC({ ...c, [k]: v });

  const addKeywords = (raw) => {
    const parts = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const merged = [...triggerKeywords];
    for (const p of parts) if (!merged.some((k) => k.toLowerCase() === p.toLowerCase())) merged.push(p);
    setTriggerKeywords(merged);
    setKwInput("");
  };
  const removeKeyword = (kw) => setTriggerKeywords(triggerKeywords.filter((k) => k !== kw));

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
    try { await onSave({ title, description, status, triggerEnabled, triggerKeywords, mode, flowId: mode === "flow" ? flowId.trim() : null, flowCta: mode === "flow" ? (flowCta.trim() || "Isi Survei") : null, questions: questions.map((q) => ({ id: typeof q.id === "string" && !q.id.startsWith("t") ? q.id : undefined, text: q.text, type: q.type || "text", required: q.required ?? true, options: q.options })) }); }
    finally { setSaving(false); }
  };

  // Mode Flow tidak mendukung tipe "Gambar" → sembunyikan agar tidak salah pilih.
  const qtypeOptions = mode === "flow" ? QTYPE_OPTIONS.filter((o) => o.value !== "image") : QTYPE_OPTIONS;

  return (
    <>
    <Modal title={survey ? "Edit Survei" : "Buat Survei"} onClose={onClose} width={680}>
      <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Aktif" }, { value: "closed", label: "Ditutup" }]} />

      {/* Mode survei: chat vs WhatsApp Flow */}
      <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <Select label="Mode pengisian survei" value={mode} onChange={(e) => { const m = e.target.value; setMode(m); if (m === "flow" && c.type === "image") setCk("type", "text"); }} options={[
          { value: "chat", label: "Chatbot — tanya-jawab per pesan (semua jalur: Meta/Qontak/Baileys)" },
          { value: "flow", label: "WhatsApp Flow — formulir 1 layar (khusus Meta Cloud API)" },
        ]} />
        {mode === "flow" ? (
          <>
            <Input label="Flow ID (dari Meta)" value={flowId} onChange={(e) => setFlowId(e.target.value)} placeholder="cth: 1234567890123456" hint="ID Flow yang sudah diterbitkan di WhatsApp Manager. Lihat langkah lewat tombol di bawah." />
            <Input label="Teks tombol pembuka (CTA)" value={flowCta} onChange={(e) => setFlowCta(e.target.value)} placeholder="Isi Survei" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="secondary" size="sm" icon="download" onClick={() => survey?.id ? setFlowJsonOpen(true) : null} disabled={!survey?.id}>Lihat / Salin Flow JSON</Button>
              {!survey?.id ? <span style={{ fontSize: 11.5, color: theme.textMuted }}>Simpan survei dulu agar Flow JSON memakai ID pertanyaan final.</span> : null}
            </div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              Alur: simpan survei → salin Flow JSON → tempel di <strong>Meta WhatsApp Manager › Flows › buat Flow</strong> → terbitkan → salin <strong>Flow ID</strong> ke sini. Tipe <strong>Gambar</strong> tidak didukung di Flow (dilewati).
            </div>
          </>
        ) : null}
      </div>

      {/* Pemicu otomatis (bot) */}
      <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: triggerEnabled ? 12 : 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>Pemicu otomatis (bot)</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>Survei dimulai otomatis saat pesan masuk cocok kata kunci.</div>
          </div>
          <Toggle checked={triggerEnabled} onChange={setTriggerEnabled} />
        </div>
        {triggerEnabled ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
              {triggerKeywords.map((kw) => (
                <span key={kw} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: theme.primarySoft, color: theme.primary, borderRadius: 999, padding: "4px 10px", fontSize: 12.5, fontWeight: 600 }}>
                  {kw}
                  <button onClick={() => removeKeyword(kw)} style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.primary, display: "flex", padding: 0 }}><Icon name="close" size={13} /></button>
                </span>
              ))}
              {!triggerKeywords.length ? <span style={{ fontSize: 12, color: theme.textMuted }}>Belum ada kata kunci.</span> : null}
            </div>
            <input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeywords(kwInput); } }}
              onBlur={() => addKeywords(kwInput)}
              placeholder="cth: isi survey, survei, mulai survei"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: theme.surface }}
            />
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 5 }}>Pisahkan dengan koma (,) atau Enter. Survei harus berstatus <strong>Aktif</strong> agar pemicu berfungsi.</div>
          </>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 7, marginBottom: 14 }}>
        {questions.length ? <div style={{ fontSize: 11.5, color: theme.textMuted, fontWeight: 600 }}>{questions.length} pertanyaan — klik ikon pensil untuk mengedit.</div> : null}
        {questions.map((q, i) => (
          <QuestionItem
            key={q.id || i}
            q={q}
            index={i}
            total={questions.length}
            qtypeOptions={qtypeOptions}
            onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))}
            onDelete={() => setQuestions(questions.filter((_, j) => j !== i))}
            onMove={(dir) => {
              const j = i + dir;
              if (j < 0 || j >= questions.length) return;
              const arr = [...questions];
              [arr[i], arr[j]] = [arr[j], arr[i]];
              setQuestions(arr);
            }}
          />
        ))}
      </div>

      <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: theme.text }}>Tambah Pertanyaan</div>
        <Input label="Teks pertanyaan" value={c.text} onChange={(e) => setCk("text", e.target.value)} placeholder="cth: Seberapa puas Anda?" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <Select label="Tipe jawaban" value={c.type} onChange={(e) => setCk("type", e.target.value)} options={qtypeOptions} />
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
    {flowJsonOpen && survey?.id ? <FlowJsonModal surveyId={survey.id} onClose={() => setFlowJsonOpen(false)} /> : null}
    </>
  );
}

function FlowJsonModal({ surveyId, onClose }) {
  const { data, loading, error } = useLoader(useCallback(() => api.surveyFlowJson(surveyId), [surveyId]));
  const [copied, setCopied] = useState(false);
  const json = data ? JSON.stringify(data, null, 2) : "";
  const copy = async () => { try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "survey-flow.json"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal title="Flow JSON untuk Meta" onClose={onClose} width={640}>
      <Notice>{error}</Notice>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        Salin JSON ini → buka <strong>Meta WhatsApp Manager › Flows › Create Flow › Editor (JSON)</strong> → tempel → <strong>Publish</strong> → salin <strong>Flow ID</strong> kembali ke kolom di editor survei.
      </div>
      {loading ? <Loading /> : (
        <>
          <textarea readOnly value={json} style={{ width: "100%", height: 280, fontFamily: "monospace", fontSize: 11.5, padding: 12, border: `1px solid ${theme.border}`, borderRadius: 9, boxSizing: "border-box", outline: "none", background: theme.surfaceAlt, color: theme.text, resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Button variant="secondary" icon={copied ? "check" : "download"} onClick={copy}>{copied ? "Disalin" : "Salin JSON"}</Button>
            <Button variant="secondary" icon="download" onClick={download}>Unduh .json</Button>
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Satu pertanyaan: mode lihat (bisa naik/turun, edit, hapus) & mode edit inline.
function QuestionItem({ q, index, total, onChange, onDelete, onMove, qtypeOptions = QTYPE_OPTIONS }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(null);
  const setDk = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const startEdit = () => {
    setD({ text: q.text || "", type: q.type || "text", required: q.required ?? true, min: q.options?.min ?? 1, max: q.options?.max ?? 5, choices: (q.options?.choices || []).join("\n") });
    setEditing(true);
  };
  const saveEdit = () => {
    let options;
    if (d.type === "rating") options = { min: Number(d.min) || 1, max: Number(d.max) || 5 };
    if (d.type === "choice") options = { choices: d.choices.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) };
    onChange({ ...q, text: d.text.trim(), type: d.type, required: d.required, options });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ background: theme.surface, border: `1.5px solid ${theme.primary}`, borderRadius: 9, padding: 12 }}>
        <Input label={`Pertanyaan ${index + 1}`} value={d.text} onChange={(e) => setDk("text", e.target.value)} placeholder="Teks pertanyaan" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <Select label="Tipe jawaban" value={d.type} onChange={(e) => setDk("type", e.target.value)} options={qtypeOptions} />
          <div style={{ marginBottom: 14 }}><Toggle checked={d.required} onChange={(v) => setDk("required", v)} label="Wajib" /></div>
        </div>
        {d.type === "rating" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Nilai minimum" type="number" value={d.min} onChange={(e) => setDk("min", e.target.value)} />
            <Input label="Nilai maksimum" type="number" value={d.max} onChange={(e) => setDk("max", e.target.value)} />
          </div>
        ) : null}
        {d.type === "choice" ? (
          <Textarea label="Pilihan (satu per baris atau pisah koma)" value={d.choices} onChange={(e) => setDk("choices", e.target.value)} placeholder={"Sangat puas\nPuas\nBiasa\nTidak puas"} />
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Batal</Button>
          <Button size="sm" icon="check" onClick={saveEdit} disabled={!d.text.trim()}>Simpan Pertanyaan</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div style={{ fontSize: 13, color: theme.text, minWidth: 0 }}>
        {index + 1}. {q.text}
        <span style={{ marginLeft: 8 }}><Badge tone="blue">{TYPE_LABEL[q.type] || q.type}</Badge></span>
        {qSummary(q) ? <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>{qSummary(q)}</span> : null}
        {!q.required ? <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>• opsional</span> : null}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" icon="up" onClick={() => onMove(-1)} disabled={index === 0} title="Naikkan" />
        <Button variant="ghost" size="sm" icon="down" onClick={() => onMove(1)} disabled={index === total - 1} title="Turunkan" />
        <Button variant="secondary" size="sm" icon="edit" onClick={startEdit} title="Edit" />
        <Button variant="danger" size="sm" icon="trash" onClick={onDelete} title="Hapus" />
      </div>
    </div>
  );
}

function ResponsesModal({ survey, onClose }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.surveyResponses(survey.id), [survey.id]));
  const responses = data || [];
  const [upper, setUpper] = useState(false);
  const sel = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  const bulkDelete = async () => {
    if (!sel.size || !window.confirm(`Hapus ${sel.size} responden terpilih? Jawaban mereka ikut terhapus permanen.`)) return;
    setBulkBusy(true); setDelErr("");
    try { await api.bulkDeleteResponses(sel.list()); sel.clear(); await reload(); } catch (e) { setDelErr(e.message); } finally { setBulkBusy(false); }
  };
  return (
    <Modal title={`Respons: ${survey.title}`} onClose={onClose} width={760}>
      <Notice>{error || delErr}</Notice>
      <BulkBar count={sel.size} total={responses.length} allSelected={responses.length > 0 && responses.every((r) => sel.has(r.id))} noun="responden" busy={bulkBusy}
        onToggleAll={() => responses.every((r) => sel.has(r.id)) ? sel.clear() : sel.setAll(responses.map((r) => r.id))}
        onClear={sel.clear} onDelete={bulkDelete} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>{responses.length} responden{responses.length ? ` • ${responses.filter((r) => r.completedAt).length} selesai` : ""}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: theme.textMuted, cursor: "pointer" }} title="Ubah semua nilai jadi huruf kapital saat ekspor">
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> HURUF KAPITAL
          </label>
          <Button variant="secondary" size="sm" icon="download" onClick={() => exportResponses(survey, responses, "xlsx", { upper })} disabled={!responses.length}>Export Excel</Button>
          <Button variant="secondary" size="sm" icon="download" onClick={() => exportResponses(survey, responses, "csv", { upper })} disabled={!responses.length}>CSV</Button>
        </div>
      </div>
      {loading ? <Loading /> : responses.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {responses.map((r) => (
            <div key={r.id} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, outline: sel.has(r.id) ? `2px solid ${theme.primary}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Checkbox checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} />
                  <strong style={{ color: theme.text }}>{r.name || r.phone}</strong>
                </div>
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
