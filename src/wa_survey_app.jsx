import { useState, useEffect, useRef } from "react";

// â”€â”€ FONTS & GLOBAL STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    :root{
      --bg:#0a0f1a;--surface:#111827;--surface2:#1a2235;--surface3:#1e2d42;
      --border:#1f2f4a;--border2:#263548;
      --wa:#25D366;--wa2:#128C7E;--wa-light:#dcf8c6;
      --accent:#3b82f6;--accent2:#1d4ed8;
      --red:#ef4444;--yellow:#f59e0b;--purple:#8b5cf6;
      --text:#f1f5f9;--text2:#94a3b8;--text3:#64748b;
      --radius:10px;--radius2:14px;
    }
    body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:var(--surface)}
    ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
    input,textarea,select{font-family:'Plus Jakarta Sans',sans-serif;outline:none}
    button{font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer}
    .mono{font-family:'JetBrains Mono',monospace}
    .fade-in{animation:fadeIn .25s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .slide-in{animation:slideIn .2s ease}
    @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
    .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.3px}
    .badge-green{background:#052e16;color:#4ade80;border:1px solid #166534}
    .badge-blue{background:#0c1a3a;color:#60a5fa;border:1px solid #1e3a6e}
    .badge-yellow{background:#1c1002;color:#fbbf24;border:1px solid #854d0e}
    .badge-red{background:#1c0505;color:#f87171;border:1px solid #7f1d1d}
    .badge-purple{background:#1a0e2e;color:#c084fc;border:1px solid #4c1d95}
    .badge-gray{background:#0f172a;color:#94a3b8;border:1px solid #1e293b}
    .tooltip{position:relative}
    .tooltip:hover::after{content:attr(data-tip);position:absolute;bottom:110%;left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;font-size:11px;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:999;border:1px solid var(--border2)}
    .wa-pulse{animation:waPulse 2s infinite}
    @keyframes waPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.3)}50%{box-shadow:0 0 0 8px rgba(37,211,102,0)}}
  `}</style>
);

// â”€â”€ INITIAL DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INIT_USERS = [
  { id: "u1", username: "populi", password: "populi13!", name: "Populi Admin", role: "superadmin", email: "admin@populi.id", active: true, createdAt: "2024-01-01" },
];

const INIT_SURVEYS = [
  {
    id: "sv1", title: "Kepuasan Pelanggan Q1 2025", description: "Survei kepuasan pelanggan kuartal pertama", status: "active",
    createdAt: "2025-01-10", responses: 142, questions: [
      { id: "q1", type: "radio", text: "Seberapa puas Anda dengan layanan kami?", required: true, randomize: false, options: ["Sangat Puas","Puas","Cukup","Tidak Puas","Sangat Tidak Puas"], skipLogic: [] },
      { id: "q2", type: "text", text: "Apa yang perlu kami tingkatkan?", required: false, skipLogic: [{ ifQuestion: "q1", ifAnswer: "Sangat Puas", action: "skip" }] },
    ]
  },
  {
    id: "sv2", title: "Riset Produk Baru", description: "Feedback tentang produk yang akan diluncurkan", status: "draft",
    createdAt: "2025-02-14", responses: 0, questions: []
  },
];

const INIT_SEGMENTS = [
  { id: "seg1", name: "Pelanggan Premium", count: 523, contacts: [], createdAt: "2025-01-05" },
  { id: "seg2", name: "Pelanggan Baru", count: 1204, contacts: [], createdAt: "2025-01-20" },
  { id: "seg3", name: "Pelanggan Tidak Aktif", count: 287, contacts: [], createdAt: "2025-02-01" },
];

const INIT_BLASTS = [
  { id: "b1", surveyId: "sv1", surveyTitle: "Kepuasan Pelanggan Q1 2025", segmentId: "seg1", segmentName: "Pelanggan Premium", status: "completed", sentAt: "2025-01-15 09:00", sent: 520, delivered: 508, opened: 142 },
  { id: "b2", surveyId: "sv2", surveyTitle: "Riset Produk Baru", segmentId: "seg2", segmentName: "Pelanggan Baru", status: "scheduled", sentAt: "2025-03-01 10:00", sent: 0, delivered: 0, opened: 0 },
];

const INIT_WEBHOOKS = [
  { id: "wh1", name: "WA Response Handler", url: "https://api.example.com/wa/response", events: ["survey.response","blast.sent"], active: true, secret: "wh_secret_abc123", createdAt: "2025-01-01" },
];

const INIT_SETTINGS = {
  wapiKey: "WABA_API_KEY_XXXX",
  wapiUrl: "https://graph.facebook.com/v18.0",
  waPhoneId: "100000000000000",
  waBusinessId: "200000000000000",
  surveyBaseUrl: "https://survey.populi.id/s/",
  blastDelay: 500,
  retryCount: 3,
};

// â”€â”€ ICONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Icon = ({ name, size = 16, color }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
    survey: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
    blast: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    report: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    webhook: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
    admin: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    eye: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    copy: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    shuffle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>,
    skip: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>,
    whatsapp: <svg width={size} height={size} viewBox="0 0 24 24" fill={color||"currentColor"}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.046 22l4.955-1.299A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 11.999 2zm.001 18c-1.717 0-3.312-.49-4.663-1.337l-.334-.199-3.46.908.92-3.358-.218-.344C3.489 14.379 3 13.248 3 12 3 7.037 7.037 3 12 3s9 4.037 9 9-4.037 9-9 9z"/></svg>,
    key: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    drag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    segment: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
    lock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    chevron: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    more: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color||"currentColor"}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  };
  return icons[name] || null;
};

// â”€â”€ UI COMPONENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Btn = ({ onClick, children, variant = "primary", size = "md", disabled, style, icon, fullWidth }) => {
  const variants = {
    primary: { background: "var(--wa)", color: "#000", border: "none" },
    secondary: { background: "var(--surface3)", color: "var(--text)", border: "1px solid var(--border2)" },
    danger: { background: "var(--red)", color: "#fff", border: "none" },
    ghost: { background: "transparent", color: "var(--text2)", border: "1px solid var(--border)" },
    blue: { background: "var(--accent)", color: "#fff", border: "none" },
    purple: { background: "var(--purple)", color: "#fff", border: "none" },
  };
  const sizes = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "11px 24px", fontSize: 14 } };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...variants[variant], ...sizes[size],
        borderRadius: 8, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
        transition: "all .15s", opacity: disabled ? .5 : 1, width: fullWidth ? "100%" : undefined,
        justifyContent: fullWidth ? "center" : undefined, ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(1.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
    >{icon && <Icon name={icon} size={14} />}{children}</button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", mono, help, error, required }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6, letterSpacing: ".3px" }}>
      {label}{required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
    </label>}
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: "100%", padding: "9px 13px", background: "var(--surface2)", border: `1px solid ${error ? "var(--red)" : "var(--border2)"}`,
        borderRadius: 8, color: "var(--text)", fontSize: 13, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit",
        transition: "border-color .15s",
      }}
      onFocus={e => e.target.style.borderColor = "var(--wa)"}
      onBlur={e => e.target.style.borderColor = error ? "var(--red)" : "var(--border2)"}
    />
    {help && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{help}</div>}
    {error && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</div>}
  </div>
);

const Textarea = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>{label}</label>}
    <textarea
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "9px 13px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontSize: 13, resize: "vertical" }}
      onFocus={e => e.target.style.borderColor = "var(--wa)"}
      onBlur={e => e.target.style.borderColor = "var(--border2)"}
    />
  </div>
);

const Select = ({ label, value, onChange, options, help }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>{label}</label>}
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "9px 13px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontSize: 13 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {help && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{help}</div>}
  </div>
);

const Toggle = ({ value, onChange, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, background: value ? "var(--wa)" : "var(--surface3)",
        position: "relative", cursor: "pointer", transition: "background .2s", border: "1px solid var(--border2)", flexShrink: 0,
      }}
    >
      <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: value ? 19 : 2, transition: "left .2s" }} />
    </div>
    {label && <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>}
  </div>
);

const Card = ({ children, style, onClick }) => (
  <div
    onClick={onClick}
    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, ...style, cursor: onClick ? "pointer" : undefined }}
  >{children}</div>
);

const Modal = ({ title, onClose, children, width = 560 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
    <div className="fade-in" style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", color: "var(--text2)", display: "flex" }}><Icon name="close" size={14} /></button>
      </div>
      <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
    </div>
  </div>
);

const StatCard = ({ label, value, icon, color, sub }) => (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, marginBottom: 6, letterSpacing: ".5px", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: color || "var(--text)", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={20} color={color} />
      </div>
    </div>
  </div>
);

// â”€â”€ LOGIN PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LoginPage = ({ users, onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const normalizedUsername = username.trim();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const matchedUser = users.find(u => u.username === normalizedUsername && u.password === password);
      if (!matchedUser) setError("Username atau password salah");
      else if (!matchedUser.active) setError("Akun dinonaktifkan");
      else onLogin(matchedUser);
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 60% 40%, #0a2818 0%, var(--bg) 65%)", position: "relative", overflow: "hidden" }}>
      {/* background blobs */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,211,102,.07) 0%, transparent 70%)", top: "10%", right: "15%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,.05) 0%, transparent 70%)", bottom: "15%", left: "10%", pointerEvents: "none" }} />
      <div className="fade-in" style={{ width: "100%", maxWidth: 400, padding: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, padding: "36px 32px", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, var(--wa), var(--wa2))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }} className="wa-pulse">
              <Icon name="whatsapp" size={32} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Populi Survey</h1>
            <p style={{ fontSize: 13, color: "var(--text3)" }}>Platform Survei WhatsApp Blast</p>
          </div>
          <div onKeyDown={e => { if (e.key === "Enter" && !loading && username && password) handleLogin(); }}>
            <Input label="Username" value={username} onChange={setUsername} placeholder="Masukkan username" />
            <Input label="Password" value={password} onChange={setPassword} placeholder="Masukkan password" type="password" error={error} />
          </div>
          <Btn onClick={handleLogin} disabled={loading || !username || !password} fullWidth style={{ marginTop: 8, padding: "12px 0", fontSize: 14 }}>
            {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
          </Btn>
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 20 }}>
            Copyright 2025 Populi - WhatsApp Survey Platform
          </p>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed }) => {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "surveys", label: "Manajemen Survei", icon: "survey" },
    { id: "blast", label: "WA Blast", icon: "blast" },
    { id: "reports", label: "Laporan", icon: "report" },
    { id: "webhook", label: "Webhook API", icon: "webhook" },
    { id: "settings", label: "Pengaturan", icon: "settings" },
    ...(user.role === "superadmin" ? [{ id: "admin", label: "Kelola Admin", icon: "admin" }] : []),
  ];
  return (
    <div style={{
      width: collapsed ? 64 : 230, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
      transition: "width .25s", flexShrink: 0, height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "18px 0" : "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : undefined }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, var(--wa), var(--wa2))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="whatsapp" size={18} color="#fff" />
        </div>
        {!collapsed && <div><div style={{ fontSize: 13, fontWeight: 800 }}>Populi</div><div style={{ fontSize: 10, color: "var(--text3)" }}>Survey Platform</div></div>}
      </div>
      {/* Nav */}
      <nav style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
        {nav.map(item => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className="tooltip"
              data-tip={collapsed ? item.label : undefined}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "10px 0" : "9px 12px",
                borderRadius: 8, border: "none", background: isActive ? "rgba(37,211,102,.12)" : "transparent",
                color: isActive ? "var(--wa)" : "var(--text2)", fontWeight: isActive ? 600 : 500,
                fontSize: 13, marginBottom: 2, transition: "all .15s", justifyContent: collapsed ? "center" : undefined,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface2)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={item.icon} size={17} color={isActive ? "var(--wa)" : undefined} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: 2, background: "var(--wa)" }} />}
            </button>
          );
        })}
      </nav>
      {/* User */}
      <div style={{ padding: collapsed ? "12px 0" : "12px 12px", borderTop: "1px solid var(--border)" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 8px", background: "var(--surface2)", borderRadius: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#25D366,#128C7E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {user.name[0]}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "var(--wa)" }}>{user.role}</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, justifyContent: collapsed ? "center" : undefined }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{ flex: collapsed ? undefined : 1, padding: "7px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text2)", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Icon name="chevron" size={13} color="var(--text3)" />
          </button>
          <button onClick={onLogout} style={{ flex: collapsed ? undefined : 1, padding: "7px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--red)", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Icon name="logout" size={13} color="var(--red)" />
            {!collapsed && "Keluar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ TOPBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Topbar = ({ title, sub, actions }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{title}</h1>
      {sub && <p style={{ fontSize: 13, color: "var(--text3)" }}>{sub}</p>}
    </div>
    {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
  </div>
);

// â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DashboardPage = ({ surveys, blasts, segments }) => {
  const totalResponses = surveys.reduce((a, b) => a + b.responses, 0);
  const activeBlasts = blasts.filter(b => b.status === "completed").length;
  const totalSent = blasts.reduce((a, b) => a + b.sent, 0);
  const totalContacts = segments.reduce((a, b) => a + b.count, 0);

  return (
    <div className="fade-in">
      <Topbar title="Dashboard" sub={`Selamat datang kembali! ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Survei" value={surveys.length} icon="survey" color="var(--wa)" sub={`${surveys.filter(s=>s.status==="active").length} aktif`} />
        <StatCard label="Total Respons" value={totalResponses.toLocaleString()} icon="report" color="var(--accent)" sub="Dari semua survei" />
        <StatCard label="Blast Terkirim" value={totalSent.toLocaleString()} icon="blast" color="var(--yellow)" sub={`${activeBlasts} kampanye selesai`} />
        <StatCard label="Total Kontak" value={totalContacts.toLocaleString()} icon="segment" color="var(--purple)" sub={`${segments.length} segmen`} />
      </div>
      {/* Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>Survei Terbaru</h3>
          {surveys.slice(0,4).map(sv => (
            <div key={sv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: sv.status === "active" ? "var(--wa)" : "var(--text3)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sv.title}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{sv.questions.length} pertanyaan Â· {sv.responses} respons</div>
              </div>
              <span className={`badge badge-${sv.status === "active" ? "green" : "gray"}`}>{sv.status}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Blast Terakhir</h3>
          {blasts.map(b => (
            <div key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{b.surveyTitle}</div>
                <span className={`badge badge-${b.status === "completed" ? "green" : "yellow"}`}>{b.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Segmen: {b.segmentName}</div>
              {b.status === "completed" && (
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {[["Terkirim", b.sent, "var(--wa)"], ["Dibuka", b.opened, "var(--accent)"]].map(([l, v, c]) => (
                    <div key={l} style={{ fontSize: 11 }}>
                      <span style={{ color: "var(--text3)" }}>{l}: </span>
                      <span style={{ color: c, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// â”€â”€ QUESTION EDITOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QuestionEditor = ({ question, onChange, onDelete, index, allQuestions }) => {
  const [expanded, setExpanded] = useState(true);
  const typeOptions = [
    { value: "radio", label: "Pilihan Tunggal (Radio)" },
    { value: "checkbox", label: "Pilihan Ganda (Checkbox)" },
    { value: "text", label: "Teks Pendek" },
    { value: "textarea", label: "Teks Panjang" },
    { value: "rating", label: "Rating (1-10)" },
    { value: "scale", label: "Skala Likert" },
    { value: "dropdown", label: "Dropdown" },
    { value: "date", label: "Tanggal" },
  ];
  const hasOptions = ["radio","checkbox","dropdown","scale"].includes(question.type);
  const addOption = () => onChange({ ...question, options: [...(question.options||[]), `Opsi ${(question.options||[]).length + 1}`] });
  const updateOption = (i, v) => { const opts = [...(question.options||[])]; opts[i] = v; onChange({ ...question, options: opts }); };
  const removeOption = (i) => onChange({ ...question, options: question.options.filter((_, idx) => idx !== i) });
  const addSkipLogic = () => onChange({ ...question, skipLogic: [...(question.skipLogic||[]), { ifQuestion: "", ifAnswer: "", action: "skip" }] });
  const updateSkipLogic = (i, field, val) => {
    const sl = [...(question.skipLogic||[])];
    sl[i] = { ...sl[i], [field]: val };
    onChange({ ...question, skipLogic: sl });
  };
  const removeSkipLogic = (i) => onChange({ ...question, skipLogic: question.skipLogic.filter((_, idx) => idx !== i) });

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: expanded ? "1px solid var(--border)" : "none" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ color: "var(--text3)", cursor: "grab" }}><Icon name="drag" size={14} /></div>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(37,211,102,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--wa)", flexShrink: 0 }}>{index + 1}</div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: question.text || "var(--text3)" }}>{question.text || "Pertanyaan baru..."}</div>
        <span className="badge badge-gray" style={{ fontSize: 10 }}>{typeOptions.find(t=>t.value===question.type)?.label || question.type}</span>
        {question.randomize && <span className="badge badge-purple"><Icon name="shuffle" size={10}/>Acak</span>}
        {(question.skipLogic||[]).length > 0 && <span className="badge badge-blue"><Icon name="skip" size={10}/>Skip Logic</span>}
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{ background: "none", border: "none", color: "var(--red)", padding: "2px 4px", display: "flex" }}><Icon name="trash" size={14} /></button>
        <Icon name="chevron" size={12} color="var(--text3)" />
      </div>
      {/* Body */}
      {expanded && (
        <div style={{ padding: 16 }}>
          <Input label="Teks Pertanyaan" value={question.text} onChange={v => onChange({ ...question, text: v })} placeholder="Tulis pertanyaan di sini..." required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Select label="Tipe Pertanyaan" value={question.type} onChange={v => onChange({ ...question, type: v, options: v === "scale" ? ["Sangat Tidak Setuju","Tidak Setuju","Netral","Setuju","Sangat Setuju"] : question.options })} options={typeOptions} />
            <div style={{ paddingTop: 28 }}>
              <Toggle value={question.required} onChange={v => onChange({ ...question, required: v })} label="Wajib diisi" />
              {hasOptions && <Toggle value={question.randomize} onChange={v => onChange({ ...question, randomize: v })} label="Acak urutan opsi" />}
            </div>
          </div>
          {/* Options */}
          {hasOptions && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Daftar Opsi Jawaban</label>
              {(question.options || []).map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text3)", flexShrink: 0 }}>{String.fromCharCode(65+i)}</div>
                  <input
                    value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Opsi ${i+1}`}
                    style={{ flex: 1, padding: "7px 11px", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 7, color: "var(--text)", fontSize: 13 }}
                  />
                  <button onClick={() => removeOption(i)} style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 7, color: "var(--text3)", padding: "6px 8px", display: "flex" }}><Icon name="close" size={12} /></button>
                </div>
              ))}
              <Btn onClick={addOption} variant="ghost" size="sm" icon="plus">Tambah Opsi</Btn>
            </div>
          )}
          {/* Skip Logic */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Skip Logic (Kondisi Lompat)</label>
              <Btn onClick={addSkipLogic} variant="ghost" size="sm" icon="skip">Tambah Kondisi</Btn>
            </div>
            {(question.skipLogic || []).map((sl, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>Jika</span>
                <select value={sl.ifQuestion} onChange={e => updateSkipLogic(i, "ifQuestion", e.target.value)} style={{ flex: 1, minWidth: 100, padding: "5px 8px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--text)", fontSize: 12 }}>
                  <option value="">Pilih pertanyaan</option>
                  {allQuestions.filter(q => q.id !== question.id).map(q => <option key={q.id} value={q.id}>{q.text || `Q${q.id}`}</option>)}
                </select>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>dijawab</span>
                <input value={sl.ifAnswer} onChange={e => updateSkipLogic(i, "ifAnswer", e.target.value)} placeholder="nilai jawaban" style={{ flex: 1, minWidth: 80, padding: "5px 8px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--text)", fontSize: 12 }} />
                <select value={sl.action} onChange={e => updateSkipLogic(i, "action", e.target.value)} style={{ padding: "5px 8px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--text)", fontSize: 12 }}>
                  <option value="skip">â†’ Lewati pertanyaan ini</option>
                  <option value="show">â†’ Tampilkan pertanyaan ini</option>
                  <option value="end">â†’ Akhiri survei</option>
                </select>
                <button onClick={() => removeSkipLogic(i)} style={{ background: "none", border: "none", color: "var(--red)", padding: 4, display: "flex" }}><Icon name="close" size={13} /></button>
              </div>
            ))}
            {(question.skipLogic||[]).length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Belum ada kondisi skip logic. Klik "Tambah Kondisi" untuk menambahkan.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// â”€â”€ SURVEY EDITOR MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SurveyEditorModal = ({ survey, onSave, onClose }) => {
  const [title, setTitle] = useState(survey?.title || "");
  const [desc, setDesc] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questions, setQuestions] = useState(survey?.questions ? JSON.parse(JSON.stringify(survey.questions)) : []);
  const [tab, setTab] = useState("info");
  const uid = () => `q${Date.now()}${Math.random().toString(36).slice(2,5)}`;

  const addQuestion = () => setQuestions([...questions, { id: uid(), type: "radio", text: "", required: false, randomize: false, options: ["Opsi A", "Opsi B", "Opsi C"], skipLogic: [] }]);
  const updateQ = (i, q) => { const arr = [...questions]; arr[i] = q; setQuestions(arr); };
  const deleteQ = (i) => setQuestions(questions.filter((_, idx) => idx !== i));

  const exportQuestions = () => {
    const json = JSON.stringify({ version: "1.0", questions }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `questions_${title||"survey"}.json`; a.click();
  };

  const importQuestions = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.questions) setQuestions(data.questions);
          else alert("Format file tidak valid");
        } catch { alert("File tidak dapat dibaca"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <Modal title={survey ? "Edit Survei" : "Buat Survei Baru"} onClose={onClose} width={700}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface2)", borderRadius: 8, padding: 4 }}>
        {[["info","Informasi Dasar"],["questions","Pertanyaan"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: tab===id ? "var(--surface)" : "transparent", color: tab===id ? "var(--text)" : "var(--text3)", fontSize: 13, fontWeight: tab===id ? 600 : 400, transition: "all .15s" }}>{label}</button>
        ))}
      </div>
      {tab === "info" && (
        <div>
          <Input label="Judul Survei" value={title} onChange={setTitle} placeholder="cth: Survei Kepuasan Pelanggan Q2" required />
          <Textarea label="Deskripsi" value={desc} onChange={setDesc} placeholder="Deskripsi singkat survei ini..." />
          <Select label="Status" value={status} onChange={setStatus} options={[{value:"draft",label:"Draft"},{value:"active",label:"Aktif"},{value:"closed",label:"Ditutup"}]} />
        </div>
      )}
      {tab === "questions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>{questions.length} pertanyaan</div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={importQuestions} variant="ghost" size="sm" icon="upload">Import</Btn>
              <Btn onClick={exportQuestions} variant="ghost" size="sm" icon="download">Export</Btn>
              <Btn onClick={addQuestion} size="sm" icon="plus">Tambah</Btn>
            </div>
          </div>
          {questions.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text3)" }}>
              <Icon name="survey" size={32} color="var(--border2)" />
              <p style={{ marginTop: 10, fontSize: 13 }}>Belum ada pertanyaan. Klik "Tambah" untuk mulai.</p>
            </div>
          )}
          {questions.map((q, i) => (
            <QuestionEditor key={q.id} question={q} index={i} onChange={nq => updateQ(i, nq)} onDelete={() => deleteQ(i)} allQuestions={questions} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <Btn onClick={onClose} variant="ghost">Batal</Btn>
        <Btn onClick={() => onSave({ title, description: desc, status, questions })} disabled={!title}>Simpan Survei</Btn>
      </div>
    </Modal>
  );
};

// â”€â”€ SURVEYS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SurveysPage = ({ surveys, setSurveys }) => {
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", survey }
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const uid = () => `sv${Date.now()}`;

  const filtered = surveys.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

  const handleSave = (data) => {
    if (modal.mode === "create") {
      setSurveys([...surveys, { ...data, id: uid(), responses: 0, createdAt: new Date().toISOString().split("T")[0] }]);
    } else {
      setSurveys(surveys.map(s => s.id === modal.survey.id ? { ...s, ...data } : s));
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    setSurveys(surveys.filter(s => s.id !== id));
    setConfirmDel(null);
  };

  const handleDuplicate = (sv) => {
    setSurveys([...surveys, { ...sv, id: uid(), title: sv.title + " (Salinan)", responses: 0, status: "draft", createdAt: new Date().toISOString().split("T")[0] }]);
  };

  return (
    <div className="fade-in">
      <Topbar
        title="Manajemen Survei"
        sub="Buat dan kelola survei WhatsApp Anda"
        actions={[
          <div key="search" style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><Icon name="search" size={14} color="var(--text3)" /></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari survei..." style={{ padding: "8px 12px 8px 32px", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontSize: 13, width: 200 }} />
          </div>,
          <Btn key="new" onClick={() => setModal({ mode: "create", survey: null })} icon="plus">Buat Survei</Btn>
        ]}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        {filtered.map(sv => (
          <div key={sv.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, transition: "border-color .15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1, marginRight: 10 }}>{sv.title}</h3>
              <span className={`badge badge-${sv.status==="active"?"green":sv.status==="closed"?"red":"gray"}`}>{sv.status}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14, lineHeight: 1.5 }}>{sv.description || "Tidak ada deskripsi"}</p>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              {[["survey", sv.questions.length + " Pertanyaan", "var(--wa)"], ["report", sv.responses + " Respons", "var(--accent)"]].map(([icon, label, color]) => (
                <div key={icon} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text2)" }}>
                  <Icon name={icon} size={12} color={color} />{label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>Dibuat: {sv.createdAt}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={() => setModal({ mode: "edit", survey: sv })} variant="ghost" size="sm" icon="edit">Edit</Btn>
              <Btn onClick={() => handleDuplicate(sv)} variant="ghost" size="sm" icon="copy">Duplikat</Btn>
              <Btn onClick={() => setConfirmDel(sv.id)} variant="danger" size="sm" icon="trash">Hapus</Btn>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
            <Icon name="survey" size={40} color="var(--border2)" />
            <p style={{ marginTop: 12 }}>Tidak ada survei ditemukan</p>
          </div>
        )}
      </div>
      {modal && <SurveyEditorModal survey={modal.survey} onSave={handleSave} onClose={() => setModal(null)} />}
      {confirmDel && (
        <Modal title="Konfirmasi Hapus" onClose={() => setConfirmDel(null)} width={380}>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Apakah Anda yakin ingin menghapus survei ini? Tindakan ini tidak dapat dibatalkan.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={() => setConfirmDel(null)} variant="ghost">Batal</Btn>
            <Btn onClick={() => handleDelete(confirmDel)} variant="danger">Hapus Survei</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// â”€â”€ BLAST PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BlastPage = ({ blasts, setBlasts, surveys, segments, setSegments }) => {
  const [tab, setTab] = useState("blasts");
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [showSegModal, setShowSegModal] = useState(null); // null | segment
  const [confirmDel, setConfirmDel] = useState(null);
  const uid = () => `${Date.now()}`;

  // Blast modal state
  const [bSurvey, setBSurvey] = useState("");
  const [bSegment, setBSegment] = useState("");
  const [bSchedule, setBSchedule] = useState("");
  const [bMsg, setBMsg] = useState("Halo {nama}! Kami mengundang Anda untuk mengisi survei singkat kami: {link}. Terima kasih!");

  // Segment modal state
  const [segName, setSegName] = useState("");
  const [segNumbers, setSegNumbers] = useState("");

  const handleCreateBlast = () => {
    const sv = surveys.find(s => s.id === bSurvey);
    const seg = segments.find(s => s.id === bSegment);
    if (!sv || !seg) return;
    setBlasts([...blasts, {
      id: uid(), surveyId: bSurvey, surveyTitle: sv.title,
      segmentId: bSegment, segmentName: seg.name,
      status: bSchedule ? "scheduled" : "pending",
      sentAt: bSchedule || new Date().toLocaleString("id-ID"),
      sent: 0, delivered: 0, opened: 0, message: bMsg,
    }]);
    setShowBlastModal(false);
    setBSurvey(""); setBSegment(""); setBSchedule(""); 
  };

  const handleSaveSegment = () => {
    const numbers = segNumbers.split("\n").filter(n => n.trim());
    if (showSegModal === "new") {
      setSegments([...segments, { id: uid(), name: segName, count: numbers.length, contacts: numbers, createdAt: new Date().toISOString().split("T")[0] }]);
    } else {
      setSegments(segments.map(s => s.id === showSegModal.id ? { ...s, name: segName, count: numbers.length, contacts: numbers } : s));
    }
    setShowSegModal(null); setSegName(""); setSegNumbers("");
  };

  const exportSegment = (seg) => {
    const csv = "nomor_hp\n" + seg.contacts.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `segment_${seg.name}.csv`; a.click();
  };

  const importSegment = (segId) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,.txt";
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const lines = ev.target.result.split("\n").filter(l => l.trim() && l.trim() !== "nomor_hp");
        setSegments(segments.map(s => s.id === segId ? { ...s, count: lines.length, contacts: lines } : s));
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="fade-in">
      <Topbar title="WA Blast" sub="Kirim survei ke segmen kontak WhatsApp" actions={[
        <Btn key="blast" onClick={() => setShowBlastModal(true)} icon="blast">Buat Blast Baru</Btn>
      ]} />
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface2)", borderRadius: 8, padding: 4, width: "fit-content" }}>
        {[["blasts","Riwayat Blast"],["segments","Kelola Segmen"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 18px", borderRadius: 6, border: "none", background: tab===id ? "var(--surface)" : "transparent", color: tab===id ? "var(--text)" : "var(--text3)", fontSize: 13, fontWeight: tab===id ? 600 : 400 }}>{label}</button>
        ))}
      </div>

      {tab === "blasts" && (
        <div>
          {blasts.map(b => (
            <div key={b.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{b.surveyTitle}</h3>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text3)" }}>
                    <span>Segmen: <strong style={{ color: "var(--text2)" }}>{b.segmentName}</strong></span>
                    <span>Waktu: <strong style={{ color: "var(--text2)" }}>{b.sentAt}</strong></span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge badge-${b.status==="completed"?"green":b.status==="scheduled"?"yellow":b.status==="failed"?"red":"gray"}`}>{b.status}</span>
                  <Btn onClick={() => setBlasts(blasts.filter(bl => bl.id !== b.id))} variant="danger" size="sm" icon="trash"></Btn>
                </div>
              </div>
              {b.status === "completed" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {[["Terkirim", b.sent, "var(--wa)"], ["Tersampaikan", b.delivered, "var(--accent)"], ["Dibuka", b.opened, "var(--yellow)"]].map(([l, v, c]) => (
                    <div key={l} style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {blasts.length === 0 && <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}><Icon name="blast" size={36} color="var(--border2)" /><p style={{ marginTop: 12 }}>Belum ada blast</p></div>}
        </div>
      )}

      {tab === "segments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <Btn onClick={() => { setShowSegModal("new"); setSegName(""); setSegNumbers(""); }} icon="plus">Tambah Segmen</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {segments.map(seg => (
              <div key={seg.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>{seg.name}</h3>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{seg.count.toLocaleString()} kontak</div>
                  </div>
                  <Icon name="segment" size={20} color="var(--purple)" />
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>Dibuat: {seg.createdAt}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn onClick={() => { setShowSegModal(seg); setSegName(seg.name); setSegNumbers(seg.contacts.join("\n")); }} variant="ghost" size="sm" icon="edit">Edit</Btn>
                  <Btn onClick={() => exportSegment(seg)} variant="ghost" size="sm" icon="download">Export</Btn>
                  <Btn onClick={() => importSegment(seg.id)} variant="ghost" size="sm" icon="upload">Import</Btn>
                  <Btn onClick={() => setSegments(segments.filter(s => s.id !== seg.id))} variant="danger" size="sm" icon="trash"></Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blast Modal */}
      {showBlastModal && (
        <Modal title="Buat Blast WA Baru" onClose={() => setShowBlastModal(false)} width={520}>
          <Select label="Pilih Survei" value={bSurvey} onChange={setBSurvey} options={[{value:"",label:"-- Pilih Survei --"},...surveys.map(s=>({value:s.id,label:s.title}))]} />
          <Select label="Pilih Segmen Penerima" value={bSegment} onChange={setBSegment} options={[{value:"",label:"-- Pilih Segmen --"},...segments.map(s=>({value:s.id,label:`${s.name} (${s.count} kontak)`}))]} />
          <Textarea label="Pesan WA" value={bMsg} onChange={setBMsg} help="Gunakan {nama}, {link}, {kode} sebagai variabel dinamis" rows={4} />
          <Input label="Jadwalkan (opsional)" value={bSchedule} onChange={setBSchedule} type="datetime-local" help="Kosongkan untuk langsung kirim" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => setShowBlastModal(false)} variant="ghost">Batal</Btn>
            <Btn onClick={handleCreateBlast} disabled={!bSurvey || !bSegment} icon="blast">Kirim Blast</Btn>
          </div>
        </Modal>
      )}

      {/* Segment Modal */}
      {showSegModal && (
        <Modal title={showSegModal === "new" ? "Tambah Segmen Baru" : "Edit Segmen"} onClose={() => setShowSegModal(null)} width={480}>
          <Input label="Nama Segmen" value={segName} onChange={setSegName} placeholder="cth: Pelanggan VIP" required />
          <Textarea label="Daftar Nomor HP (satu per baris)" value={segNumbers} onChange={setSegNumbers} placeholder={"628123456789\n628987654321\n..."} rows={8} help="Format: 628XXXXXXXXXX (dengan kode negara)" />
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>
            Jumlah kontak: <strong style={{ color: "var(--wa)" }}>{segNumbers.split("\n").filter(n=>n.trim()).length.toLocaleString()}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={() => setShowSegModal(null)} variant="ghost">Batal</Btn>
            <Btn onClick={handleSaveSegment} disabled={!segName}>Simpan Segmen</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// â”€â”€ REPORTS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ReportsPage = ({ surveys, blasts }) => {
  const [selected, setSelected] = useState(surveys[0]?.id || "");
  const sv = surveys.find(s => s.id === selected);
  const dummyData = sv ? sv.questions.filter(q => ["radio","checkbox","scale","dropdown"].includes(q.type)).map(q => ({
    question: q.text, type: q.type,
    answers: (q.options||[]).map((opt,i) => ({ label: opt, count: Math.floor(Math.random()*80) + 5 }))
  })) : [];

  return (
    <div className="fade-in">
      <Topbar title="Laporan Survei" sub="Analisis dan hasil respons survei" actions={[
        <Btn key="export" icon="download" variant="ghost">Export CSV</Btn>
      ]} />
      <div style={{ marginBottom: 20 }}>
        <Select label="" value={selected} onChange={setSelected} options={surveys.map(s => ({ value: s.id, label: s.title }))} />
      </div>
      {sv ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Respons" value={sv.responses} icon="report" color="var(--wa)" />
            <StatCard label="Pertanyaan" value={sv.questions.length} icon="survey" color="var(--accent)" />
            <StatCard label="Completion Rate" value="78%" icon="check" color="var(--yellow)" />
            <StatCard label="Rata-rata Durasi" value="3.2 mnt" icon="refresh" color="var(--purple)" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {dummyData.map((item, i) => {
              const max = Math.max(...item.answers.map(a => a.count));
              const total = item.answers.reduce((a, b) => a + b.count, 0);
              return (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, lineHeight: 1.4 }}>{item.question}</h4>
                  {item.answers.map((ans, j) => (
                    <div key={j} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--text2)" }}>{ans.label}</span>
                        <span style={{ fontWeight: 600 }}>{ans.count} <span style={{ color: "var(--text3)", fontWeight: 400 }}>({Math.round(ans.count/total*100)}%)</span></span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${ans.count/max*100}%`, background: `hsl(${140+j*25},70%,45%)`, borderRadius: 3, transition: "width .5s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {dummyData.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)", background: "var(--surface)", borderRadius: 14 }}>
              <Icon name="report" size={36} color="var(--border2)" />
              <p style={{ marginTop: 12 }}>Survei ini belum memiliki pertanyaan pilihan untuk divisualisasikan</p>
            </div>
          )}
        </>
      ) : <div style={{ textAlign: "center", padding: "60px", color: "var(--text3)" }}>Pilih survei untuk melihat laporan</div>}
    </div>
  );
};

// â”€â”€ WEBHOOK PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WebhookPage = ({ webhooks, setWebhooks }) => {
  const [modal, setModal] = useState(null);
  const [copied, setCopied] = useState(null);
  const [wName, setWName] = useState(""); const [wUrl, setWUrl] = useState(""); const [wEvents, setWEvents] = useState([]); const [wSecret, setWSecret] = useState("");
  const uid = () => `wh${Date.now()}`;
  const allEvents = ["survey.response","survey.completed","blast.sent","blast.delivered","blast.failed","blast.opened"];
  const copyText = (text, id) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  const genSecret = () => `wh_${Math.random().toString(36).slice(2,12)}_${Math.random().toString(36).slice(2,12)}`;

  const handleSave = () => {
    if (modal === "new") setWebhooks([...webhooks, { id: uid(), name: wName, url: wUrl, events: wEvents, active: true, secret: wSecret || genSecret(), createdAt: new Date().toISOString().split("T")[0] }]);
    else setWebhooks(webhooks.map(w => w.id === modal.id ? { ...w, name: wName, url: wUrl, events: wEvents, secret: wSecret } : w));
    setModal(null);
  };

  const openModal = (wh) => {
    if (wh === "new") { setWName(""); setWUrl(""); setWEvents([]); setWSecret(genSecret()); }
    else { setWName(wh.name); setWUrl(wh.url); setWEvents(wh.events); setWSecret(wh.secret); }
    setModal(wh);
  };

  return (
    <div className="fade-in">
      <Topbar title="Webhook API" sub="Kelola endpoint webhook untuk integrasi eksternal" actions={[
        <Btn key="new" onClick={() => openModal("new")} icon="plus">Tambah Webhook</Btn>
      ]} />
      {/* Docs */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="key" size={14} color="var(--yellow)" /> Endpoint API Webhook
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {[
            ["POST /api/v1/webhook/trigger", "Trigger webhook manual"],
            ["GET /api/v1/webhook/events", "Daftar semua event tersedia"],
            ["GET /api/v1/webhook/logs", "Log pengiriman webhook"],
          ].map(([path, desc]) => (
            <div key={path} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8 }}>
              <code style={{ fontSize: 12, color: "var(--wa)", fontFamily: "'JetBrains Mono',monospace", flex: 1 }}>{path}</code>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>{desc}</span>
              <button onClick={() => copyText(path, path)} style={{ background: "none", border: "none", color: copied===path ? "var(--wa)" : "var(--text3)", display: "flex", padding: "2px 4px" }}>
                <Icon name={copied===path ? "check" : "copy"} size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Webhook list */}
      {webhooks.map(wh => (
        <div key={wh.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{wh.name}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <code className="mono" style={{ color: "var(--accent)", fontSize: 12 }}>{wh.url}</code>
                <button onClick={() => copyText(wh.url, wh.id)} style={{ background: "none", border: "none", color: copied===wh.id ? "var(--wa)" : "var(--text3)", display: "flex" }}><Icon name={copied===wh.id?"check":"copy"} size={12}/></button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className={`badge badge-${wh.active?"green":"gray"}`}>{wh.active?"Aktif":"Nonaktif"}</span>
              <Btn onClick={() => openModal(wh)} variant="ghost" size="sm" icon="edit">Edit</Btn>
              <Btn onClick={() => setWebhooks(webhooks.map(w => w.id===wh.id ? {...w,active:!w.active} : w))} variant="ghost" size="sm">{wh.active?"Nonaktifkan":"Aktifkan"}</Btn>
              <Btn onClick={() => setWebhooks(webhooks.filter(w => w.id !== wh.id))} variant="danger" size="sm" icon="trash"></Btn>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>Events:</span>
            {wh.events.map(ev => <span key={ev} className="badge badge-blue" style={{ marginRight: 4 }}>{ev}</span>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Secret:</span>
            <code className="mono" style={{ fontSize: 11, color: "var(--text2)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 4 }}>{wh.secret}</code>
            <button onClick={() => copyText(wh.secret, `s_${wh.id}`)} style={{ background: "none", border: "none", color: copied===`s_${wh.id}` ? "var(--wa)" : "var(--text3)", display: "flex" }}><Icon name={copied===`s_${wh.id}`?"check":"copy"} size={12}/></button>
          </div>
        </div>
      ))}
      {webhooks.length === 0 && <div style={{ textAlign: "center", padding: "60px", color: "var(--text3)" }}><Icon name="webhook" size={36} color="var(--border2)" /><p style={{ marginTop: 12 }}>Belum ada webhook terdaftar</p></div>}

      {modal && (
        <Modal title={modal === "new" ? "Tambah Webhook" : "Edit Webhook"} onClose={() => setModal(null)} width={520}>
          <Input label="Nama Webhook" value={wName} onChange={setWName} placeholder="cth: WA Response Handler" required />
          <Input label="URL Endpoint" value={wUrl} onChange={setWUrl} placeholder="https://your-server.com/webhook" required />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Events yang Dipantau</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {allEvents.map(ev => (
                <label key={ev} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: wEvents.includes(ev) ? "rgba(37,211,102,.1)" : "var(--surface2)", border: `1px solid ${wEvents.includes(ev) ? "var(--wa)" : "var(--border2)"}`, borderRadius: 7, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={wEvents.includes(ev)} onChange={e => setWEvents(e.target.checked ? [...wEvents,ev] : wEvents.filter(x=>x!==ev))} style={{ accentColor: "var(--wa)" }} />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Input label="Secret Key" value={wSecret} onChange={setWSecret} mono />
            <Btn onClick={() => setWSecret(genSecret())} variant="ghost" size="sm" style={{ position: "absolute", right: 0, top: 0 }}>Generate</Btn>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => setModal(null)} variant="ghost">Batal</Btn>
            <Btn onClick={handleSave} disabled={!wName || !wUrl}>Simpan Webhook</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// â”€â”€ SETTINGS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SettingsPage = ({ settings, setSettings }) => {
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const upd = (key, val) => setLocal(p => ({ ...p, [key]: val }));

  return (
    <div className="fade-in">
      <Topbar title="Pengaturan" sub="Konfigurasi API WhatsApp dan integrasi platform" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* WA API */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="whatsapp" size={16} color="var(--wa)" /> WhatsApp Business API
          </h3>
          <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Konfigurasi koneksi ke Meta WhatsApp Business API</p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>API Key (Access Token)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type={showKey ? "text" : "password"} value={local.wapiKey} onChange={e => upd("wapiKey", e.target.value)}
                style={{ flex: 1, padding: "9px 13px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}
              />
              <Btn onClick={() => setShowKey(!showKey)} variant="ghost" size="sm" icon={showKey?"eye":"lock"}></Btn>
            </div>
          </div>
          <Input label="Graph API URL" value={local.wapiUrl} onChange={v => upd("wapiUrl", v)} mono />
          <Input label="Phone Number ID" value={local.waPhoneId} onChange={v => upd("waPhoneId", v)} mono />
          <Input label="Business Account ID" value={local.waBusinessId} onChange={v => upd("waBusinessId", v)} mono />
        </div>
        {/* Platform Settings */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="settings" size={16} color="var(--accent)" /> Pengaturan Platform
          </h3>
          <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Konfigurasi URL survei dan parameter blast</p>
          <Input label="Base URL Survei" value={local.surveyBaseUrl} onChange={v => upd("surveyBaseUrl", v)} help="URL dasar untuk link survei yang dikirim ke responden" mono />
          <Input label="Delay antar pesan (ms)" value={local.blastDelay} onChange={v => upd("blastDelay", v)} type="number" help="Jeda antar pengiriman pesan blast (minimum 300ms)" />
          <Input label="Jumlah percobaan ulang" value={local.retryCount} onChange={v => upd("retryCount", v)} type="number" help="Retry jika gagal kirim (0-5)" />
        </div>
        {/* Webhook to WA */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, gridColumn: "1/-1" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="webhook" size={16} color="var(--yellow)" /> WhatsApp Webhook Configuration
          </h3>
          <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Endpoint yang didaftarkan ke Meta Developer Portal untuk menerima event dari WhatsApp</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Callback URL (daftarkan ke Meta)</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <code className="mono" style={{ flex: 1, fontSize: 12, color: "var(--wa)", background: "var(--surface2)", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border2)", display: "block" }}>
                  {local.surveyBaseUrl.replace("survey","api")}wa/webhook
                </code>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Verify Token</div>
              <code className="mono" style={{ fontSize: 12, color: "var(--yellow)", background: "var(--surface2)", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border2)", display: "block" }}>
                populi_wa_verify_2025
              </code>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Event WhatsApp yang Disubscribe</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["messages","message_deliveries","message_reads","messaging_referrals"].map(ev => (
                <span key={ev} className="badge badge-green">{ev}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <Btn onClick={handleSave} size="lg">{saved ? "Tersimpan!" : "Simpan Pengaturan"}</Btn>
        <Btn onClick={() => setLocal({ ...settings })} variant="ghost" size="lg">Reset</Btn>
      </div>
    </div>
  );
};

// â”€â”€ ADMIN PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminPage = ({ users, setUsers, currentUser }) => {
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [uName, setUName] = useState(""); const [uUsername, setUUsername] = useState("");
  const [uPassword, setUPassword] = useState(""); const [uEmail, setUEmail] = useState("");
  const [uRole, setURole] = useState("admin"); const [uActive, setUActive] = useState(true);
  const uid = () => `u${Date.now()}`;

  const openModal = (user) => {
    if (user === "new") { setUName(""); setUUsername(""); setUPassword(""); setUEmail(""); setURole("admin"); setUActive(true); }
    else { setUName(user.name); setUUsername(user.username); setUPassword(user.password); setUEmail(user.email); setURole(user.role); setUActive(user.active); }
    setModal(user);
  };

  const handleSave = () => {
    if (modal === "new") setUsers([...users, { id: uid(), name: uName, username: uUsername, password: uPassword, email: uEmail, role: uRole, active: uActive, createdAt: new Date().toISOString().split("T")[0] }]);
    else setUsers(users.map(u => u.id === modal.id ? { ...u, name: uName, username: uUsername, password: uPassword, email: uEmail, role: uRole, active: uActive } : u));
    setModal(null);
  };

  const roleColors = { superadmin: "badge-purple", admin: "badge-blue", viewer: "badge-gray" };

  return (
    <div className="fade-in">
      <Topbar title="Kelola Admin" sub="Manajemen pengguna dan hak akses platform" actions={[
        <Btn key="new" onClick={() => openModal("new")} icon="plus">Tambah Pengguna</Btn>
      ]} />
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Pengguna", "Username", "Email", "Role", "Status", "Bergabung", "Aksi"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}
              >
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--wa),var(--wa2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {user.name[0]}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}><code className="mono" style={{ fontSize: 12, color: "var(--text2)" }}>{user.username}</code></td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text2)" }}>{user.email}</td>
                <td style={{ padding: "12px 16px" }}><span className={`badge ${roleColors[user.role]}`}>{user.role}</span></td>
                <td style={{ padding: "12px 16px" }}><span className={`badge badge-${user.active?"green":"red"}`}>{user.active?"Aktif":"Nonaktif"}</span></td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text3)" }}>{user.createdAt}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn onClick={() => openModal(user)} variant="ghost" size="sm" icon="edit"></Btn>
                    {user.id !== currentUser.id && (
                      <>
                        <Btn onClick={() => setUsers(users.map(u => u.id===user.id ? {...u,active:!u.active} : u))} variant="ghost" size="sm" icon={user.active?"lock":"check"}></Btn>
                        <Btn onClick={() => setConfirmDel(user.id)} variant="danger" size="sm" icon="trash"></Btn>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "new" ? "Tambah Pengguna Baru" : "Edit Pengguna"} onClose={() => setModal(null)} width={500}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Nama Lengkap" value={uName} onChange={setUName} placeholder="cth: Budi Santoso" required />
            <Input label="Username" value={uUsername} onChange={setUUsername} placeholder="cth: budi.santoso" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Password" value={uPassword} onChange={setUPassword} placeholder="Minimal 6 karakter" type="password" required />
            <Input label="Email" value={uEmail} onChange={setUEmail} placeholder="user@domain.com" type="email" />
          </div>
          <Select label="Role / Hak Akses" value={uRole} onChange={setURole} options={[
            { value: "superadmin", label: "Super Admin - Akses penuh termasuk kelola user" },
            { value: "admin", label: "Admin - Akses survei, blast, laporan, webhook" },
            { value: "viewer", label: "Viewer - Hanya bisa lihat laporan" },
          ]} />
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 6 }}>HAK AKSES BERDASARKAN ROLE:</div>
            <div style={{ display: "grid", gap: 4 }}>
              {[
                ["Superadmin", "Dashboard, Survei, Blast, Laporan, Webhook, Pengaturan, Kelola Admin"],
                ["Admin", "Dashboard, Survei, Blast, Laporan, Webhook, Pengaturan"],
                ["Viewer", "Dashboard (readonly), Laporan"],
              ].map(([r,p]) => (
                <div key={r} style={{ fontSize: 11, color: "var(--text2)" }}><strong style={{ color: uRole === r.toLowerCase() ? "var(--wa)" : "var(--text2)" }}>- {r}:</strong> {p}</div>
              ))}
            </div>
          </div>
          <Toggle value={uActive} onChange={setUActive} label="Akun aktif dan dapat login" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => setModal(null)} variant="ghost">Batal</Btn>
            <Btn onClick={handleSave} disabled={!uName || !uUsername || !uPassword}>Simpan Pengguna</Btn>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Konfirmasi Hapus Pengguna" onClose={() => setConfirmDel(null)} width={380}>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Akun pengguna ini akan dihapus permanen. Lanjutkan?</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={() => setConfirmDel(null)} variant="ghost">Batal</Btn>
            <Btn onClick={() => { setUsers(users.filter(u => u.id !== confirmDel)); setConfirmDel(null); }} variant="danger">Hapus Pengguna</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// â”€â”€ MAIN APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState(INIT_USERS);
  const [surveys, setSurveys] = useState(INIT_SURVEYS);
  const [segments, setSegments] = useState(INIT_SEGMENTS);
  const [blasts, setBlasts] = useState(INIT_BLASTS);
  const [webhooks, setWebhooks] = useState(INIT_WEBHOOKS);
  const [settings, setSettings] = useState(INIT_SETTINGS);

  useEffect(() => {
    if (!user) return;

    const nextUser = users.find(u => u.id === user.id);

    if (!nextUser || !nextUser.active) {
      setUser(null);
      setActive("dashboard");
      return;
    }

    if (nextUser !== user) {
      setUser(nextUser);
    }
  }, [user, users]);

  if (!user) return (<><GlobalStyle /><LoginPage users={users} onLogin={setUser} /></>);

  const pages = {
    dashboard: <DashboardPage surveys={surveys} blasts={blasts} segments={segments} />,
    surveys: <SurveysPage surveys={surveys} setSurveys={setSurveys} />,
    blast: <BlastPage blasts={blasts} setBlasts={setBlasts} surveys={surveys} segments={segments} setSegments={setSegments} />,
    reports: <ReportsPage surveys={surveys} blasts={blasts} />,
    webhook: <WebhookPage webhooks={webhooks} setWebhooks={setWebhooks} />,
    settings: <SettingsPage settings={settings} setSettings={setSettings} />,
    admin: <AdminPage users={users} setUsers={setUsers} currentUser={user} />,
  };

  return (
    <>
      <GlobalStyle />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} user={user} onLogout={() => { setUser(null); setActive("dashboard"); }} collapsed={collapsed} setCollapsed={setCollapsed} />
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxWidth: "100%" }}>
          {pages[active] || pages.dashboard}
        </main>
      </div>
    </>
  );
}


