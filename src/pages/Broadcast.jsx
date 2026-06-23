import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, StatCard, Input, Textarea, Select, Modal, Notice, Loading, Empty, useLoader, theme, fmtDate } from "../lib/ui";

export default function Broadcast() {
  const blasts = useLoader(useCallback(() => api.listBlasts(), []));
  const segments = useLoader(useCallback(() => api.listSegments(), []));
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const [tab, setTab] = useState("blasts");
  const [showBlast, setShowBlast] = useState(false);
  const [showSeg, setShowSeg] = useState(false);
  const [err, setErr] = useState("");

  const run = async (fn, reloaders = []) => { setErr(""); try { await fn(); await Promise.all(reloaders.map((r) => r())); } catch (e) { setErr(e.message); } };

  const Tab = ({ id, children }) => (
    <button onClick={() => setTab(id)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab === id ? theme.primary : "transparent", color: tab === id ? "#fff" : theme.textMuted }}>{children}</button>
  );

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="Kirim pesan/survei ke segmen kontak." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={() => { blasts.reload(); segments.reload(); }}>Refresh</Button>,
        <Button key="s" variant="secondary" icon="plus" onClick={() => setShowSeg(true)}>Segmen</Button>,
        <Button key="b" icon="broadcast" onClick={() => setShowBlast(true)}>Buat Blast</Button>,
      ]} />
      <Notice>{err || blasts.error || segments.error}</Notice>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}><Tab id="blasts">Riwayat Blast</Tab><Tab id="segments">Segmen</Tab></div>

      {tab === "blasts" ? (
        blasts.loading ? <Loading /> : (blasts.data || []).length ? (
          <div style={{ display: "grid", gap: 14 }}>
            {(blasts.data || []).map((b) => (
              <Card key={b.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{b.surveyTitle}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{b.segmentName} • vendor {b.vendor} • template {b.message || "-"} • {fmtDate(b.sentAt)}</div>
                  </div>
                  <Badge tone={b.status === "completed" ? "green" : b.status === "failed" ? "red" : b.status === "scheduled" ? "yellow" : "blue"}>{b.status}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginTop: 14 }}>
                  <StatCard label="Sent" value={b.sent} tone="blue" />
                  <StatCard label="Delivered" value={b.delivered} tone="green" />
                  <StatCard label="Dibaca" value={b.opened} tone="purple" />
                  <StatCard label="Gagal" value={b.failed} tone="yellow" />
                </div>
                <div style={{ marginTop: 12 }}><Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteBlast(b.id), [blasts.reload])}>Hapus</Button></div>
              </Card>
            ))}
          </div>
        ) : <Card><Empty icon="broadcast" title="Belum ada blast" /></Card>
      ) : (
        segments.loading ? <Loading /> : (segments.data || []).length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {(segments.data || []).map((s) => (
              <Card key={s.id}>
                <div style={{ fontWeight: 700, color: theme.text }}>{s.name}</div>
                <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{s.contacts.length} kontak</div>
                <div style={{ marginTop: 10, background: theme.surfaceAlt, borderRadius: 9, padding: 10, fontSize: 12, color: theme.textMuted }}>{s.contacts.slice(0, 5).join(", ")}{s.contacts.length > 5 ? "…" : ""}</div>
                <div style={{ marginTop: 12 }}><Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteSegment(s.id), [segments.reload])}>Hapus</Button></div>
              </Card>
            ))}
          </div>
        ) : <Card><Empty icon="contacts" title="Belum ada segmen" /></Card>
      )}

      {showBlast ? <BlastModal surveys={surveys.data || []} segments={segments.data || []} onClose={() => setShowBlast(false)} onSave={(d) => run(() => api.createBlast(d), [blasts.reload]).then(() => setShowBlast(false))} /> : null}
      {showSeg ? <SegmentModal onClose={() => setShowSeg(false)} onSave={(d) => run(() => api.createSegment(d), [segments.reload]).then(() => setShowSeg(false))} /> : null}
    </div>
  );
}

function BlastModal({ surveys, segments, onClose, onSave }) {
  const [f, setF] = useState({ surveyId: "", segmentId: segments[0]?.id || "", vendor: "meta", templateName: "", templateLang: "en_US", bodyParams: "", messageText: "", schedule: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ surveyId: f.surveyId || undefined, segmentId: f.segmentId, vendor: f.vendor, templateName: f.templateName.trim(), templateLang: f.templateLang, messageText: f.messageText, bodyParams: f.bodyParams.trim() ? f.bodyParams.split(",").map((s) => s.trim()) : undefined, scheduledAt: f.schedule || undefined });
    } finally { setSaving(false); }
  };
  return (
    <Modal title="Buat Blast" onClose={onClose}>
      <Select label="Survei (opsional)" value={f.surveyId} onChange={(e) => set("surveyId", e.target.value)} options={[{ value: "", label: "— tanpa survei —" }, ...surveys.map((s) => ({ value: s.id, label: s.title }))]} />
      <Select label="Segmen" value={f.segmentId} onChange={(e) => set("segmentId", e.target.value)} options={segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length})` }))} />
      <Select label="Vendor" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} options={[{ value: "meta", label: "Meta Cloud API" }, { value: "qontak", label: "Qontak" }]} />
      <Input label="Nama / ID Template" value={f.templateName} onChange={(e) => set("templateName", e.target.value)} hint="cth: hello_world (Meta) atau Template ID (Qontak)" />
      <Input label="Bahasa Template" value={f.templateLang} onChange={(e) => set("templateLang", e.target.value)} hint="id / en_US" />
      <Input label="Parameter (pisah koma, opsional)" value={f.bodyParams} onChange={(e) => set("bodyParams", e.target.value)} hint="kosongkan untuk template tanpa variabel" />
      <Textarea label="Preview Pesan (audit)" value={f.messageText} onChange={(e) => set("messageText", e.target.value)} />
      <Input label="Jadwal (opsional)" type="datetime-local" value={f.schedule} onChange={(e) => set("schedule", e.target.value)} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button icon="send" onClick={submit} disabled={!f.segmentId || !f.templateName.trim() || saving}>{saving ? "Mengirim..." : "Kirim Blast"}</Button>
      </div>
    </Modal>
  );
}

function SegmentModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const contacts = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  const submit = async () => { setSaving(true); try { await onSave({ name, contacts }); } finally { setSaving(false); } };
  return (
    <Modal title="Tambah Segmen" onClose={onClose} width={460}>
      <Input label="Nama Segmen" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Daftar Nomor (satu per baris)" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"08123456789\n628987654321"} />
      <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 14 }}>Jumlah: {contacts.length} (dinormalisasi ke 62…)</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!name.trim() || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}
