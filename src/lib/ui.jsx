import { useCallback, useEffect, useState } from "react";

// ===== Tema terang & clean (SaaS modern) =====
export const theme = {
  bg: "#f5f7fb",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e6eaf1",
  text: "#0f172a",
  textMuted: "#64748b",
  primary: "#2563eb",
  primarySoft: "#eff5ff",
  green: "#16a34a",
  greenSoft: "#ecfdf3",
  yellow: "#d97706",
  yellowSoft: "#fffbeb",
  red: "#dc2626",
  redSoft: "#fef2f2",
  purple: "#7c3aed",
  purpleSoft: "#f5f3ff",
};

export const card = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
};

export const fontStack = "'Inter','Segoe UI',system-ui,sans-serif";

// ===== Ikon (stroke SVG) =====
export function Icon({ name, size = 18 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const I = {
    dashboard: <svg {...c}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
    whatsapp: <svg {...c}><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 9c0 4 2.5 6.5 6.5 6.5" /></svg>,
    instagram: <svg {...c}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" /></svg>,
    contacts: <svg {...c}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M21 21v-2a4 4 0 0 0-3-3.9" /></svg>,
    chat: <svg {...c}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>,
    broadcast: <svg {...c}><circle cx="6" cy="12" r="2" /><path d="M11 8a6 6 0 0 1 0 8" /><path d="M14 5a10 10 0 0 1 0 14" /></svg>,
    story: <svg {...c}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /><circle cx="12" cy="12" r="3.5" /></svg>,
    survey: <svg {...c}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>,
    autoreply: <svg {...c}><path d="M9 17H7A4 4 0 0 1 7 9h1" /><path d="M15 7h2a4 4 0 0 1 0 8h-1" /><path d="M8 13h8" /></svg>,
    leads: <svg {...c}><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>,
    ai: <svg {...c}><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 7V4" /><circle cx="9" cy="13" r="1" fill="currentColor" /><circle cx="15" cy="13" r="1" fill="currentColor" /></svg>,
    invoice: <svg {...c}><path d="M6 2h9l4 4v16l-2-1-2 1-2-1-2 1-2-1-2 1V2Z" /><path d="M9 7h5M9 11h6M9 15h4" /></svg>,
    webhook: <svg {...c}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>,
    settings: <svg {...c}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></svg>,
    admin: <svg {...c}><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" /><path d="M9 12l2 2 4-4" /></svg>,
    plus: <svg {...c}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    edit: <svg {...c}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
    trash: <svg {...c}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    search: <svg {...c}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    send: <svg {...c}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
    refresh: <svg {...c}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></svg>,
    logout: <svg {...c}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    close: <svg {...c}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    check: <svg {...c}><polyline points="20 6 9 17 4 12" /></svg>,
    sparkle: <svg {...c}><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" /></svg>,
    upload: <svg {...c}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    download: <svg {...c}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    eye: <svg {...c}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    menu: <svg {...c}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    back: <svg {...c}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>,
    report: <svg {...c}><line x1="3" y1="21" x2="21" y2="21" /><rect x="4" y="11" width="4" height="7" /><rect x="10" y="6" width="4" height="12" /><rect x="16" y="9" width="4" height="9" /></svg>,
  };
  return I[name] || <span style={{ width: size, display: "inline-block" }} />;
}

export function Badge({ tone = "default", children }) {
  const map = {
    default: [theme.surfaceAlt, theme.textMuted],
    green: [theme.greenSoft, theme.green],
    yellow: [theme.yellowSoft, theme.yellow],
    red: [theme.redSoft, theme.red],
    blue: [theme.primarySoft, theme.primary],
    purple: [theme.purpleSoft, theme.purple],
  };
  const [bg, fg] = map[tone] || map.default;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: bg, color: fg }}>{children}</span>;
}

export function Button({ children, icon, variant = "primary", size = "md", ...props }) {
  const variants = {
    primary: { background: theme.primary, color: "#fff", border: "none" },
    secondary: { background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` },
    ghost: { background: "transparent", color: theme.textMuted, border: "none" },
    danger: { background: theme.surface, color: theme.red, border: `1px solid ${theme.redSoft}` },
    success: { background: theme.green, color: "#fff", border: "none" },
  };
  const pad = size === "sm" ? "7px 11px" : "10px 15px";
  return (
    <button {...props} style={{ padding: pad, borderRadius: 9, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.55 : 1, transition: "filter .15s", fontFamily: fontStack, ...variants[variant], ...(props.style || {}) }}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      {label ? <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 6 }}>{label}</div> : null}
      {children}
      {hint && !error ? <div style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 5 }}>{hint}</div> : null}
      {error ? <div style={{ color: theme.red, fontSize: 11.5, marginTop: 5 }}>{error}</div> : null}
    </label>
  );
}

const inputStyle = (error) => ({
  width: "100%", padding: "10px 12px", background: theme.surface, color: theme.text,
  border: `1px solid ${error ? theme.red : theme.border}`, borderRadius: 9, fontSize: 13.5,
  boxSizing: "border-box", fontFamily: fontStack, outline: "none",
});

export function Input({ label, error, hint, ...props }) {
  return <Field label={label} error={error} hint={hint}><input {...props} style={{ ...inputStyle(error), ...(props.style || {}) }} /></Field>;
}
export function Textarea({ label, error, hint, ...props }) {
  return <Field label={label} error={error} hint={hint}><textarea {...props} style={{ ...inputStyle(error), minHeight: 92, resize: "vertical", ...(props.style || {}) }} /></Field>;
}
export function Select({ label, error, options, ...props }) {
  return (
    <Field label={label} error={error}>
      <select {...props} style={{ ...inputStyle(error), cursor: "pointer", ...(props.style || {}) }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <span onClick={() => onChange(!checked)} style={{ width: 40, height: 23, borderRadius: 999, background: checked ? theme.green : "#cbd5e1", position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </span>
      {label ? <span style={{ fontSize: 13, color: theme.text }}>{label}</span> : null}
    </label>
  );
}

export function Modal({ title, children, onClose, width = 600 }) {
  const isMobile = useIsMobile();
  const overlay = isMobile ? { padding: 0, alignItems: "stretch" } : { padding: "6vh 16px", alignItems: "flex-start" };
  const box = isMobile
    ? { width: "100%", maxWidth: "100%", minHeight: "100vh", borderRadius: 0, padding: 20 }
    : { width: "100%", maxWidth: width, maxHeight: "86vh", padding: 22 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "center", overflowY: "auto", zIndex: 60, ...overlay }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, overflow: "auto", ...box }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: theme.text }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, color: theme.text, fontWeight: 700 }}>{title}</h1>
        {subtitle ? <p style={{ color: theme.textMuted, margin: "5px 0 0", fontSize: 13.5 }}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, note, tone = "blue", icon }) {
  const map = { blue: [theme.primarySoft, theme.primary], green: [theme.greenSoft, theme.green], yellow: [theme.yellowSoft, theme.yellow], purple: [theme.purpleSoft, theme.purple] };
  const [bg, fg] = map[tone] || map.blue;
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: theme.textMuted, fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {icon ? <span style={{ width: 32, height: 32, borderRadius: 8, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span> : null}
      </div>
      <div style={{ fontSize: 27, fontWeight: 700, color: theme.text, marginTop: 10 }}>{value}</div>
      {note ? <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>{note}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, pad = 18, style }) {
  return (
    <div style={{ ...card, ...style }}>
      {(title || actions) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `14px ${pad}px`, borderBottom: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: 0, fontSize: 15, color: theme.text }}>{title}</h3>
          {actions}
        </div>
      ) : null}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

export function Notice({ kind = "error", children }) {
  if (!children) return null;
  const map = { error: [theme.redSoft, theme.red], success: [theme.greenSoft, theme.green], info: [theme.primarySoft, theme.primary] };
  const [bg, fg] = map[kind] || map.error;
  return <div style={{ background: bg, color: fg, borderRadius: 9, padding: "10px 13px", marginBottom: 14, fontSize: 13 }}>{children}</div>;
}

export function Loading({ children = "Memuat..." }) {
  return <div style={{ color: theme.textMuted, padding: 28, textAlign: "center", fontSize: 13.5 }}>{children}</div>;
}

export function Empty({ icon = "survey", title = "Belum ada data", note }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: theme.textMuted }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: theme.surfaceAlt, display: "inline-flex", alignItems: "center", justifyContent: "center", color: theme.textMuted, marginBottom: 12 }}><Icon name={icon} size={22} /></div>
      <div style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>{title}</div>
      {note ? <div style={{ fontSize: 13, marginTop: 4 }}>{note}</div> : null}
    </div>
  );
}

// Hook media query reaktif — true bila viewport cocok dengan query
export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// True bila layar selebar ponsel (≤ 768px)
export function useIsMobile(breakpoint = 768) {
  return useMediaQuery(`(max-width: ${breakpoint}px)`);
}

// Hook pemuat data: loader stabil (useCallback) → fetch otomatis + reload()
export function useLoader(loader) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    setLoading(true);
    return loader().then((d) => { setData(d); setError(""); return d; }).catch((e) => setError(e.message || "Gagal memuat")).finally(() => setLoading(false));
  }, [loader]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

export function fmtDate(d) {
  try { return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(d); }
}
