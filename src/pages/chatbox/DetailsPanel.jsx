import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { Badge, Button, Loading, theme, fmtDate, useLoader } from "../../lib/ui";
import { sessionInfo } from "./constants";

// ── Panel detail (kanan) ────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: theme.text }}>{value}</div>
    </div>
  );
}

export function DetailsPanel({ convo, onResolve, bare }) {
  const notes = useLoader(useCallback(() => api.listNotes(convo.id), [convo.id]));
  const [noteText, setNoteText] = useState("");
  const [adding, setAdding] = useState(false);
  const sess = sessionInfo(convo);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAdding(true);
    try {
      await api.addNote(convo.id, noteText.trim());
      setNoteText("");
      await notes.reload();
    } finally {
      setAdding(false);
    }
  };

  const body = (
    <div style={{ padding: bare ? 0 : 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: theme.primarySoft,
            color: theme.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          {(convo.name || convo.phone).slice(0, 1).toUpperCase()}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{convo.name || "(tanpa nama)"}</div>
        <div style={{ fontSize: 12.5, color: theme.textMuted }}>{convo.phone}</div>
        <div style={{ marginTop: 8 }}>
          <Badge tone={sess.tone}>{sess.label}</Badge>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Detail Percakapan
        </div>
        <DetailRow label="Vendor" value={convo.vendor ? convo.vendor.toUpperCase() : "—"} />
        <DetailRow label="Dibuat" value={fmtDate(convo.firstAt)} />
        <DetailRow label="Aktivitas terakhir" value={fmtDate(convo.lastAt)} />
        <DetailRow
          label="Status sesi"
          value={
            sess.active
              ? sess.detail
              : convo.sessionExpiresAt
                ? `Kedaluwarsa ${fmtDate(convo.sessionExpiresAt)}`
                : "Belum dibuka"
          }
        />
        <DetailRow label="Status" value={convo.resolved ? "Selesai" : "Terbuka"} />
        <Button
          variant={convo.resolved ? "secondary" : "success"}
          size="sm"
          icon={convo.resolved ? "refresh" : "check"}
          onClick={() => onResolve(convo.id, !convo.resolved)}
          style={{ width: "100%", marginTop: 4 }}
        >
          {convo.resolved ? "Buka kembali" : "Tandai selesai"}
        </Button>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Catatan
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !adding && addNote()}
            placeholder="Tambah catatan..."
            style={{
              flex: 1,
              padding: "8px 10px",
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              fontSize: 12.5,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <Button size="sm" icon="plus" onClick={addNote} disabled={adding || !noteText.trim()} />
        </div>
        {notes.loading ? (
          <Loading />
        ) : (notes.data || []).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(notes.data || []).map((n, i) => (
              <div key={i} style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "8px 11px" }}>
                <div style={{ fontSize: 12.5, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {n.text}
                </div>
                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3 }}>{fmtDate(n.at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>Belum ada catatan.</div>
        )}
      </div>
    </div>
  );

  return body;
}
