import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Notice, Loading, Toggle, useLoader, theme, Icon } from "../lib/ui";

const MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (cepat & hemat)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (seimbang)" },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8 (paling pintar)" },
];

export default function AiAgent() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.getAiAgent(), []));
  const [f, setF] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setF({ enabled: data.enabled, model: data.model, systemPrompt: data.systemPrompt }); }, [data]);

  const save = async () => {
    setSaving(true); setErr(""); setNote("");
    try {
      const payload = { ...f };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      await api.updateAiAgent(payload);
      setApiKey("");
      setNote("Pengaturan Agen AI tersimpan.");
      await reload();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  if (loading || !f) return <div><PageHeader title="Agen AI" /><Loading /></div>;
  const set = (k, v) => setF({ ...f, [k]: v });

  return (
    <div>
      <PageHeader title="Agen AI" subtitle="Chatbot otomatis bertenaga Claude untuk membalas pesan masuk." actions={<Badge tone={data.enabled ? "green" : "default"}>{data.enabled ? "aktif" : "nonaktif"}</Badge>} />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card title="Konfigurasi">
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan Agen AI" />
          </div>
          <Select label="Model" value={f.model} onChange={(e) => set("model", e.target.value)} options={MODELS} />
          <Textarea label="System Prompt (kepribadian & instruksi AI)" value={f.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} style={{ minHeight: 130 }} />
          <Input label="Anthropic API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={data.hasApiKey ? "•••••• (tersimpan, isi untuk ganti)" : "sk-ant-..."} hint="Disimpan terenkripsi di server. Dapatkan di console.anthropic.com" />
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </Card>

        <Card title="Cara kerja">
          <div style={{ display: "grid", gap: 12, fontSize: 13, color: theme.text }}>
            {[
              "Pesan masuk yang sedang dalam alur survei tetap diproses survei (prioritas).",
              "Jika tidak, aturan Auto Reply dicek dulu.",
              "Bila tak ada aturan cocok & Agen AI aktif, Claude membalas otomatis.",
              "AI memakai 10 pesan terakhir sebagai konteks percakapan.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: theme.primary, display: "flex", marginTop: 1 }}><Icon name="check" size={15} /></span>
                <span style={{ color: theme.textMuted }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: data.hasApiKey ? theme.greenSoft : theme.yellowSoft, borderRadius: 9, fontSize: 12.5, color: data.hasApiKey ? theme.green : theme.yellow }}>
            {data.hasApiKey ? "✓ API key sudah terpasang — AI siap menjawab." : "⚠ Belum ada API key. AI tidak akan menjawab sampai key diisi."}
          </div>
        </Card>
      </div>
    </div>
  );
}
