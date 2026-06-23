import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Modal, Notice, Loading, Empty, Toggle, useLoader, theme } from "../lib/ui";

const MATCH_LABEL = { contains: "mengandung", exact: "sama persis", starts: "diawali" };

export default function AutoReply() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listAutoReplies(), []));
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const rules = data || [];
  const run = async (fn) => { setErr(""); try { await fn(); await reload(); } catch (e) { setErr(e.message); } };

  return (
    <div>
      <PageHeader title="Auto Reply" subtitle="Balas otomatis pesan masuk berdasarkan kata kunci." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
        <Button key="n" icon="plus" onClick={() => setModal({})}>Tambah Aturan</Button>,
      ]} />
      <Notice>{error || err}</Notice>
      <Notice kind="info">Aturan dicek saat pesan masuk yang TIDAK sedang dalam alur survei. Prioritas lebih tinggi dicek dulu. Jika tak ada yang cocok dan Agen AI aktif, AI yang menjawab.</Notice>
      {loading ? <Loading /> : rules.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rules.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: theme.text }}>{r.name}</strong>
                    <Badge tone={r.enabled ? "green" : "default"}>{r.enabled ? "aktif" : "nonaktif"}</Badge>
                    <Badge tone="blue">prioritas {r.priority}</Badge>
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>Jika pesan <b>{MATCH_LABEL[r.matchType]}</b> "<span style={{ color: theme.text }}>{r.keyword}</span>"</div>
                  <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "9px 12px", marginTop: 8, fontSize: 13, color: theme.text }}>↪ {r.response}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(r)}>Edit</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteAutoReply(r.id))} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon="autoreply" title="Belum ada aturan" note="Tambah aturan balas otomatis pertama Anda." /></Card>}
      {modal !== null ? <RuleModal rule={modal.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => run(async () => { if (modal.id) await api.updateAutoReply(modal.id, d); else await api.createAutoReply(d); setModal(null); })} /> : null}
    </div>
  );
}

function RuleModal({ rule, onClose, onSave }) {
  const [f, setF] = useState({ name: rule?.name || "", keyword: rule?.keyword || "", matchType: rule?.matchType || "contains", response: rule?.response || "", priority: rule?.priority ?? 0, enabled: rule?.enabled ?? true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const submit = async () => { setSaving(true); try { await onSave({ ...f, priority: Number(f.priority) || 0 }); } finally { setSaving(false); } };
  return (
    <Modal title={rule ? "Edit Aturan" : "Tambah Aturan"} onClose={onClose} width={520}>
      <Input label="Nama aturan" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Tipe cocok" value={f.matchType} onChange={(e) => set("matchType", e.target.value)} options={[{ value: "contains", label: "Mengandung" }, { value: "exact", label: "Sama persis" }, { value: "starts", label: "Diawali" }]} />
        <Input label="Kata kunci" value={f.keyword} onChange={(e) => set("keyword", e.target.value)} placeholder="cth: harga" />
      </div>
      <Textarea label="Balasan" value={f.response} onChange={(e) => set("response", e.target.value)} placeholder="Pesan balasan otomatis" />
      <Input label="Prioritas (angka lebih besar = dicek lebih dulu)" type="number" value={f.priority} onChange={(e) => set("priority", e.target.value)} />
      <div style={{ marginBottom: 16 }}><Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan aturan" /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!f.name.trim() || !f.keyword.trim() || !f.response.trim() || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}
