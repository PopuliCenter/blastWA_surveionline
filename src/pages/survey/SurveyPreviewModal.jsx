import { useEffect, useRef, useState } from "react";
import {
  formatQuestion as previewFormatQuestion,
  validateAnswer as previewValidate,
  nextStep as previewNextStep,
  quickReplies as getQuickReplies,
  inputPlaceholder,
} from "../../lib/surveyPreview";
import { Button, Badge, Modal, theme, Icon } from "../../lib/ui";
import { TYPE_LABEL } from "./constants";
import { WaText } from "./WaText";

export function SurveyPreviewModal({ survey, onClose }) {
  const questions = survey.questions || [];
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef();

  const reset = () => {
    setStep(0);
    setDone(false);
    setAnswers([]);
    setInput("");
    const init = [
      {
        from: "bot",
        text: survey.description ? `*${survey.title}*\n${survey.description}` : `*${survey.title}*\nSurvei dimulai.`,
      },
    ];
    if (questions.length) init.push({ from: "bot", text: previewFormatQuestion(questions[0], 0, questions.length) });
    else {
      init.push({ from: "bot", text: "Survei ini belum memiliki pertanyaan." });
      setDone(true);
    }
    setMessages(init);
  };

  useEffect(() => {
    reset();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed || done) return;
    const q = questions[step];
    const result = previewValidate(q, trimmed);
    if (!result.ok) {
      setMessages((prev) => [
        ...prev,
        { from: "user", text: trimmed },
        { from: "bot", text: `❌ ${result.err}\n\n${previewFormatQuestion(q, step, questions.length)}`, error: true },
      ]);
      setInput("");
      return;
    }
    const newAnswers = [...answers, { question: q.text, type: q.type, value: result.saved }];
    setAnswers(newAnswers);
    // Terapkan skip-logic (branches) persis seperti backend — preview tak lagi menyimpang.
    const next = previewNextStep(q, step, result.saved, questions.length);
    if (next >= questions.length) {
      setMessages((prev) => [
        ...prev,
        { from: "user", text: trimmed },
        { from: "bot", text: "✅ *Terima kasih!*\nJawaban Anda telah direkam. Survei selesai." },
      ]);
      setDone(true);
    } else {
      setMessages((prev) => [
        ...prev,
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
      <div
        style={{
          margin: "-20px -20px 0",
          background: "#075E54",
          borderRadius: "12px 12px 0 0",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#25D366",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="survey" size={18} style={{ color: "#fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 14.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {survey.title}
          </div>
          <div style={{ color: "#b2dfdb", fontSize: 11.5 }}>Simulasi preview survei</div>
        </div>
        <Badge tone={survey.status === "active" ? "green" : "yellow"}>{survey.status}</Badge>
      </div>

      {/* Progress bar */}
      <div style={{ margin: "0 -20px", height: 3, background: "#e0e0e0" }}>
        <div
          style={{ height: "100%", background: "#25D366", width: `${progress * 100}%`, transition: "width 0.4s ease" }}
        />
      </div>

      {/* Chat area */}
      <div
        style={{
          height: 360,
          overflowY: "auto",
          background: "#ECE5DD",
          margin: "0 -20px",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "80%",
                fontSize: 13.5,
                lineHeight: 1.5,
                background: m.from === "user" ? "#DCF8C6" : "#fff",
                borderRadius: m.from === "user" ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                padding: "8px 12px",
                boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                borderLeft: m.error ? "3px solid #ef4444" : "none",
              }}
            >
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
            <button
              key={i}
              onClick={() => send(r)}
              style={{
                padding: "5px 14px",
                background: "#fff",
                color: "#075E54",
                border: "1.5px solid #075E54",
                borderRadius: 20,
                fontSize: 12.5,
                cursor: "pointer",
                fontWeight: 600,
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => (e.target.style.background = "#e8f5e9")}
              onMouseOut={(e) => (e.target.style.background = "#fff")}
            >
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={inputPlaceholder(currentQ)}
              style={{
                flex: 1,
                padding: "9px 14px",
                border: `1.5px solid ${theme.border}`,
                borderRadius: 22,
                fontSize: 13.5,
                outline: "none",
                background: "#fff",
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                background: input.trim() ? "#25D366" : "#ccc",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="send" size={15} />
            </button>
          </>
        ) : (
          <button
            onClick={reset}
            style={{
              flex: 1,
              padding: "9px",
              background: "#075E54",
              color: "#fff",
              border: "none",
              borderRadius: 22,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ulangi Preview
          </button>
        )}
      </div>

      {/* Answer summary after completion */}
      {done && answers.length > 0 && (
        <div style={{ marginTop: 16, background: theme.surfaceAlt, borderRadius: 10, padding: 14 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 10,
              color: theme.text,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Icon name="survey" size={15} />
            Ringkasan Jawaban ({answers.length}/{questions.length})
          </div>
          {answers.map((a, i) => (
            <div
              key={i}
              style={{
                borderLeft: `3px solid ${a.value === "[dilewati]" ? theme.border : theme.green}`,
                paddingLeft: 10,
                marginBottom: 9,
              }}
            >
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 2 }}>
                {a.question} <Badge tone="blue">{TYPE_LABEL[a.type] || a.type}</Badge>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: a.value === "[dilewati]" ? theme.textMuted : theme.text,
                  fontStyle: a.value === "[dilewati]" ? "italic" : "normal",
                }}
              >
                {a.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
