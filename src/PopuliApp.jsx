import { useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = {
  users: "populi.users",
  sessionUserId: "populi.sessionUserId",
  surveys: "populi.surveys",
  segments: "populi.segments",
  blasts: "populi.blasts",
  webhooks: "populi.webhooks",
  webhookLogs: "populi.webhookLogs",
  settings: "populi.settings",
};

const DEFAULT_USERS = [
  { id: "u1", username: "populi", password: "populi13!", name: "Populi Admin", role: "superadmin", email: "admin@populi.id", active: true, createdAt: "2024-01-01" },
];

const DEFAULT_SURVEYS = [
  {
    id: "sv1",
    title: "Kepuasan Pelanggan Q1 2025",
    description: "Survei kepuasan pelanggan kuartal pertama.",
    status: "active",
    createdAt: "2025-01-10",
    responses: 142,
    questions: [
      { id: "q1", type: "radio", text: "Seberapa puas Anda dengan layanan kami?" },
      { id: "q2", type: "text", text: "Apa yang perlu kami tingkatkan?" },
    ],
  },
  {
    id: "sv2",
    title: "Riset Produk Baru",
    description: "Feedback awal untuk rencana peluncuran produk baru.",
    status: "draft",
    createdAt: "2025-02-14",
    responses: 0,
    questions: [],
  },
];

const DEFAULT_SEGMENTS = [
  { id: "seg1", name: "Pelanggan Premium", contacts: ["628111111111", "628222222222", "628333333333"], createdAt: "2025-01-05" },
  { id: "seg2", name: "Pelanggan Baru", contacts: ["628444444444", "628555555555"], createdAt: "2025-01-20" },
];

const DEFAULT_BLASTS = [
  {
    id: "b1",
    surveyId: "sv1",
    surveyTitle: "Kepuasan Pelanggan Q1 2025",
    segmentId: "seg1",
    segmentName: "Pelanggan Premium",
    status: "completed",
    sentAt: "2025-01-15 09:00",
    sent: 520,
    delivered: 508,
    opened: 142,
    message: "Halo {nama}, mohon bantu isi survei kami di {link}.",
  },
];

const DEFAULT_WEBHOOKS = [
  {
    id: "wh1",
    name: "WA Response Handler",
    url: "https://api.example.com/webhooks/qontak",
    events: ["message.received", "message.delivered", "message.read"],
    active: true,
    secret: "wh_secret_abc123",
    createdAt: "2025-01-01",
  },
];

const DEFAULT_SETTINGS = {
  wapiKey: "WABA_API_KEY_XXXX",
  wapiUrl: "https://graph.facebook.com/v18.0",
  waPhoneId: "100000000000000",
  waBusinessId: "200000000000000",
  qontakChannelId: "QONTAK_CHANNEL_ID",
  qontakIntegrationId: "QONTAK_INTEGRATION_ID",
  qontakVerifyToken: "populi_qontak_verify",
  surveyBaseUrl: "https://survey.populi.id/s/",
  blastDelay: 500,
  retryCount: 3,
};

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

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timestamp() {
  return new Date().toLocaleString("id-ID");
}

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => safeRead(key, fallback));

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
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
    <button
      {...props}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        ...style,
        ...(props.style || {}),
      }}
    >
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
      <Element
        {...props}
        style={{
          width: "100%",
          padding: "11px 12px",
          background: theme.panelAlt,
          color: theme.text,
          border: `1px solid ${error ? theme.red : theme.border}`,
          borderRadius: 10,
          fontSize: 13,
          resize: multiline ? "vertical" : "none",
          minHeight: multiline ? 96 : undefined,
          ...(props.style || {}),
        }}
      />
      {error ? <div style={{ color: theme.red, fontSize: 11, marginTop: 6 }}>{error}</div> : null}
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      {label ? <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{label}</div> : null}
      <select
        {...props}
        style={{
          width: "100%",
          padding: "11px 12px",
          background: theme.panelAlt,
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          fontSize: 13,
          ...(props.style || {}),
        }}
      >
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

function LoginPage({ users, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setError("");

    window.setTimeout(() => {
      const user = users.find((item) => item.username === username.trim() && item.password === password);

      if (!user) setError("Username atau password salah.");
      else if (!user.active) setError("Akun dinonaktifkan.");
      else onLogin(user.id);

      setLoading(false);
    }, 300);
  };

  return (
    <div style={{ ...shellStyle, display: "flex", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ ...panelStyle, width: "100%", maxWidth: 420, padding: "36px 32px 28px" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <img
            src="/logopopuli.png"
            alt="Populi Center"
            style={{ height: 72, objectFit: "contain", marginBottom: 18 }}
          />
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            WA Survey Platform
          </h1>
          <p style={{ margin: 0, color: theme.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            Dashboard survei WhatsApp, blast, admin, dan simulasi webhook.
          </p>
        </div>

        <div onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}>
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
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: activeState ? "rgba(37,211,102,0.14)" : "transparent",
                color: activeState ? "#7cf3aa" : theme.textMuted,
                textAlign: "left",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Icon name={icon} />
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24, ...panelStyle, padding: 14 }}>
        <div style={{ fontWeight: 700 }}>{currentUser.name}</div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>{currentUser.role}</div>
        <Button icon="logout" variant="ghost" onClick={onLogout} style={{ width: "100%", justifyContent: "center" }}>
          Keluar
        </Button>
      </div>
    </aside>
  );
}

function DashboardPage({ surveys, blasts, segments, webhooks }) {
  const totalContacts = segments.reduce((sum, segment) => sum + segment.contacts.length, 0);
  const totalSent = blasts.reduce((sum, blast) => sum + Number(blast.sent || 0), 0);
  const totalResponses = surveys.reduce((sum, survey) => sum + Number(survey.responses || 0), 0);
  const activeWebhooks = webhooks.filter((item) => item.active).length;

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle={`Ringkasan operasional ${timestamp()}`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard label="Total Survei" value={surveys.length} note={`${surveys.filter((item) => item.status === "active").length} aktif`} color={theme.green} />
        <StatCard label="Total Respons" value={totalResponses} note="Akumulasi semua survei" color={theme.blue} />
        <StatCard label="Total Kontak" value={totalContacts} note={`${segments.length} segmen`} color={theme.purple} />
        <StatCard label="Webhook Aktif" value={activeWebhooks} note={`${webhooks.length} endpoint`} color={theme.yellow} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Survei Terbaru</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {surveys.map((survey) => (
              <div key={survey.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, background: theme.panelAlt }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{survey.title}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                      {survey.questions.length} pertanyaan, {survey.responses} respons
                    </div>
                  </div>
                  <Badge color={survey.status === "active" ? "green" : survey.status === "draft" ? "yellow" : "red"}>{survey.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Blast Terakhir</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {blasts.length ? blasts.map((blast) => (
              <div key={blast.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, background: theme.panelAlt }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong>{blast.surveyTitle}</strong>
                  <Badge color={blast.status === "completed" ? "green" : blast.status === "scheduled" ? "yellow" : "blue"}>{blast.status}</Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{blast.segmentName} • {blast.sentAt}</div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Terkirim {blast.sent || 0} • Delivered {blast.delivered || 0} • Opened {blast.opened || 0}</div>
              </div>
            )) : <div style={{ color: theme.textMuted }}>Belum ada blast.</div>}
          </div>
          <div style={{ marginTop: 16, color: theme.textMuted, fontSize: 12 }}>
            Total pesan terkirim: <strong style={{ color: theme.text }}>{totalSent}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveysPage({ surveys, setSurveys }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = surveys.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  const saveSurvey = (draft, existingId) => {
    if (existingId) setSurveys(surveys.map((item) => (item.id === existingId ? { ...item, ...draft } : item)));
    else setSurveys([{ id: uid("sv"), createdAt: today(), responses: 0, ...draft }, ...surveys]);
    setModal(null);
  };

  return (
    <div>
      <SectionHeader
        title="Survei"
        subtitle="Kelola survei, status, dan daftar pertanyaan."
        actions={[
          <div key="search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari survei..."
              style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.panelAlt, color: theme.text, minWidth: 220 }}
            />
          </div>,
          <Button key="new" icon="plus" onClick={() => setModal({ mode: "create" })}>Buat Survei</Button>,
        ]}
      />

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
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>
              Dibuat {survey.createdAt} • {survey.questions.length} pertanyaan • {survey.responses} respons
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 12, marginBottom: 16 }}>
              {survey.questions.slice(0, 3).map((question) => (
                <div key={question.id} style={{ padding: "8px 10px", borderRadius: 10, background: theme.panelAlt, fontSize: 12 }}>{question.text}</div>
              ))}
              {!survey.questions.length ? <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada pertanyaan.</div> : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" icon="edit" onClick={() => setModal({ mode: "edit", survey })}>Edit</Button>
              <Button
                variant="ghost"
                icon="copy"
                onClick={() => setSurveys([{ ...survey, id: uid("sv"), title: `${survey.title} (Salinan)`, createdAt: today(), responses: 0, status: "draft" }, ...surveys])}
              >
                Duplikat
              </Button>
              <Button variant="danger" icon="trash" onClick={() => setSurveys(surveys.filter((item) => item.id !== survey.id))}>Hapus</Button>
            </div>
          </div>
        ))}
      </div>

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

  const addQuestion = () => {
    if (!questionText.trim()) return;
    setQuestions([...questions, { id: uid("q"), type: "text", text: questionText.trim() }]);
    setQuestionText("");
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
          {questions.map((question, index) => (
            <div key={question.id} style={{ background: theme.panelAlt, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>{index + 1}. {question.text}</div>
              <Button variant="danger" icon="trash" onClick={() => setQuestions(questions.filter((item) => item.id !== question.id))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => onSave({ title, description, status, questions })} disabled={!title.trim()}>Simpan Survei</Button>
      </div>
    </Modal>
  );
}

function BlastPage({ blasts, setBlasts, surveys, segments, setSegments }) {
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [tab, setTab] = useState("blasts");

  return (
    <div>
      <SectionHeader
        title="WA Blast"
        subtitle="Kelola segmen penerima dan kampanye blast."
        actions={[
          <Button key="blast" icon="plus" onClick={() => setShowBlastModal(true)}>Buat Blast</Button>,
          <Button key="segment" variant="secondary" icon="upload" onClick={() => setShowSegmentModal(true)}>Tambah Segmen</Button>,
        ]}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Button variant={tab === "blasts" ? "primary" : "ghost"} onClick={() => setTab("blasts")}>Riwayat Blast</Button>
        <Button variant={tab === "segments" ? "primary" : "ghost"} onClick={() => setTab("segments")}>Segmen</Button>
      </div>

      {tab === "blasts" ? (
        <div style={{ display: "grid", gap: 14 }}>
          {blasts.map((blast) => (
            <div key={blast.id} style={{ ...panelStyle, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{blast.surveyTitle}</div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Segmen {blast.segmentName} • {blast.sentAt}</div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{blast.message}</div>
                </div>
                <Badge color={blast.status === "completed" ? "green" : blast.status === "scheduled" ? "yellow" : "blue"}>{blast.status}</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginTop: 16 }}>
                <StatCard label="Sent" value={blast.sent || 0} />
                <StatCard label="Delivered" value={blast.delivered || 0} />
                <StatCard label="Opened" value={blast.opened || 0} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Button variant="danger" icon="trash" onClick={() => setBlasts(blasts.filter((item) => item.id !== blast.id))}>Hapus Blast</Button>
              </div>
            </div>
          ))}
          {!blasts.length ? <div style={{ color: theme.textMuted }}>Belum ada blast.</div> : null}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {segments.map((segment) => (
            <div key={segment.id} style={{ ...panelStyle, padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{segment.name}</div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>{segment.contacts.length} kontak • dibuat {segment.createdAt}</div>
              <div style={{ marginTop: 12, background: theme.panelAlt, borderRadius: 12, padding: 12, fontSize: 12, color: theme.textMuted }}>
                {segment.contacts.slice(0, 5).join(", ")}{segment.contacts.length > 5 ? "..." : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Button
                  variant="ghost"
                  icon="download"
                  onClick={() => {
                    const csv = ["nomor_hp", ...segment.contacts].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${segment.name}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export
                </Button>
                <Button variant="danger" icon="trash" onClick={() => setSegments(segments.filter((item) => item.id !== segment.id))}>Hapus</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBlastModal ? <BlastModal surveys={surveys} segments={segments} onClose={() => setShowBlastModal(false)} onSave={(draft) => { setBlasts([draft, ...blasts]); setShowBlastModal(false); }} /> : null}
      {showSegmentModal ? <SegmentModal onClose={() => setShowSegmentModal(false)} onSave={(draft) => { setSegments([draft, ...segments]); setShowSegmentModal(false); }} /> : null}
    </div>
  );
}

function BlastModal({ surveys, segments, onClose, onSave }) {
  const [surveyId, setSurveyId] = useState(surveys[0]?.id || "");
  const [segmentId, setSegmentId] = useState(segments[0]?.id || "");
  const [message, setMessage] = useState("Halo {nama}, mohon bantu isi survei kami di {link}.");
  const [schedule, setSchedule] = useState("");

  const survey = surveys.find((item) => item.id === surveyId);
  const segment = segments.find((item) => item.id === segmentId);

  return (
    <Modal title="Buat Blast" onClose={onClose}>
      <Select label="Survei" value={surveyId} onChange={(e) => setSurveyId(e.target.value)} options={surveys.map((item) => ({ value: item.id, label: item.title }))} />
      <Select label="Segmen" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} options={segments.map((item) => ({ value: item.id, label: `${item.name} (${item.contacts.length} kontak)` }))} />
      <Input label="Pesan WA" multiline value={message} onChange={(e) => setMessage(e.target.value)} />
      <Input label="Jadwal (opsional)" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => onSave({ id: uid("blast"), surveyId, surveyTitle: survey?.title || "-", segmentId, segmentName: segment?.name || "-", status: schedule ? "scheduled" : "pending", sentAt: schedule || timestamp(), sent: segment?.contacts.length || 0, delivered: schedule ? 0 : Math.max((segment?.contacts.length || 0) - 1, 0), opened: 0, message })} disabled={!surveyId || !segmentId}>Simpan Blast</Button>
      </div>
    </Modal>
  );
}

function SegmentModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const contacts = rawContacts.split("\n").map((item) => item.trim()).filter(Boolean);

  return (
    <Modal title="Tambah Segmen" onClose={onClose}>
      <Input label="Nama Segmen" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Daftar Nomor" multiline value={rawContacts} onChange={(e) => setRawContacts(e.target.value)} placeholder={"628123456789\n628987654321"} />
      <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}>Jumlah kontak: {contacts.length}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => onSave({ id: uid("seg"), name, contacts, createdAt: today() })} disabled={!name.trim()}>Simpan Segmen</Button>
      </div>
    </Modal>
  );
}

function ReportsPage({ surveys, blasts, webhookLogs }) {
  const sent = blasts.reduce((sum, item) => sum + Number(item.sent || 0), 0);
  const delivered = blasts.reduce((sum, item) => sum + Number(item.delivered || 0), 0);
  const opened = blasts.reduce((sum, item) => sum + Number(item.opened || 0), 0);
  const responses = surveys.reduce((sum, item) => sum + Number(item.responses || 0), 0);

  return (
    <div>
      <SectionHeader title="Laporan" subtitle="Ringkasan performa survei, blast, dan webhook." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard label="Pesan Terkirim" value={sent} color={theme.green} />
        <StatCard label="Delivered" value={delivered} color={theme.blue} />
        <StatCard label="Opened" value={opened} color={theme.yellow} />
        <StatCard label="Respons Survei" value={responses} color={theme.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Performa Survei</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {surveys.map((survey) => (
              <div key={survey.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700 }}>{survey.title}</div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{survey.questions.length} pertanyaan • {survey.responses} respons • status {survey.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Aktivitas Webhook Terbaru</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {webhookLogs.slice(0, 8).map((log) => (
              <div key={log.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{log.event}</strong>
                  <Badge color={log.status === "success" ? "green" : log.status === "simulated" ? "blue" : "red"}>{log.status}</Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{log.webhookName} • {log.createdAt}</div>
              </div>
            ))}
            {!webhookLogs.length ? <div style={{ color: theme.textMuted }}>Belum ada log webhook.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookPage({ webhooks, setWebhooks, webhookLogs, setWebhookLogs, settings }) {
  const [modalWebhook, setModalWebhook] = useState(null);
  const [simEvent, setSimEvent] = useState("message.received");
  const [simPhone, setSimPhone] = useState("628123456789");
  const [simBody, setSimBody] = useState("Ya, saya bersedia mengisi survei.");
  const [sendingId, setSendingId] = useState(null);

  const eventOptions = ["message.received", "message.delivered", "message.read", "message.failed", "template.approved", "survey.response"];

  const createPayload = (eventName) => ({
    event: eventName,
    channel: "whatsapp",
    provider: "mekari-qontak",
    integration_id: settings.qontakIntegrationId,
    channel_id: settings.qontakChannelId,
    message: { id: uid("msg"), from: simPhone, text: simBody, timestamp: new Date().toISOString() },
  });

  const appendLog = (entry) => {
    setWebhookLogs([{ id: uid("log"), createdAt: timestamp(), ...entry }, ...webhookLogs].slice(0, 100));
  };

  const runSimulation = (webhook) => {
    appendLog({ webhookName: webhook.name, webhookUrl: webhook.url, event: simEvent, status: "simulated", payload: createPayload(simEvent), note: "Simulasi lokal dari dashboard." });
  };

  const sendTestRequest = async (webhook) => {
    const payload = createPayload(simEvent);
    setSendingId(webhook.id);
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qontak-Signature": webhook.secret, "X-Qontak-Event": simEvent },
        body: JSON.stringify(payload),
      });
      appendLog({ webhookName: webhook.name, webhookUrl: webhook.url, event: simEvent, status: response.ok ? "success" : "failed", payload, note: `HTTP ${response.status}` });
    } catch (error) {
      appendLog({ webhookName: webhook.name, webhookUrl: webhook.url, event: simEvent, status: "failed", payload, note: error instanceof Error ? error.message : "Request gagal" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <SectionHeader title="Webhook" subtitle="Kelola endpoint dan tes payload webhook WhatsApp/Qontak." actions={[<Button key="new" icon="plus" onClick={() => setModalWebhook({ mode: "create" })}>Tambah Webhook</Button>]} />

      <div style={{ ...panelStyle, padding: 18, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Simulator Webhook</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <Select label="Event" value={simEvent} onChange={(e) => setSimEvent(e.target.value)} options={eventOptions.map((item) => ({ value: item, label: item }))} />
          <Input label="Nomor Pengirim" value={simPhone} onChange={(e) => setSimPhone(e.target.value)} />
          <Input label="Isi Pesan" value={simBody} onChange={(e) => setSimBody(e.target.value)} />
        </div>
        <div style={{ marginTop: 12, color: theme.textMuted, fontSize: 12 }}>
          Payload simulator akan menyertakan integration_id, channel_id, event, dan message body untuk mengetes handler Anda.
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        {webhooks.map((webhook) => (
          <div key={webhook.id} style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 16 }}>{webhook.name}</strong>
                  <Badge color={webhook.active ? "green" : "default"}>{webhook.active ? "aktif" : "nonaktif"}</Badge>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>{webhook.url}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {webhook.events.map((event) => <Badge key={event} color="blue">{event}</Badge>)}
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>Secret: {webhook.secret}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Button variant="secondary" onClick={() => runSimulation(webhook)}>Simulasi Lokal</Button>
                <Button variant="ghost" onClick={() => sendTestRequest(webhook)} disabled={!webhook.active || sendingId === webhook.id}>{sendingId === webhook.id ? "Mengirim..." : "POST Test"}</Button>
                <Button variant="ghost" icon="edit" onClick={() => setModalWebhook({ mode: "edit", webhook })}>Edit</Button>
                <Button variant="secondary" onClick={() => setWebhooks(webhooks.map((item) => item.id === webhook.id ? { ...item, active: !item.active } : item))}>{webhook.active ? "Nonaktifkan" : "Aktifkan"}</Button>
                <Button variant="danger" icon="trash" onClick={() => setWebhooks(webhooks.filter((item) => item.id !== webhook.id))}>Hapus</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...panelStyle, padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Log Webhook</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {webhookLogs.map((log) => (
            <details key={log.id} style={{ background: theme.panelAlt, borderRadius: 12, padding: 12 }}>
              <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{log.event} • {log.webhookName}</span>
                <Badge color={log.status === "success" ? "green" : log.status === "simulated" ? "blue" : "red"}>{log.status}</Badge>
              </summary>
              <div style={{ marginTop: 10, color: theme.textMuted, fontSize: 12 }}>{log.createdAt} • {log.note}</div>
              <pre style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "#0a1321", color: "#b9d3ef", whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(log.payload, null, 2)}</pre>
            </details>
          ))}
          {!webhookLogs.length ? <div style={{ color: theme.textMuted }}>Belum ada log.</div> : null}
        </div>
      </div>

      {modalWebhook ? <WebhookModal webhook={modalWebhook.webhook} onClose={() => setModalWebhook(null)} onSave={(draft) => { if (modalWebhook.webhook) setWebhooks(webhooks.map((item) => (item.id === modalWebhook.webhook.id ? { ...item, ...draft } : item))); else setWebhooks([{ id: uid("wh"), createdAt: today(), ...draft }, ...webhooks]); setModalWebhook(null); }} /> : null}
    </div>
  );
}

function WebhookModal({ webhook, onClose, onSave }) {
  const [name, setName] = useState(webhook?.name || "");
  const [url, setUrl] = useState(webhook?.url || "");
  const [eventsText, setEventsText] = useState((webhook?.events || []).join("\n"));
  const [secret, setSecret] = useState(webhook?.secret || `wh_${Math.random().toString(36).slice(2, 12)}`);
  const events = eventsText.split("\n").map((item) => item.trim()).filter(Boolean);

  return (
    <Modal title={webhook ? "Edit Webhook" : "Tambah Webhook"} onClose={onClose}>
      <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="URL Endpoint" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://domain-anda.com/webhooks/qontak" />
      <Input label="Secret / Signature" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <Input label="Events (satu per baris)" multiline value={eventsText} onChange={(e) => setEventsText(e.target.value)} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => onSave({ name, url, secret, events, active: webhook?.active ?? true })} disabled={!name.trim() || !url.trim()}>Simpan</Button>
      </div>
    </Modal>
  );
}

function SettingsPage({ settings, setSettings }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const update = (key, value) => setDraft({ ...draft, [key]: value });

  return (
    <div>
      <SectionHeader title="Pengaturan" subtitle="Konfigurasi WhatsApp Business API, Qontak, dan endpoint webhook." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Meta / WhatsApp Business API</h3>
          <Input label="Access Token" value={draft.wapiKey} onChange={(e) => update("wapiKey", e.target.value)} />
          <Input label="Graph API URL" value={draft.wapiUrl} onChange={(e) => update("wapiUrl", e.target.value)} />
          <Input label="Phone Number ID" value={draft.waPhoneId} onChange={(e) => update("waPhoneId", e.target.value)} />
          <Input label="Business Account ID" value={draft.waBusinessId} onChange={(e) => update("waBusinessId", e.target.value)} />
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Mekari Qontak</h3>
          <Input label="Qontak Channel ID" value={draft.qontakChannelId} onChange={(e) => update("qontakChannelId", e.target.value)} />
          <Input label="Qontak Integration ID" value={draft.qontakIntegrationId} onChange={(e) => update("qontakIntegrationId", e.target.value)} />
          <Input label="Verify Token" value={draft.qontakVerifyToken} onChange={(e) => update("qontakVerifyToken", e.target.value)} />
          <Input label="Survey Base URL" value={draft.surveyBaseUrl} onChange={(e) => update("surveyBaseUrl", e.target.value)} />
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Blast</h3>
          <Input label="Delay Antar Pesan (ms)" value={draft.blastDelay} onChange={(e) => update("blastDelay", e.target.value)} />
          <Input label="Retry Count" value={draft.retryCount} onChange={(e) => update("retryCount", e.target.value)} />
        </div>

        <div style={{ ...panelStyle, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Checklist Integrasi</h3>
          <div style={{ display: "grid", gap: 10, color: theme.textMuted, fontSize: 13 }}>
            <div>1. Nomor WhatsApp Business API aktif dan sudah terhubung ke provider.</div>
            <div>2. Template message untuk outbound di luar jendela 24 jam.</div>
            <div>3. Endpoint webhook publik HTTPS dengan signature validation.</div>
            <div>4. Verify token dan secret yang sama di Qontak dan backend Anda.</div>
            <div>5. Mapping event inbound ke survei, blast, dan contact profile.</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Button onClick={() => { setSettings(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1600); }}>
          {saved ? "Tersimpan" : "Simpan Pengaturan"}
        </Button>
        <Button variant="ghost" onClick={() => setDraft(settings)}>Reset</Button>
      </div>
    </div>
  );
}

function AdminPage({ users, setUsers, currentUser }) {
  const [modalUser, setModalUser] = useState(null);

  return (
    <div>
      <SectionHeader title="Admin" subtitle="Kelola user dan akses dashboard." actions={[<Button key="new" icon="plus" onClick={() => setModalUser({})}>Tambah User</Button>]} />

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
                    <Button variant="ghost" onClick={() => setUsers(users.map((item) => item.id === user.id ? { ...item, active: !item.active } : item))}>{user.active ? "Nonaktifkan" : "Aktifkan"}</Button>
                    <Button variant="danger" icon="trash" onClick={() => setUsers(users.filter((item) => item.id !== user.id))}>Hapus</Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalUser !== null ? <AdminUserModal user={modalUser.id ? modalUser : null} onClose={() => setModalUser(null)} onSave={(draft) => { if (modalUser.id) setUsers(users.map((item) => (item.id === modalUser.id ? { ...item, ...draft } : item))); else setUsers([{ id: uid("u"), createdAt: today(), ...draft }, ...users]); setModalUser(null); }} /> : null}
    </div>
  );
}

function AdminUserModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState(user?.password || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "admin");
  const [active, setActive] = useState(user?.active ?? true);

  return (
    <Modal title={user ? "Edit User" : "Tambah User"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "superadmin", label: "Superadmin" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }]} />
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, color: theme.textMuted, fontSize: 13 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Akun aktif
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => onSave({ name, username, password, email, role, active })} disabled={!name.trim() || !username.trim() || !password.trim()}>Simpan</Button>
      </div>
    </Modal>
  );
}

export default function PopuliApp() {
  const [users, setUsers] = usePersistentState(STORAGE_KEYS.users, DEFAULT_USERS);
  const [surveys, setSurveys] = usePersistentState(STORAGE_KEYS.surveys, DEFAULT_SURVEYS);
  const [segments, setSegments] = usePersistentState(STORAGE_KEYS.segments, DEFAULT_SEGMENTS);
  const [blasts, setBlasts] = usePersistentState(STORAGE_KEYS.blasts, DEFAULT_BLASTS);
  const [webhooks, setWebhooks] = usePersistentState(STORAGE_KEYS.webhooks, DEFAULT_WEBHOOKS);
  const [webhookLogs, setWebhookLogs] = usePersistentState(STORAGE_KEYS.webhookLogs, []);
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const [sessionUserId, setSessionUserId] = usePersistentState(STORAGE_KEYS.sessionUserId, null);
  const [active, setActive] = useState("dashboard");

  const currentUser = useMemo(() => users.find((item) => item.id === sessionUserId && item.active) || null, [sessionUserId, users]);

  useEffect(() => {
    if (!currentUser) {
      setSessionUserId(null);
      setActive("dashboard");
    }
  }, [currentUser, setSessionUserId]);

  if (!currentUser) return <LoginPage users={users} onLogin={setSessionUserId} />;

  const pages = {
    dashboard: <DashboardPage surveys={surveys} blasts={blasts} segments={segments} webhooks={webhooks} />,
    surveys: <SurveysPage surveys={surveys} setSurveys={setSurveys} />,
    blast: <BlastPage blasts={blasts} setBlasts={setBlasts} surveys={surveys} segments={segments} setSegments={setSegments} />,
    reports: <ReportsPage surveys={surveys} blasts={blasts} webhookLogs={webhookLogs} />,
    webhook: <WebhookPage webhooks={webhooks} setWebhooks={setWebhooks} webhookLogs={webhookLogs} setWebhookLogs={setWebhookLogs} settings={settings} />,
    settings: <SettingsPage settings={settings} setSettings={setSettings} />,
    admin: <AdminPage users={users} setUsers={setUsers} currentUser={currentUser} />,
  };

  return (
    <div style={{ ...shellStyle, display: "flex" }}>
      <Sidebar active={active} setActive={setActive} currentUser={currentUser} onLogout={() => setSessionUserId(null)} />
      <main style={{ flex: 1, padding: 24 }}>{pages[active] || pages.dashboard}</main>
    </div>
  );
}
