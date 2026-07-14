import { Icon, theme } from "./ui";

// Potongan UI bersama untuk semua panduan in-app (Survei, Template, Broadcast).

const guideLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 600,
  textDecoration: "none",
  background: theme.surface,
  color: theme.text,
  border: `1px solid ${theme.border}`,
};

export function GuideLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={guideLinkStyle}>
      <Icon name="link" size={13} />
      {children}
    </a>
  );
}

// steps: array [judul, penjelasan, urlOpsional]
export function GuideSteps({ steps }) {
  return (
    <div style={{ display: "grid", gap: 13 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: theme.primary,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12.5,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{s[0]}</div>
            <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.55 }}>{s[1]}</div>
            {s[2] ? (
              <a
                href={s[2]}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...guideLinkStyle, marginTop: 7, padding: "5px 10px", fontSize: 11.5 }}
              >
                <Icon name="link" size={13} />
                Buka halaman
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// Kotak catatan berwarna: info (biru) | warn (kuning) | danger (merah)
export function GuideNote({ tone = "warn", children }) {
  const map = {
    info: [theme.primarySoft, theme.primary],
    warn: [theme.yellowSoft, theme.yellow],
    danger: [theme.redSoft, theme.red],
  };
  const [bg, fg] = map[tone] || map.warn;
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 12.5,
        color: fg,
        background: bg,
        borderRadius: 8,
        padding: "11px 13px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

export function GuideHeading({ children }) {
  return <h4 style={{ margin: "22px 0 12px", fontSize: 14, color: theme.text }}>{children}</h4>;
}
