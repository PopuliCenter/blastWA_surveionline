import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Notice, Loading, Empty, Icon, useLoader, useIsMobile, theme } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";
import { blankTemplate } from "./template/constants";
import { TemplateCard } from "./template/TemplateCard";
import { PresetPicker } from "./template/PresetPicker";
import { TemplateEditor } from "./template/TemplateEditor";
import { TemplateGuide } from "./template/TemplateGuide";

export default function Templates() {
  const tpls = useLoader(useCallback(() => api.listTemplates(), []));
  const [editing, setEditing] = useState(null); // objek template yg diedit/dibuat
  const [presetOpen, setPresetOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const isMobile = useIsMobile();

  const run = async (fn) => {
    setErr("");
    try {
      await fn();
      await tpls.reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  const submitToMeta = async (t) => {
    if (
      !(await confirmDialog({
        title: "Ajukan ke Meta",
        message: `Ajukan template "${t.name}" (${t.language}) ke Meta untuk direview?`,
        confirmText: "Ajukan",
      }))
    )
      return;
    setBusyId(t.id);
    setErr("");
    setNote("");
    try {
      const r = await api.submitTemplate(t.id);
      setNote(
        `Template "${t.name}" diajukan ke Meta (status: ${r.status}). Tunggu review Meta (menit–jam), lalu klik "Sinkron status Meta".`,
      );
      await tpls.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId("");
    }
  };

  const syncStatus = async () => {
    setSyncing(true);
    setErr("");
    setNote("");
    try {
      const r = await api.syncTemplates();
      setNote(
        `Sinkron selesai: ${r.updated} status diperbarui dari Meta, ${r.notFound} belum ada di Meta (total ${r.remoteCount} template di Meta).`,
      );
      await tpls.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const save = async (data) => {
    const payload = { ...data, buttons: data.buttons || [], sampleParams: data.sampleParams || [] };
    if (data.id) await api.updateTemplate(data.id, payload);
    else await api.createTemplate(payload);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Template Pesan"
        subtitle="Buat & kelola template WhatsApp untuk broadcast. Template wajib disetujui Meta sebelum dipakai."
        actions={[
          <Button key="g" variant="secondary" icon="doc" onClick={() => setGuideOpen((v) => !v)}>
            {guideOpen ? "Tutup Panduan" : "Panduan"}
          </Button>,
          <Button key="s" variant="secondary" icon="refresh" onClick={syncStatus} disabled={syncing}>
            {syncing ? "Sinkron…" : "Sinkron status Meta"}
          </Button>,
          <Button key="p" variant="secondary" icon="sparkle" onClick={() => setPresetOpen(true)}>
            Pakai Contoh
          </Button>,
          <Button key="n" icon="plus" onClick={() => setEditing(blankTemplate())}>
            Buat Template
          </Button>,
        ]}
      />

      <Notice>{err || tpls.error}</Notice>
      <Notice kind="success">{note}</Notice>

      {guideOpen ? <TemplateGuide /> : null}

      <Card style={{ marginBottom: 16 }} pad={16}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: theme.primarySoft,
              color: theme.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="template" size={18} />
          </span>
          <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: theme.text }}>Cara kerja:</strong> susun template di sini → klik{" "}
            <strong>Ajukan ke Meta</strong> (kirim untuk direview) → tunggu → klik <strong>Sinkron status Meta</strong>{" "}
            agar status berubah <strong>Disetujui</strong> secara otomatis → baru bisa dipilih di Blast.
            <div style={{ marginTop: 5, color: theme.yellow }}>
              ⚠ Status pada kartu adalah <strong>label lokal</strong>. Yang menentukan bisa/tidaknya dipakai broadcast
              adalah status ASLI di Meta — pastikan lewat <strong>Ajukan → Sinkron</strong> (atau lihat di Broadcast →
              "Ambil dari Meta"). Butuh <strong>WABA ID</strong> terisi di Akun WhatsApp.
            </div>
          </div>
        </div>
      </Card>

      {tpls.loading ? (
        <Loading />
      ) : (tpls.data || []).length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))",
            gap: 14,
          }}
        >
          {(tpls.data || []).map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onEdit={() => setEditing(t)}
              onDelete={() => run(() => api.deleteTemplate(t.id))}
              onDuplicate={() => setEditing({ ...t, id: undefined, name: `${t.name}_copy`, status: "draft" })}
              onSubmit={() => submitToMeta(t)}
              submitting={busyId === t.id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon="template"
            title="Belum ada template"
            note="Klik 'Pakai Contoh' untuk mulai dari template siap-pakai."
          />
        </Card>
      )}

      {presetOpen ? (
        <PresetPicker
          onClose={() => setPresetOpen(false)}
          onPick={(d) => {
            setPresetOpen(false);
            setEditing({ ...d });
          }}
        />
      ) : null}
      {editing ? <TemplateEditor initial={editing} onClose={() => setEditing(null)} onSave={save} /> : null}
    </div>
  );
}
