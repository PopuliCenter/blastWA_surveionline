import { useState } from "react";
import { Button, Input, Textarea, Select, Toggle, Modal, theme, Icon } from "../../lib/ui";
import { QTYPE_OPTIONS, HAS_CHOICES } from "./constants";
import { QuestionItem } from "./QuestionItem";
import { FlowJsonModal } from "./FlowJsonModal";

export function SurveyModal({ survey, onClose, onSave }) {
  const [title, setTitle] = useState(survey?.title || "");
  const [description, setDescription] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questions, setQuestions] = useState(() =>
    (survey?.questions || []).map((q) => ({ ...q, required: q.required ?? true })),
  );
  const [triggerEnabled, setTriggerEnabled] = useState(survey?.triggerEnabled ?? false);
  const [triggerKeywords, setTriggerKeywords] = useState(survey?.triggerKeywords || []);
  const [kwInput, setKwInput] = useState("");
  const [mode, setMode] = useState(survey?.mode || "chat");
  const [flowId, setFlowId] = useState(survey?.flowId || "");
  const [flowCta, setFlowCta] = useState(survey?.flowCta || "Isi Survei");
  const [closingMessage, setClosingMessage] = useState(survey?.closingMessage || "");
  const [flowJsonOpen, setFlowJsonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [c, setC] = useState({
    text: "",
    type: "text",
    required: true,
    min: 1,
    max: 5,
    minLabel: "",
    maxLabel: "",
    choices: "",
  });
  const setCk = (k, v) => setC({ ...c, [k]: v });

  const addKeywords = (raw) => {
    const parts = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
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
    if (c.type === "rating") {
      options = { min: Number(c.min) || 1, max: Number(c.max) || 5 };
      if (c.minLabel.trim() || c.maxLabel.trim())
        options = { ...options, minLabel: c.minLabel.trim(), maxLabel: c.maxLabel.trim() };
    }
    if (HAS_CHOICES(c.type))
      options = {
        choices: c.choices
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    setQuestions([
      ...questions,
      { id: `t${Date.now()}`, text: c.text.trim(), type: c.type, required: c.required, options },
    ]);
    setC({ text: "", type: "text", required: true, min: 1, max: 5, minLabel: "", maxLabel: "", choices: "" });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        status,
        triggerEnabled,
        triggerKeywords,
        mode,
        flowId: mode === "flow" ? flowId.trim() : null,
        flowCta: mode === "flow" ? flowCta.trim() || "Isi Survei" : null,
        closingMessage: closingMessage.trim() || null,
        questions: questions.map((q) => ({
          id: typeof q.id === "string" && !q.id.startsWith("t") ? q.id : undefined,
          text: q.text,
          type: q.type || "text",
          required: q.required ?? true,
          options: q.options,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  // Mode Flow tidak mendukung tipe "Gambar" → sembunyikan agar tidak salah pilih.
  const qtypeOptions = mode === "flow" ? QTYPE_OPTIONS.filter((o) => o.value !== "image") : QTYPE_OPTIONS;

  return (
    <>
      <Modal title={survey ? "Edit Survei" : "Buat Survei"} onClose={onClose} width={680}>
        <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "draft", label: "Draft" },
            { value: "active", label: "Aktif" },
            { value: "closed", label: "Ditutup" },
          ]}
        />

        {/* Mode survei: chat vs WhatsApp Flow */}
        <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <Select
            label="Mode pengisian survei"
            value={mode}
            onChange={(e) => {
              const m = e.target.value;
              setMode(m);
              if (m === "flow" && c.type === "image") setCk("type", "text");
            }}
            options={[
              { value: "chat", label: "Chatbot — tanya-jawab per pesan (semua jalur: Meta/Qontak/Baileys)" },
              { value: "flow", label: "WhatsApp Flow — formulir 1 layar (khusus Meta Cloud API)" },
            ]}
          />
          {mode === "flow" ? (
            <>
              <Input
                label="Flow ID (dari Meta)"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                placeholder="cth: 1234567890123456"
                hint="ID Flow yang sudah diterbitkan di WhatsApp Manager. Lihat langkah lewat tombol di bawah."
              />
              <Input
                label="Teks tombol pembuka (CTA)"
                value={flowCta}
                onChange={(e) => setFlowCta(e.target.value)}
                placeholder="Isi Survei"
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="download"
                  onClick={() => (survey?.id ? setFlowJsonOpen(true) : null)}
                  disabled={!survey?.id}
                >
                  Lihat / Salin Flow JSON
                </Button>
                {!survey?.id ? (
                  <span style={{ fontSize: 11.5, color: theme.textMuted }}>
                    Simpan survei dulu agar Flow JSON memakai ID pertanyaan final.
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                Alur: simpan survei → salin Flow JSON → tempel di{" "}
                <strong>Meta WhatsApp Manager › Flows › buat Flow</strong> → terbitkan → salin <strong>Flow ID</strong>{" "}
                ke sini. Tipe <strong>Gambar</strong> tidak didukung di Flow (dilewati).
              </div>
            </>
          ) : null}
        </div>

        {/* Pemicu otomatis (bot) */}
        <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: triggerEnabled ? 12 : 0,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>Pemicu otomatis (bot)</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                Survei dimulai otomatis saat pesan masuk cocok kata kunci.
              </div>
            </div>
            <Toggle checked={triggerEnabled} onChange={setTriggerEnabled} />
          </div>
          {triggerEnabled ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
                {triggerKeywords.map((kw) => (
                  <span
                    key={kw}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: theme.primarySoft,
                      color: theme.primary,
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: theme.primary,
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
                {!triggerKeywords.length ? (
                  <span style={{ fontSize: 12, color: theme.textMuted }}>Belum ada kata kunci.</span>
                ) : null}
              </div>
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addKeywords(kwInput);
                  }
                }}
                onBlur={() => addKeywords(kwInput)}
                placeholder="cth: isi survey, survei, mulai survei"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 9,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: theme.surface,
                }}
              />
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 5 }}>
                Pisahkan dengan koma (,) atau Enter. Survei harus berstatus <strong>Aktif</strong> agar pemicu
                berfungsi.
              </div>
            </>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 7, marginBottom: 14 }}>
          {questions.length ? (
            <div style={{ fontSize: 11.5, color: theme.textMuted, fontWeight: 600 }}>
              {questions.length} pertanyaan — klik ikon pensil untuk mengedit.
            </div>
          ) : null}
          {questions.map((q, i) => (
            <QuestionItem
              key={q.id || i}
              q={q}
              index={i}
              total={questions.length}
              qtypeOptions={qtypeOptions}
              allQuestions={questions}
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
          <Input
            label="Teks pertanyaan"
            value={c.text}
            onChange={(e) => setCk("text", e.target.value)}
            placeholder="cth: Seberapa puas Anda?"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
            <Select
              label="Tipe jawaban"
              value={c.type}
              onChange={(e) => setCk("type", e.target.value)}
              options={qtypeOptions}
            />
            <div style={{ marginBottom: 14 }}>
              <Toggle checked={c.required} onChange={(v) => setCk("required", v)} label="Wajib" />
            </div>
          </div>
          {c.type === "rating" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input
                  label="Nilai minimum"
                  type="number"
                  value={c.min}
                  onChange={(e) => setCk("min", e.target.value)}
                />
                <Input
                  label="Nilai maksimum"
                  type="number"
                  value={c.max}
                  onChange={(e) => setCk("max", e.target.value)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input
                  label="Label minimum (opsional)"
                  value={c.minLabel}
                  onChange={(e) => setCk("minLabel", e.target.value)}
                  placeholder="cth: Sangat tidak puas"
                />
                <Input
                  label="Label maksimum (opsional)"
                  value={c.maxLabel}
                  onChange={(e) => setCk("maxLabel", e.target.value)}
                  placeholder="cth: Sangat puas"
                />
              </div>
            </>
          ) : null}
          {HAS_CHOICES(c.type) ? (
            <Textarea
              label={
                c.type === "multichoice"
                  ? "Pilihan (boleh dipilih >1; satu per baris atau pisah koma)"
                  : "Pilihan (satu per baris atau pisah koma)"
              }
              value={c.choices}
              onChange={(e) => setCk("choices", e.target.value)}
              placeholder={"Sangat puas\nPuas\nBiasa\nTidak puas"}
            />
          ) : null}
          <Button icon="plus" onClick={addQuestion} disabled={!c.text.trim()}>
            Tambah Pertanyaan
          </Button>
        </div>

        <div style={{ marginTop: 14 }}>
          <Textarea
            label="Kata penutup (opsional)"
            value={closingMessage}
            onChange={(e) => setClosingMessage(e.target.value)}
            placeholder="Terima kasih, semua jawaban Anda sudah kami terima. 🙏"
            hint="Pesan yang dikirim saat responden menyelesaikan survei. Kosongkan untuk pakai teks default."
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </Modal>
      {flowJsonOpen && survey?.id ? (
        <FlowJsonModal surveyId={survey.id} onClose={() => setFlowJsonOpen(false)} />
      ) : null}
    </>
  );
}
