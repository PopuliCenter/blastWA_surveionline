import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { exportResponses } from "../../lib/exportSurvey";
import { confirmDialog } from "../../lib/confirm";
import {
  Button,
  Badge,
  Modal,
  Notice,
  Loading,
  Empty,
  Icon,
  useLoader,
  useSelection,
  Checkbox,
  BulkBar,
  theme,
  fmtDate,
} from "../../lib/ui";

const PER_PAGE_OPTIONS = [20, 50, 100];

export function ResponsesModal({ survey, onClose }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.surveyResponses(survey.id), [survey.id]));
  const responses = data || [];
  const [upper, setUpper] = useState(false);
  const sel = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  // Jawaban disembunyikan secara default agar daftar ringkas; expand per responden.
  const [expanded, setExpanded] = useState(() => new Set());
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const total = responses.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const curPage = Math.min(page, pageCount); // clamp: daftar bisa menyusut setelah hapus
  const start = (curPage - 1) * perPage;
  const pageItems = responses.slice(start, start + perPage);

  const toggleExpand = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allExpanded = pageItems.length > 0 && pageItems.every((r) => expanded.has(r.id));
  const toggleAllExpand = () =>
    setExpanded((s) => {
      const n = new Set(s);
      pageItems.forEach((r) => (allExpanded ? n.delete(r.id) : n.add(r.id)));
      return n;
    });
  const bulkDelete = async () => {
    if (!sel.size) return;
    if (
      !(await confirmDialog({
        title: "Hapus responden",
        message: `Hapus ${sel.size} responden terpilih? Jawaban mereka ikut terhapus permanen.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
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
      !(await confirmDialog({
        title: "Hapus respons",
        message: `Hapus respons dari ${r.name || r.phone}? Jawabannya terhapus permanen. (mis. tertukar setelah revisi soal)`,
        confirmText: "Hapus",
        tone: "danger",
      }))
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
          {pageItems.length ? (
            <Button variant="ghost" size="sm" icon={allExpanded ? "up" : "down"} onClick={toggleAllExpand}>
              {allExpanded ? "Tutup semua" : "Buka semua"}
            </Button>
          ) : null}
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
          {pageItems.map((r) => {
            const open = expanded.has(r.id);
            return (
              <div
                key={r.id}
                style={{
                  background: theme.surfaceAlt,
                  borderRadius: 10,
                  padding: 14,
                  outline: sel.has(r.id) ? `2px solid ${theme.primary}` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <Checkbox checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} />
                    {/* Seluruh area nama bisa diklik untuk buka/tutup jawaban */}
                    <button
                      onClick={() => toggleExpand(r.id)}
                      aria-expanded={open}
                      title={open ? "Tutup jawaban" : "Lihat jawaban"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        minWidth: 0,
                        color: theme.text,
                        fontFamily: "inherit",
                      }}
                    >
                      <Icon name={open ? "up" : "down"} size={16} />
                      <strong style={{ fontSize: 14 }}>{r.name || r.phone}</strong>
                      <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>
                        ({r.answers.length} jawaban)
                      </span>
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  {r.phone} • {fmtDate(r.startedAt)}
                </div>
                {open ? (
                  <div style={{ marginTop: 10 }}>
                    {r.answers.length ? (
                      r.answers.map((a, i) => (
                        <div
                          key={i}
                          style={{ borderLeft: `3px solid ${theme.green}`, paddingLeft: 11, marginBottom: 8 }}
                        >
                          <div style={{ fontSize: 12, color: theme.textMuted }}>{a.question}</div>
                          <div style={{ fontSize: 14, color: theme.text }}>{a.value}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada jawaban.</div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon="survey" title="Belum ada respons" />
      )}

      {total > PER_PAGE_OPTIONS[0] ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>
            Menampilkan {start + 1}–{Math.min(start + perPage, total)} dari {total}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Jumlah per halaman"
              style={{
                padding: "6px 9px",
                border: `1px solid ${theme.border}`,
                borderRadius: 8,
                background: theme.surface,
                color: theme.text,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / halaman
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon="back"
              onClick={() => setPage(curPage - 1)}
              disabled={curPage <= 1}
            >
              Sebelumnya
            </Button>
            <span style={{ fontSize: 12.5, color: theme.textMuted, minWidth: 78, textAlign: "center" }}>
              Hal. {curPage} / {pageCount}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage(curPage + 1)} disabled={curPage >= pageCount}>
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
