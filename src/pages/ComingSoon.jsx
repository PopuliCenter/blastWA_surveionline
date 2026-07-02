import { PageHeader, Card, Icon, theme, Badge } from "../lib/ui";

export default function ComingSoon({ title, icon = "sparkle", desc, features = [] }) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Fitur ini sedang dalam pengembangan."
        actions={<Badge tone="yellow">Segera hadir</Badge>}
      />
      <Card>
        <div style={{ textAlign: "center", padding: "32px 20px" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: theme.primarySoft,
              color: theme.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Icon name={icon} size={28} />
          </div>
          <h3 style={{ margin: "0 0 8px", color: theme.text }}>{title}</h3>
          <p style={{ color: theme.textMuted, maxWidth: 460, margin: "0 auto", fontSize: 13.5, lineHeight: 1.6 }}>
            {desc}
          </p>
          {features.length ? (
            <div style={{ display: "inline-grid", gap: 8, marginTop: 20, textAlign: "left" }}>
              {features.map((f) => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "center", color: theme.text, fontSize: 13 }}>
                  <span style={{ color: theme.green, display: "flex" }}>
                    <Icon name="check" size={15} />
                  </span>
                  {f}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
