import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirm";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  StatCard,
  Notice,
  Loading,
  Empty,
  Tabs,
  useLoader,
  useSelection,
  Checkbox,
  BulkBar,
  theme,
  fmtDate,
} from "../lib/ui";
import { ManageSegmentModal } from "./blast/ManageSegmentModal";
import { AddContactsModal } from "./blast/AddContactsModal";
import { BlastReportModal } from "./blast/BlastReportModal";
import { BlastModal } from "./blast/BlastModal";
import { CostSimulator } from "./blast/CostSimulator";
import { SegmentModal } from "./blast/SegmentModal";

export default function Broadcast() {
  const blasts = useLoader(useCallback(() => api.listBlasts(), []));
  const segments = useLoader(useCallback(() => api.listSegments(), []));
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const templates = useLoader(useCallback(() => api.listTemplates(), []));
  const [tab, setTab] = useState("blasts");
  const [showBlast, setShowBlast] = useState(false);
  const [showSeg, setShowSeg] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [reportBlast, setReportBlast] = useState(null);
  const [addSeg, setAddSeg] = useState(null);
  const [manageSeg, setManageSeg] = useState(null);
  const selBlast = useSelection();
  const selSeg = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const blastList = blasts.data || [];
  const segList = segments.data || [];

  const run = async (fn, reloaders = []) => {
    setErr("");
    try {
      await fn();
      await Promise.all(reloaders.map((r) => r()));
    } catch (e) {
      setErr(e.message);
    }
  };

  const renameSeg = async (s) => {
    const name = window.prompt("Nama baru segmen:", s.name);
    if (name && name.trim() && name.trim() !== s.name)
      await run(() => api.renameSegment(s.id, name.trim()), [segments.reload]);
  };

  const bulkDel = async (which) => {
    const s = which === "blasts" ? selBlast : selSeg;
    if (!s.size) return;
    if (
      !(await confirmDialog({
        title: `Hapus ${which === "blasts" ? "blast" : "segmen"}`,
        message: `Hapus ${s.size} ${which === "blasts" ? "blast" : "segmen"} terpilih? Tindakan ini permanen.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    setBulkBusy(true);
    setErr("");
    try {
      if (which === "blasts") {
        await api.bulkDeleteBlasts(s.list());
        await blasts.reload();
      } else {
        await api.bulkDeleteSegments(s.list());
        await segments.reload();
      }
      s.clear();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Kirim pesan/survei ke segmen kontak."
        actions={[
          <Button
            key="r"
            variant="ghost"
            icon="refresh"
            onClick={() => {
              blasts.reload();
              segments.reload();
            }}
          >
            Refresh
          </Button>,
          <Button key="s" variant="secondary" icon="plus" onClick={() => setShowSeg(true)}>
            Segmen
          </Button>,
          <Button key="b" icon="broadcast" onClick={() => setShowBlast(true)}>
            Buat Blast
          </Button>,
        ]}
      />
      <Notice>{err || blasts.error || segments.error}</Notice>
      <Notice kind="success">{note}</Notice>
      <Tabs
        active={tab}
        onChange={setTab}
        style={{ marginBottom: 16 }}
        tabs={[
          { id: "blasts", label: "Riwayat Blast" },
          { id: "segments", label: "Segmen" },
          { id: "cost", label: "Simulasi Biaya" },
        ]}
      />

      {tab === "cost" ? (
        <CostSimulator segments={segments.data || []} />
      ) : tab === "blasts" ? (
        blasts.loading ? (
          <Loading />
        ) : blastList.length ? (
          <>
            <BulkBar
              count={selBlast.size}
              total={blastList.length}
              allSelected={blastList.every((b) => selBlast.has(b.id))}
              noun="blast"
              busy={bulkBusy}
              onToggleAll={() =>
                blastList.every((b) => selBlast.has(b.id))
                  ? selBlast.clear()
                  : selBlast.setAll(blastList.map((b) => b.id))
              }
              onClear={selBlast.clear}
              onDelete={() => bulkDel("blasts")}
            />
            <div style={{ display: "grid", gap: 14 }}>
              {blastList.map((b) => (
                <Card key={b.id} style={selBlast.has(b.id) ? { outline: `2px solid ${theme.primary}` } : undefined}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ paddingTop: 2 }}>
                        <Checkbox checked={selBlast.has(b.id)} onChange={() => selBlast.toggle(b.id)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{b.surveyTitle}</div>
                        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>
                          {b.segmentName} • vendor {b.vendor} • template {b.message || "-"} • {fmtDate(b.sentAt)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      tone={
                        b.status === "completed"
                          ? "green"
                          : b.status === "failed"
                            ? "red"
                            : b.status === "scheduled"
                              ? "yellow"
                              : "blue"
                      }
                    >
                      {b.status}
                    </Badge>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <StatCard label="Sent" value={b.sent} tone="blue" />
                    <StatCard label="Delivered" value={b.delivered} tone="green" />
                    <StatCard label="Dibaca" value={b.opened} tone="purple" />
                    <StatCard label="Gagal" value={b.failed} tone="yellow" />
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="secondary" size="sm" icon="report" onClick={() => setReportBlast(b)}>
                      Laporan
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash"
                      onClick={() => run(() => api.deleteBlast(b.id), [blasts.reload])}
                    >
                      Hapus
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <Empty icon="broadcast" title="Belum ada blast" />
          </Card>
        )
      ) : segments.loading ? (
        <Loading />
      ) : segList.length ? (
        <>
          <BulkBar
            count={selSeg.size}
            total={segList.length}
            allSelected={segList.every((s) => selSeg.has(s.id))}
            noun="segmen"
            busy={bulkBusy}
            onToggleAll={() =>
              segList.every((s) => selSeg.has(s.id)) ? selSeg.clear() : selSeg.setAll(segList.map((s) => s.id))
            }
            onClear={selSeg.clear}
            onDelete={() => bulkDel("segments")}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {segList.map((s) => (
              <Card key={s.id} style={selSeg.has(s.id) ? { outline: `2px solid ${theme.primary}` } : undefined}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Checkbox checked={selSeg.has(s.id)} onChange={() => selSeg.toggle(s.id)} />
                  <div style={{ fontWeight: 700, color: theme.text }}>{s.name}</div>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{s.contacts.length} kontak</div>
                <div
                  style={{
                    marginTop: 10,
                    background: theme.surfaceAlt,
                    borderRadius: 9,
                    padding: 10,
                    fontSize: 12,
                    color: theme.textMuted,
                  }}
                >
                  {s.contacts.slice(0, 5).join(", ")}
                  {s.contacts.length > 5 ? "…" : ""}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="secondary" size="sm" icon="contacts" onClick={() => setManageSeg(s)}>
                    Kelola Kontak
                  </Button>
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => setAddSeg(s)}>
                    Tambah
                  </Button>
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => renameSeg(s)}>
                    Ganti Nama
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={() => run(() => api.deleteSegment(s.id), [segments.reload])}
                  >
                    Hapus
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <Empty icon="contacts" title="Belum ada segmen" />
        </Card>
      )}

      {showBlast ? (
        <BlastModal
          surveys={surveys.data || []}
          segments={segments.data || []}
          templates={templates.data || []}
          onClose={() => setShowBlast(false)}
          onSave={(d) =>
            run(async () => {
              setNote("");
              const r = await api.createBlast(d);
              setNote(
                r?.excludedOptOut
                  ? `Blast dibuat. ${r.excludedOptOut} kontak opt-out otomatis dikecualikan.`
                  : "Blast dibuat & sedang dikirim.",
              );
            }, [blasts.reload]).then(() => setShowBlast(false))
          }
        />
      ) : null}
      {showSeg ? (
        <SegmentModal
          onClose={() => setShowSeg(false)}
          onSave={(d) => run(() => api.createSegment(d), [segments.reload]).then(() => setShowSeg(false))}
        />
      ) : null}
      {addSeg ? (
        <AddContactsModal
          segment={addSeg}
          onClose={() => setAddSeg(null)}
          onDone={() => {
            setAddSeg(null);
            segments.reload();
          }}
        />
      ) : null}
      {manageSeg ? (
        <ManageSegmentModal
          segment={manageSeg}
          onClose={() => {
            setManageSeg(null);
            segments.reload();
          }}
        />
      ) : null}
      {reportBlast ? <BlastReportModal blast={reportBlast} onClose={() => setReportBlast(null)} /> : null}
    </div>
  );
}
