import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiBase, getToken, setToken } from "./lib/api";

const theme = {
  bg: "#07111f",
  panel: "#101c2d",
  panelAlt: "#162537",
  border: "#24364c",
  text: "#eef4fb",
  textMuted: "#90a4bc",
  green: "#25D366",
  blue: "#3b82f6",
  yellow: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
};

const shellStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #08111f 0%, #0d1728 100%)",
  color: theme.text,
  fontFamily: "'Segoe UI', sans-serif",
};

const panelStyle = {
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 16,
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
};

function timestamp() {
  return new Date().toLocaleString("id-ID");
}

function Icon({ name }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    dashboard: <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="4" /><rect x="14" y="10" width="7" height="11" /><rect x="3" y="13" width="7" height="8" /></svg>,
    survey: <svg {...common}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>,
    blast: <svg {...common}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
    report: <svg {...common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    webhook: <svg {...common}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>,
    settings: <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></svg>,
    admin: <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
    plus: <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    edit: <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
    trash: <svg {...common}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    copy: <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
    download: <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    upload: <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    close: <svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    logout: <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    refresh: <svg {...common}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  };
  return icons[name] || <span style={{ width: 16, display: "inline-block" }} />;
}

function Badge({ color = "default", children }) {
  const palette = {
    default: { background: "#0d1728", border: theme.border, color: theme.textMuted },
    green: { background: "rgba(37,211,102,0.12)", border: "rgba(37,211,102,0.35)", color: "#7cf3aa" },
    yellow: { background: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", color: "#ffd17a" },
    red: { background: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", color: "#ff9a9a" },
    blue: { background: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", color: "#94c7ff" },
    purple: { background: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", color: "#c6a6ff" },
  };
  const style = palette[color] || palette.default;
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `1px solid ${style.border}`, background: style.background, color: style.color, fontWeight: 600 }}>{children}</span>;
}

function Button({ children, icon, variant = "primary", ...props }) {
  const variants = {
    primary: { background: theme.green, color: "#04120b", border: "none" },
    secondary: { background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.border}` },
    ghost: { background: "transparent", color: theme.textMuted, border: `1px solid ${theme.border}` },
    danger: { background: theme.red, color: "#fff", border: "none" },
  };
  const style = variants[variant];
  return (
    <button {...props} style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.6 : 1, ...style, ...(props.style || {}) }}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

function Input({ label, error, multiline = false, ...props }) {
  const Element = multiline ? "textarea" : "input";
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      {label ? <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{label}</div> : null}
      <Element {...props} style={{ width: "100%", padding: "11px 12px", background: theme.panelAlt, color: theme.text, border: `1px solid ${error ? theme.red : theme.border}`, borderRadius: 10, fontSize: 13, resize: multiline ? "vertical" : "none", minHeight: multiline ? 96 : undefined, boxSizing: "border-box", ...(props.style || {}) }} />
      {error ? <div style={{ color: theme.red, fontSize: 11, marginTop: 6 }}>{error}</div> : null}
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      {label ? <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{label}</div> : null}
      <select {...props} style={{ width: "100%", padding: "11px 12px", background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13, ...(props.style || {}) }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Modal({ title, children, onClose, width = 720 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16, zIndex: 50 }}>
      <div style={{ ...panelStyle, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <Button icon="close" variant="ghost" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
        {subtitle ? <p style={{ color: theme.textMuted, margin: "6px 0 0" }}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}

function StatCard({ label, value, note, color }) {
  return (
    <div style={{ ...panelStyle, padding: 18 }}>
      <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || theme.text }}>{value}</div>
      {note ? <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>{note}</div> : null}
    </div>
  );
}

function Notice({ kind = "error", children }) {
  if (!children) return null;
  const colors = { error: theme.red, info: theme.blue, success: theme.green };
  const c = colors[kind] || theme.red;
  return <div style={{ background: `${c}22`, border: `1px solid ${c}55`, color: theme.text, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>{children}</div>;
}

function Loading({ children = "Memuat..." }) {
  return <div style={{ color: theme.textMuted, padding: 24, textAlign: "center" }}>{children}</div>;
}

// Hook pemuat data sederhana: loader stabil (useCallback) → otomatis fetch + reload().
function useLoader(loader) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    return loader()
      .then((d) => { setData(d); setError(""); return d; })
      .catch((e) => setError(e.message || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [loader]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { token, user } = await api.login(username.trim(), password);
      setToken(token);
      onLogin(user);
    } catch (e) {
      setError(e.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...shellStyle, display: "flex", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ ...panelStyle, width: "100%", maxWidth: 420, padding: "36px 32px 28px" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <img src="/logopopuli.png" alt="Populi Center" style={{ height: 72, objectFit: "contain", marginBottom: 18 }} />
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>WA Survey Platform</h1>
          <p style={{ margin: 0, color: theme.textMuted, fontSize: 13, lineHeight: 1.6 }}>Dashboard survei WhatsApp, blast, admin, dan webhook.</p>
        </div>
        <div onKeyDown={(e) => e.key === "Enter" && !loading && username && password && handleLogin()}>
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" error={error} />
        </div>
        <Button onClick={handleLogin} disabled={loading || !username || !password} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
        </Button>
        <div style={{ marginTop: 16, fontSize: 12, color: theme.textMuted }}>
          Demo login default: <strong style={{ color: theme.text }}>populi / populi13!</strong>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, currentUser, onLogout }) {
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["surveys", "Survei", "survey"],
    ["blast", "WA Blast", "blast"],
    ["reports", "Laporan", "report"],
    ["webhook", "Webhook", "webhook"],
    ["settings", "Pengaturan", "settings"],
  ];
  if (currentUser.role === "superadmin") nav.push(["admin", "Admin", "admin"]);

  return (
    <aside style={{ width: 248, borderRight: `1px solid ${theme.border}`, background: "rgba(6,14,25,0.55)", padding: 18, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 22 }}>
        <img src="/logopopuli.png" alt="Populi Center" style={{ height: 36, objectFit: "contain", display: "block", marginBottom: 4 }} />
        <div style={{ color: theme.textMuted, fontSize: 11 }}>WhatsApp Survey Platform</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {nav.map(([id, label, icon]) => {
          const activeState = active === id;
          return (
            <button key={id} onClick={() => setActive(id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 12, border: "none", background: activeState ? "rgba(37,211,102,0.14)" : "transparent", color: activeState ? "#7cf3aa" : theme.textMuted, textAlign: "left", fontWeight: 700, cursor: "pointer" }}>
              <Icon name={icon} />
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 24, ...panelStyle, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>{currentUser.name}</div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>{currentUser.role}</div>
        <Button icon="logout" variant="ghost" onClick={onLogout} style={{ width: "100%", justifyContent: "center" }}>Keluar</Button>
      </div>
    </aside>
  );
}

function DashboardPage() {
  const { data: stats, loading: l1, error: e1 } = useLoader(useCallback(() => api.stats(), []));
  const { data: surveys, loading: l2 } = useLoader(useCallback(() => api.listSurveys(), []));
  const { data: blasts, loading: l3 } = useLoader(useCallback(() => api.listBlasts(), []));

  if (e1) return <div><SectionHeader title="Dashboard" /><Notice>{e1}</Notice></div>;
  if (l1 || l2 || l3) return <div><SectionHeader title="Dashboard" /><Loading /></div>;

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle={`Ringkasan operasional ${timestamp()}`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard label="Total Survei" value={stats.surveys} note={`${(surveys || []).filter((s) => s.status === "active").length} aktif`} color={theme.green} />
        <StatCard label="Respons Survei" value={stats.responses} note="Sesi survei tercatat" color={theme.blue} />
        <StatCard label="Total Kontak" value={stats.contacts} note={`${stats.segments} segmen`} color={theme.purple} />
        <StatCard label="Pesan Terkirim" value={stats.sent} note={`${stats.delivered} delivered • ${stats.opened} dibaca`} color={theme.yellow} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Survei Terbaru</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(surveys || []).slice(0, 6).map((survey) => (
              <div key={survey.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, background: theme.panelAlt }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{survey.title}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{survey.questions.length} pertanyaan, {survey.responses} respons</div>
                  </div>
                  <Badge color={survey.status === "active" ? "green" : survey.status === "draft" ? "yellow" : "red"}>{survey.status}</Badge>
                </div>
              </div>
            ))}
            {!(surveys || []).length ? <div style={{ color: theme.textMuted }}>Belum ada survei.</div> : null}
          </div>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Blast Terakhir</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(blasts || []).length ? (blasts || []).slice(0, 6).map((blast) => (
              <div key={blast.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, background: theme.panelAlt }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong>{blast.surveyTitle}</strong>
                  <Badge color={blast.status === "completed" ? "green" : blast.status === "scheduled" ? "yellow" : "blue"}>{blast.status}</Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{blast.segmentName} • {blast.vendor}</div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Terkirim {blast.sent} • Delivered {blast.delivered} • Dibaca {blast.opened}</div>
              </div>
            )) : <div style={{ color: theme.textMuted }}>Belum ada blast.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveysPage() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");

  const surveys = data || [];
  const filtered = surveys.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  const run = async (fn) => {
    setActionError("");
    try { await fn(); await reload(); } catch (e) { setActionError(e.message); }
  };

  const saveSurvey = async (draft, existingId) => {
    await run(async () => {
      if (existingId) await api.updateSurvey(existingId, draft);
      else await api.createSurvey(draft);
      setModal(null);
    });
  };

  return (
    <div>
      <SectionHeader title="Survei" subtitle="Kelola survei, status, dan daftar pertanyaan." actions={[
        <input key="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari survei..." style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.panelAlt, color: theme.text, minWidth: 220 }} />,
        <Button key="reload" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
        <Button key="new" icon="plus" onClick={() => setModal({ mode: "create" })}>Buat Survei</Button>,
      ]} />
      <Notice>{error || actionError}</Notice>
      {loading ? <Loading /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {filtered.map((survey) => (
            <div key={survey.id} style={{ ...panelStyle, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{survey.title}</div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{survey.description}</div>
                </div>
                <Badge color={survey.status === "active" ? "green" : survey.status === "draft" ? "yellow" : "red"}>{survey.status}</Badge>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>{survey.questions.length} pertanyaan • {survey.responses} respons</div>
              <div style={{ display: "grid", gap: 6, marginTop: 12, marginBottom: 16 }}>
                {survey.questions.slice(0, 3).map((q) => <div key={q.id} style={{ padding: "8px 10px", borderRadius: 10, background: theme.panelAlt, fontSize: 12 }}>{q.text}</div>)}
                {!survey.questions.length ? <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada pertanyaan.</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button variant="secondary" icon="edit" onClick={() => setModal({ mode: "edit", survey })}>Edit</Button>
                <Button variant="danger" icon="trash" onClick={() => run(() => api.deleteSurvey(survey.id))}>Hapus</Button>
              </div>
            </div>
          ))}
          {!filtered.length ? <div style={{ color: theme.textMuted }}>Tidak ada survei.</div> : null}
        </div>
      )}
      {modal ? <SurveyModal survey={modal.survey} onClose={() => setModal(null)} onSave={(draft) => saveSurvey(draft, modal.survey?.id)} /> : null}
    </div>
  );
}

function SurveyModal({ survey, onClose, onSave }) {
  const [title, setTitle] = useState(survey?.title || "");
  const [description, setDescription] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questionText, setQuestionText] = useState("");
  const [questions, setQuestions] = useState(survey?.questions || []);
  const [saving, setSaving] = useState(false);

  const addQuestion = () => {
    if (!questionText.trim()) return;
    setQuestions([...questions, { id: `tmp_${questions.length}`, type: "text", text: questionText.trim() }]);
    setQuestionText("");
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ title, description, status, questions: questions.map((q) => ({ text: q.text, type: q.type || "text" })) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={survey ? "Edit Survei" : "Buat Survei"} onClose={onClose}>
      <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama survei" />
      <Input label="Deskripsi" multiline value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat survei" />
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Aktif" }, { value: "closed", label: "Ditutup" }]} />
      <div style={{ ...panelStyle, padding: 16, marginTop: 6 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Pertanyaan</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Tambah pertanyaan baru" style={{ marginBottom: 0 }} />
          <Button icon="plus" onClick={addQuestion}>Tambah</Button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {questions.map((q, index) => (
            <div key={q.id || index} style={{ background: theme.panelAlt, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>{index + 1}. {q.text}</div>
              <Button variant="danger" icon="trash" onClick={() => setQuestions(questions.filter((_, i) => i !== index))} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!title.trim() || saving}>{saving ? "Menyimpan..." : "Simpan Survei"}</Button>
      </div>
    </Modal>
  );
}

function BlastPage() {
  const blastsL = useLoader(useCallback(() => api.listBlasts(), []));
  const segmentsL = useLoader(useCallback(() => api.listSegments(), []));
  const surveysL = useLoader(useCallback(() => api.listSurveys(), []));
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [tab, setTab] = useState("blasts");
  const [actionError, setActionError] = useState("");

  const blasts = blastsL.data || [];
  const segments = segmentsL.data || [];
  const surveys = surveysL.data || [];

  const run = async (fn, reloaders = []) => {
    setActionError("");
    try { await fn(); await Promise.all(reloaders.map((r) => r())); } catch (e) { setActionError(e.message); }
  };

  return (
    <div>
      <SectionHeader title="WA Blast" subtitle="Kelola segmen penerima dan kampanye blast." actions={[
        <Button key="reload" variant="ghost" icon="refresh" onClick={() => { blastsL.reload(); segmentsL.reload(); }}>Refresh</Button>,
        <Button key="blast" icon="plus" onClick={() => setShowBlastModal(true)}>Buat Blast</Button>,
        <Button key="segment" variant="secondary" icon="upload" onClick={() => setShowSegmentModal(true)}>Tambah Segmen</Button>,
      ]} />
      <Notice>{actionError || blastsL.error || segmentsL.error}</Notice>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Button variant={tab === "blasts" ? "primary" : "ghost"} onClick={() => setTab("blasts")}>Riwayat Blast</Button>
        <Button variant={tab === "segments" ? "primary" : "ghost"} onClick={() => setTab("segments")}>Segmen</Button>
      </div>

      {tab === "blasts" ? (
        blastsL.loading ? <Loading /> : (
          <div style={{ display: "grid", gap: 14 }}>
            {blasts.map((blast) => (
              <div key={blast.id} style={{ ...panelStyle, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{blast.surveyTitle}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Segmen {blast.segmentName} • vendor {blast.vendor} • template {blast.message || "-"}</div>
                  </div>
                  <Badge color={blast.status === "completed" ? "green" : blast.status === "scheduled" ? "yellow" : blast.status === "failed" ? "red" : "blue"}>{blast.status}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginTop: 16 }}>
                  <StatCard label="Sent" value={blast.sent} />
                  <StatCard label="Delivered" value={blast.delivered} />
                  <StatCard label="Dibaca" value={blast.opened} />
                  <StatCard label="Gagal" value={blast.failed} color={blast.failed ? theme.red : undefined} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Button variant="danger" icon="trash" onClick={() => run(() => api.deleteBlast(blast.id), [blastsL.reload])}>Hapus Blast</Button>
                </div>
              </div>
            ))}
            {!blasts.length ? <div style={{ color: theme.textMuted }}>Belum ada blast.</div> : null}
          </div>
        )
      ) : (
        segmentsL.loading ? <Loading /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            {segments.map((segment) => (
              <div key={segment.id} style={{ ...panelStyle, padding: 18 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{segment.name}</div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{segment.contacts.length} kontak</div>
                <div style={{ marginTop: 12, background: theme.panelAlt, borderRadius: 12, padding: 12, fontSize: 12, color: theme.textMuted }}>
                  {segment.contacts.slice(0, 5).join(", ")}{segment.contacts.length > 5 ? "..." : ""}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <Button variant="danger" icon="trash" onClick={() => run(() => api.deleteSegment(segment.id), [segmentsL.reload])}>Hapus</Button>
                </div>
              </div>
            ))}
            {!segments.length ? <div style={{ color: theme.textMuted }}>Belum ada segmen.</div> : null}
          </div>
        )
      )}

      {showBlastModal ? <BlastModal surveys={surveys} segments={segments} onClose={() => setShowBlastModal(false)} onSave={(draft) => run(() => api.createBlast(draft), [blastsL.reload]).then(() => setShowBlastModal(false))} /> : null}
      {showSegmentModal ? <SegmentModal onClose={() => setShowSegmentModal(false)} onSave={(draft) => run(() => api.createSegment(draft), [segmentsL.reload]).then(() => setShowSegmentModal(false))} /> : null}
    </div>
  );
}

function BlastModal({ surveys, segments, onClose, onSave }) {
  const [surveyId, setSurveyId] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id || "");
  const [vendor, setVendor] = useState("qontak");
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("id");
  const [bodyParams, setBodyParams] = useState("");
  const [messageText, setMessageText] = useState("Halo {{1}}, mohon bantu isi survei kami. Terima kasih 🙏");
  const [schedule, setSchedule] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        surveyId: surveyId || undefined,
        segmentId,
        vendor,
        templateName: templateName.trim(),
        templateLang,
        messageText,
        bodyParams: bodyParams.trim() ? bodyParams.split(",").map((s) => s.trim()) : undefined,
        scheduledAt: schedule || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Buat Blast" onClose={onClose}>
      <Select label="Survei (opsional)" value={surveyId} onChange={(e) => setSurveyId(e.target.value)} options={[{ value: "", label: "— tanpa survei —" }, ...surveys.map((s) => ({ value: s.id, label: s.title }))]} />
      <Select label="Segmen" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} options={segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length} kontak)` }))} />
      <Select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} options={[{ value: "qontak", label: "Qontak" }, { value: "meta", label: "Meta Cloud API" }]} />
      <Input label="Nama / ID Template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="cth: survei_undangan (Meta) atau Template ID (Qontak)" />
      <Input label="Bahasa Template" value={templateLang} onChange={(e) => setTemplateLang(e.target.value)} placeholder="id / en_US" />
      <Input label="Parameter Template (pisah koma, opsional)" value={bodyParams} onChange={(e) => setBodyParams(e.target.value)} placeholder="kosongkan untuk pakai nama kontak" />
      <Input label="Preview Pesan (audit)" multiline value={messageText} onChange={(e) => setMessageText(e.target.value)} />
      <Input label="Jadwal (opsional)" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
      <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
        Template harus sudah disetujui di {vendor === "meta" ? "Meta Business Manager" : "Qontak"}. Worker akan mengirim ke antrian.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!segmentId || !templateName.trim() || saving}>{saving ? "Mengirim..." : "Kirim Blast"}</Button>
      </div>
    </Modal>
  );
}

function SegmentModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const [saving, setSaving] = useState(false);
  const contacts = rawContacts.split("\n").map((item) => item.trim()).filter(Boolean);

  const submit = async () => {
    setSaving(true);
    try { await onSave({ name, contacts }); } finally { setSaving(false); }
  };

  return (
    <Modal title="Tambah Segmen" onClose={onClose}>
      <Input label="Nama Segmen" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Daftar Nomor (satu per baris)" multiline value={rawContacts} onChange={(e) => setRawContacts(e.target.value)} placeholder={"08123456789\n628987654321"} />
      <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}>Jumlah kontak: {contacts.length} (nomor dinormalisasi ke format 62…)</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!name.trim() || saving}>{saving ? "Menyimpan..." : "Simpan Segmen"}</Button>
      </div>
    </Modal>
  );
}

function ReportsPage() {
  const statsL = useLoader(useCallback(() => api.stats(), []));
  const surveysL = useLoader(useCallback(() => api.listSurveys(), []));
  const logsL = useLoader(useCallback(() => api.webhookLogs(8), []));

  const stats = statsL.data;
  if (statsL.loading || surveysL.loading) return <div><SectionHeader title="Laporan" /><Loading /></div>;

  return (
    <div>
      <SectionHeader title="Laporan" subtitle="Ringkasan performa survei, blast, dan webhook." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={() => { statsL.reload(); logsL.reload(); }}>Refresh</Button>]} />
      <Notice>{statsL.error}</Notice>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard label="Pesan Terkirim" value={stats.sent} color={theme.green} />
        <StatCard label="Delivered" value={stats.delivered} color={theme.blue} />
        <StatCard label="Dibaca" value={stats.opened} color={theme.yellow} />
        <StatCard label="Respons Survei" value={stats.responses} color={theme.purple} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Performa Survei</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(surveysL.data || []).map((survey) => (
              <div key={survey.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700 }}>{survey.title}</div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{survey.questions.length} pertanyaan • {survey.responses} respons • status {survey.status}</div>
              </div>
            ))}
            {!(surveysL.data || []).length ? <div style={{ color: theme.textMuted }}>Belum ada survei.</div> : null}
          </div>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Aktivitas Webhook Terbaru</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(logsL.data || []).map((log) => (
              <div key={log.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{log.vendor} • {log.event}</strong>
                  <Badge color={log.status === "success" ? "green" : log.status === "ignored" ? "blue" : "red"}>{log.status}</Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{new Date(log.createdAt).toLocaleString("id-ID")} • {log.note}</div>
              </div>
            ))}
            {!(logsL.data || []).length ? <div style={{ color: theme.textMuted }}>Belum ada log webhook.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookPage() {
  const logsL = useLoader(useCallback(() => api.webhookLogs(100), []));
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState("");

  const endpoints = [
    { vendor: "Meta Cloud API", url: `${apiBase}/webhook/meta`, methods: "GET (verifikasi) + POST" },
    { vendor: "Qontak", url: `${apiBase}/webhook/qontak`, methods: "POST" },
  ];

  const sendTestInbound = async () => {
    setTesting(true);
    setNote("");
    try {
      const payload = { entry: [{ changes: [{ value: { messages: [{ from: "628123456789", id: `wamid.TEST_${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), text: { body: "Pesan uji dari dashboard" } }] } }] }] };
      const res = await fetch(`${apiBase}/webhook/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setNote(res.ok ? "Test inbound terkirim ke /webhook/meta — cek log di bawah." : `Gagal: HTTP ${res.status}`);
      await logsL.reload();
    } catch (e) {
      setNote(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Webhook" subtitle="Endpoint penerima dari WhatsApp/Qontak dan log aktivitas." actions={[
        <Button key="test" variant="secondary" onClick={sendTestInbound} disabled={testing}>{testing ? "Mengirim..." : "Kirim Test Inbound"}</Button>,
        <Button key="r" variant="ghost" icon="refresh" onClick={logsL.reload}>Refresh</Button>,
      ]} />
      <Notice kind="info">{note}</Notice>

      <div style={{ ...panelStyle, padding: 18, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>URL Webhook (daftarkan di Meta/Qontak)</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {endpoints.map((ep) => (
            <div key={ep.vendor} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>{ep.vendor}</strong>
                <Badge color="blue">{ep.methods}</Badge>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 13, marginTop: 8, color: "#b9d3ef", wordBreak: "break-all" }}>{ep.url}</div>
            </div>
          ))}
        </div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>
          Catatan: saat dev gunakan tunnel publik (cloudflared/ngrok) agar URL bisa diakses Meta/Qontak. Verify token & secret diatur di server (.env / Pengaturan), bukan di sini.
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Log Webhook</h3>
        {logsL.loading ? <Loading /> : (
          <div style={{ display: "grid", gap: 10 }}>
            {(logsL.data || []).map((log) => (
              <details key={log.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 12 }}>
                <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{log.vendor} • {log.event}</span>
                  <Badge color={log.status === "success" ? "green" : log.status === "ignored" ? "blue" : "red"}>{log.status}</Badge>
                </summary>
                <div style={{ marginTop: 10, color: theme.textMuted, fontSize: 12 }}>{new Date(log.createdAt).toLocaleString("id-ID")} • {log.note}</div>
                <pre style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "#0a1321", color: "#b9d3ef", whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(log.payload, null, 2)}</pre>
              </details>
            ))}
            {!(logsL.data || []).length ? <div style={{ color: theme.textMuted }}>Belum ada log.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const vendorsL = useLoader(useCallback(() => api.listVendors(), []));
  const [actionNote, setActionNote] = useState("");
  const [actionError, setActionError] = useState("");

  const [meta, setMeta] = useState({ accessToken: "", phoneNumberId: "", appSecret: "", verifyToken: "", graphVersion: "v21.0" });
  const [qontak, setQontak] = useState({ accessToken: "", channelIntegrationId: "", webhookSecret: "", baseUrl: "https://service-chat.qontak.com/api/open/v1" });

  const vendors = vendorsL.data || [];
  const vmeta = vendors.find((v) => v.name === "meta");
  const vqontak = vendors.find((v) => v.name === "qontak");

  const saveCreds = async (vendor, creds) => {
    setActionError(""); setActionNote("");
    try {
      // hanya kirim field yang diisi
      const filtered = Object.fromEntries(Object.entries(creds).filter(([, v]) => String(v).trim() !== ""));
      await api.setVendorCredentials(vendor, filtered);
      setActionNote(`Kredensial ${vendor} tersimpan (terenkripsi di server).`);
      await vendorsL.reload();
    } catch (e) { setActionError(e.message); }
  };

  const toggleActive = async (vendor, active) => {
    setActionError("");
    try { await api.setVendorActive(vendor, active); await vendorsL.reload(); } catch (e) { setActionError(e.message); }
  };

  const vendorBadge = (v) => v ? (
    <div style={{ display: "flex", gap: 8 }}>
      <Badge color={v.configured ? "green" : "yellow"}>{v.configured ? "terkonfigurasi" : "belum lengkap"}</Badge>
      {v.isDefault ? <Badge color="purple">default</Badge> : null}
      {v.hasStoredCredentials ? <Badge color="blue">kredensial tersimpan</Badge> : null}
    </div>
  ) : null;

  return (
    <div>
      <SectionHeader title="Pengaturan" subtitle="Konfigurasi vendor pengirim WhatsApp (kredensial disimpan terenkripsi di server)." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={vendorsL.reload}>Refresh</Button>]} />
      <Notice>{actionError || vendorsL.error}</Notice>
      <Notice kind="success">{actionNote}</Notice>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Meta / WhatsApp Cloud API</h3>
            {vendorBadge(vmeta)}
          </div>
          <Input label="Access Token (System User)" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} placeholder="biarkan kosong jika tidak diubah" />
          <Input label="Phone Number ID" value={meta.phoneNumberId} onChange={(e) => setMeta({ ...meta, phoneNumberId: e.target.value })} />
          <Input label="App Secret" value={meta.appSecret} onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })} />
          <Input label="Webhook Verify Token" value={meta.verifyToken} onChange={(e) => setMeta({ ...meta, verifyToken: e.target.value })} />
          <Input label="Graph API Version" value={meta.graphVersion} onChange={(e) => setMeta({ ...meta, graphVersion: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("meta", meta)}>Simpan Kredensial Meta</Button>
            {vmeta ? <Button variant="secondary" onClick={() => toggleActive("meta", !vmeta.active)}>{vmeta.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Mekari Qontak</h3>
            {vendorBadge(vqontak)}
          </div>
          <Input label="Access Token" value={qontak.accessToken} onChange={(e) => setQontak({ ...qontak, accessToken: e.target.value })} placeholder="biarkan kosong jika tidak diubah" />
          <Input label="Channel Integration ID" value={qontak.channelIntegrationId} onChange={(e) => setQontak({ ...qontak, channelIntegrationId: e.target.value })} />
          <Input label="Webhook Secret" value={qontak.webhookSecret} onChange={(e) => setQontak({ ...qontak, webhookSecret: e.target.value })} />
          <Input label="Base URL" value={qontak.baseUrl} onChange={(e) => setQontak({ ...qontak, baseUrl: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("qontak", qontak)}>Simpan Kredensial Qontak</Button>
            {vqontak ? <Button variant="secondary" onClick={() => toggleActive("qontak", !vqontak.active)}>{vqontak.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </div>
      </div>
      <div style={{ ...panelStyle, padding: 18, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Checklist Integrasi</h3>
        <div style={{ display: "grid", gap: 10, color: theme.textMuted, fontSize: 13 }}>
          <div>1. Nomor WhatsApp Business API aktif & terhubung ke vendor (Qontak/Meta).</div>
          <div>2. Template message disetujui untuk outbound di luar jendela 24 jam.</div>
          <div>3. URL webhook publik HTTPS terdaftar (lihat tab Webhook).</div>
          <div>4. Verify token & secret sama antara vendor dan server.</div>
          <div>5. Worker blast berjalan (npm run dev:worker).</div>
        </div>
      </div>
    </div>
  );
}

function AdminPage({ currentUser }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listUsers(), []));
  const [modalUser, setModalUser] = useState(null);
  const [actionError, setActionError] = useState("");
  const users = data || [];

  const run = async (fn) => {
    setActionError("");
    try { await fn(); await reload(); } catch (e) { setActionError(e.message); }
  };

  return (
    <div>
      <SectionHeader title="Admin" subtitle="Kelola user dan akses dashboard." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
        <Button key="new" icon="plus" onClick={() => setModalUser({})}>Tambah User</Button>,
      ]} />
      <Notice>{error || actionError}</Notice>
      {loading ? <Loading /> : (
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {users.map((user) => (
              <div key={user.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{user.username} • {user.email || "-"}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                    <Badge color={user.active ? "green" : "red"}>{user.active ? "aktif" : "nonaktif"}</Badge>
                    <Badge color="purple">{user.role}</Badge>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="secondary" icon="edit" onClick={() => setModalUser(user)}>Edit</Button>
                  {user.id !== currentUser.id ? (
                    <>
                      <Button variant="ghost" onClick={() => run(() => api.updateUser(user.id, { active: !user.active }))}>{user.active ? "Nonaktifkan" : "Aktifkan"}</Button>
                      <Button variant="danger" icon="trash" onClick={() => run(() => api.deleteUser(user.id))}>Hapus</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {modalUser !== null ? <AdminUserModal user={modalUser.id ? modalUser : null} onClose={() => setModalUser(null)} onSave={(draft) => run(async () => {
        if (modalUser.id) await api.updateUser(modalUser.id, draft);
        else await api.createUser(draft);
        setModalUser(null);
      })} /> : null}
    </div>
  );
}

function AdminUserModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "admin");
  const [active, setActive] = useState(user?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const draft = { name, username, email, role, active };
      if (password.trim()) draft.password = password;
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={user ? "Edit User" : "Tambah User"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label={user ? "Password (kosongkan jika tetap)" : "Password"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "superadmin", label: "Superadmin" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }]} />
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, color: theme.textMuted, fontSize: 13 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Akun aktif
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!name.trim() || !username.trim() || (!user && !password.trim()) || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}

export default function PopuliApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    if (!getToken()) { setAuthReady(true); return; }
    api.me().then((r) => setCurrentUser(r.user)).catch(() => setToken(null)).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => { setCurrentUser(null); setActive("dashboard"); };
    window.addEventListener("populi:logout", onLogout);
    return () => window.removeEventListener("populi:logout", onLogout);
  }, []);

  const logout = () => { setToken(null); setCurrentUser(null); setActive("dashboard"); };

  const pages = useMemo(() => ({
    dashboard: <DashboardPage />,
    surveys: <SurveysPage />,
    blast: <BlastPage />,
    reports: <ReportsPage />,
    webhook: <WebhookPage />,
    settings: <SettingsPage />,
    admin: currentUser ? <AdminPage currentUser={currentUser} /> : null,
  }), [currentUser]);

  if (!authReady) return <div style={{ ...shellStyle, display: "flex", justifyContent: "center", alignItems: "center" }}><Loading /></div>;
  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  return (
    <div style={{ ...shellStyle, display: "flex" }}>
      <Sidebar active={active} setActive={setActive} currentUser={currentUser} onLogout={logout} />
      <main style={{ flex: 1, padding: 24 }}>{pages[active] || pages.dashboard}</main>
    </div>
  );
}
