import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { exportResponses } from "../../lib/exportSurvey";
import {
  Button,
  Badge,
  Modal,
  Notice,
  Loading,
  Empty,
  useLoader,
  useSelection,
  Checkbox,
  BulkBar,
  theme,
  fmtDate,
} from "../../lib/ui";

export function ResponsesModal({ survey, onClose }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.surveyResponses(survey.id), [survey.id]));
  const responses = data || [];
  const [upper, setUpper] = useState(false);
  const sel = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  const bulkDelete = async () => {
    if (!sel.size || !window.confirm(`Hapus ${sel.size} responden terpilih? Jawaban mereka ikut terhapus permanen.`))
      return;
    setBulkBusy(true);
    setDelErr("");
    try {
      await api.bulkDeleteResponses(sel.list());
      sel.clear();
      await reload();
    } catch (e) {
      setDelErr(e.message);
    } finally {
      setBulkBusy(false);
    }
  };
  const [busyId, setBusyId] = useState("");
  const deleteOne = async (r) => {
    if (
      !window.confirm(
        `Hapus respons dari ${r.name || r.phone}? Jawabannya terhapus permanen. (mis. tertukar setelah revisi soal)`,
      )
    )
      return;
    setBusyId(r.id);
    setDelErr("");
    try {
      await api.bulkDeleteResponses([r.id]);
      await reload();
    } catch (e) {
      setDelErr(e.message);
    } finally {
      setBusyId("");
    }
  };
  return (
    <Modal title={`Respons: ${survey.title}`} onClose={onClose} width={760}>
      <Notice>{error || delErr}</Notice>
      <BulkBar
        count={sel.size}
        total={responses.length}
        allSelected={responses.length > 0 && responses.every((r) => sel.has(r.id))}
        noun="responden"
        busy={bulkBusy}
        onToggleAll={() =>
          responses.every((r) => sel.has(r.id)) ? sel.clear() : sel.setAll(responses.map((r) => r.id))
        }
        onClear={sel.clear}
        onDelete={bulkDelete}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          {responses.length} responden
          {responses.length ? ` • ${responses.filter((r) => r.completedAt).length} selesai` : ""}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: theme.textMuted,
              cursor: "pointer",
            }}
            title="Ubah semua nilai jadi huruf kapital saat ekspor"
          >
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> HURUF KAPITAL
          </label>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => exportResponses(survey, responses, "xlsx", { upper })}
            disabled={!responses.length}
          >
            Export Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => exportResponses(survey, responses, "csv", { upper })}
            disabled={!responses.length}
          >
            CSV
          </Button>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : responses.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {responses.map((r) => (
            <div
              key={r.id}
              style={{
                background: theme.surfaceAlt,
                borderRadius: 10,
                padding: 14,
                outline: sel.has(r.id) ? `2px solid ${theme.primary}` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Checkbox checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} />
                  <strong style={{ color: theme.text }}>{r.name || r.phone}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge tone={r.completedAt ? "green" : "yellow"}>{r.completedAt ? "selesai" : "berlangsung"}</Badge>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={() => deleteOne(r)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? "…" : "Hapus"}
                  </Button>
                </div>
              </div>
              <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 10 }}>
                {r.phone} • {fmtDate(r.startedAt)}
              </div>
              {r.answers.length ? (
                r.answers.map((a, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${theme.green}`, paddingLeft: 11, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{a.question}</div>
                    <div style={{ fontSize: 14, color: theme.text }}>{a.value}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada jawaban.</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="survey" title="Belum ada respons" />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
