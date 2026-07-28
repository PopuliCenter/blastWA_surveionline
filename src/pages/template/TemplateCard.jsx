import { Card, Button, Badge, Icon, theme, fmtDate } from "../../lib/ui";
import { HEADER_TYPES, USECASE_LABEL, META_QUALITY, metaState, fillVars } from "./constants";

export function TemplateCard({ t, onEdit, onDelete, onDuplicate, onSubmit, submitting }) {
  const headerIcon = { image: "image", document: "doc", video: "eye", text: "template" }[t.headerType];
  const ms = metaState(t); // status ASLI di Meta — sumber kebenaran
  const quality = t.metaQuality ? META_QUALITY[t.metaQuality] : null;
  // Ajukan hanya masuk akal bila belum ada di Meta (atau ditolak → perbaiki lalu ajukan ulang).
  const canSubmit = ms.key === "unsynced" || ms.key === "missing" || ms.key === "REJECTED";
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
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
          <Badge tone={ms.tone}>{ms.label}</Badge>
          {quality ? <Badge tone={quality.tone}>{quality.label}</Badge> : null}
        </div>
      </div>

      {/* Alasan penolakan & waktu sinkron — supaya jelas apa yang harus diperbaiki. */}
      {ms.key === "REJECTED" && t.metaReason ? (
        <div
          style={{
            marginTop: 9,
            fontSize: 11.5,
            color: theme.red,
            background: theme.redSoft,
            borderRadius: 8,
            padding: "7px 10px",
            lineHeight: 1.5,
          }}
        >
          Alasan Meta: <strong>{t.metaReason}</strong>
        </div>
      ) : null}
      {ms.key === "missing" ? (
        <div
          style={{
            marginTop: 9,
            fontSize: 11.5,
            color: theme.yellow,
            background: theme.yellowSoft,
            borderRadius: 8,
            padding: "7px 10px",
            lineHeight: 1.5,
          }}
        >
          Belum pernah diajukan (atau namanya berbeda di Meta). <strong>Tidak bisa dipakai broadcast.</strong>
        </div>
      ) : null}
      {ms.key === "unsynced" ? (
        <div style={{ marginTop: 9, fontSize: 11.5, color: theme.textMuted, lineHeight: 1.5 }}>
          Status Meta belum diketahui — klik <strong>Sinkron status Meta</strong>.
        </div>
      ) : null}

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
        {canSubmit ? (
          <Button size="sm" icon="send" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Mengajukan…" : ms.key === "REJECTED" ? "Ajukan Ulang" : "Ajukan ke Meta"}
          </Button>
        ) : null}
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
      <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
        Diubah {fmtDate(t.updatedAt)}
        {t.metaSyncedAt ? ` • sinkron Meta ${fmtDate(t.metaSyncedAt)}` : ""}
      </div>
    </Card>
  );
}
