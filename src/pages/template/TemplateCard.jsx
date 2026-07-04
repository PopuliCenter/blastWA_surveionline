import { Card, Button, Badge, Icon, theme, fmtDate } from "../../lib/ui";
import { HEADER_TYPES, STATUS_TONE, STATUS_LABEL, USECASE_LABEL, fillVars } from "./constants";

export function TemplateCard({ t, onEdit, onDelete, onDuplicate, onSubmit, submitting }) {
  const headerIcon = { image: "image", document: "doc", video: "eye", text: "template" }[t.headerType];
  return (
    <Card pad={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: theme.text,
              fontSize: 14.5,
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {t.name}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
            <Badge tone="blue">{t.category}</Badge>
            <Badge tone="purple">{t.language}</Badge>
            {t.useCase ? <Badge>{USECASE_LABEL[t.useCase] || t.useCase}</Badge> : null}
          </div>
        </div>
        <Badge tone={STATUS_TONE[t.status] || "default"}>{STATUS_LABEL[t.status] || t.status}</Badge>
      </div>

      {t.headerType !== "none" ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12, color: theme.textMuted }}
        >
          <Icon name={headerIcon} size={15} />
          <span>
            Header:{" "}
            {t.headerType === "text"
              ? `"${t.headerText || ""}"`
              : HEADER_TYPES.find((h) => h.value === t.headerType)?.label}
          </span>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 10,
          background: theme.surfaceAlt,
          borderRadius: 9,
          padding: 11,
          fontSize: 12.5,
          color: theme.text,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          maxHeight: 96,
          overflow: "hidden",
        }}
      >
        {fillVars(t.bodyText, t.sampleParams)}
      </div>

      {(t.buttons || []).length ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: theme.textMuted }}>{t.buttons.length} tombol</div>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {t.status !== "approved" && t.status !== "submitted" ? (
          <Button size="sm" icon="send" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Mengajukan…" : "Ajukan ke Meta"}
          </Button>
        ) : null}
        {t.status === "submitted" ? <Badge tone="yellow">menunggu review Meta</Badge> : null}
        <Button size="sm" variant="secondary" icon="edit" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={onDuplicate}>
          Duplikat
        </Button>
        <Button size="sm" variant="danger" icon="trash" onClick={onDelete}>
          Hapus
        </Button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>Diubah {fmtDate(t.updatedAt)}</div>
    </Card>
  );
}
