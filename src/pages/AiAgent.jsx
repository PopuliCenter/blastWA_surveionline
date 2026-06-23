import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Notice, Loading, Toggle, useLoader, theme, Icon } from "../lib/ui";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "gemini", label: "Google Gemini" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
];

const MODEL_HINT = {
  anthropic: "cth: claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-8",
  openai: "cth: gpt-4o-mini, gpt-4o",
  gemini: "cth: gemini-2.0-flash, gemini-2.5-pro",
  custom: "model sesuai penyedia (mis. llama-3.1-70b, dll)",
};
const KEY_HINT = {
  anthropic: "Dapatkan di console.anthropic.com",
  openai: "Dapatkan di platform.openai.com/api-keys",
  gemini: "Dapatkan di aistudio.google.com/apikey",
  custom: "API key dari penyedia OpenAI-compatible Anda",
};

export default function AiAgent() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.getAiAgent(), []));
  const [f, setF] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setF({ enabled: data.enabled, provider: data.provider || "anthropic", model: data.model, baseUrl: data.baseUrl || "", systemPrompt: data.systemPrompt }); }, [data]);

  const save = async () => {
    setSaving(true); setErr(""); setNote("");
    try {
      const payload = { enabled: f.enabled, provider: f.provider, model: f.model, baseUrl: f.baseUrl, systemPrompt: f.systemPrompt };
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
      <PageHeader title="Agen AI" subtitle="Chatbot otomatis untuk membalas pesan masuk — pilih provider AI mana pun." actions={<Badge tone={data.enabled ? "green" : "default"}>{data.enabled ? "aktif" : "nonaktif"}</Badge>} />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card title="Konfigurasi">
          <div style={{ marginBottom: 16 }}><Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan Agen AI" /></div>
          <Select label="Provider AI" value={f.provider} onChange={(e) => set("provider", e.target.value)} options={PROVIDERS} />
          <Input label="Model" value={f.model} onChange={(e) => set("model", e.target.value)} hint={MODEL_HINT[f.provider]} />
          {f.provider === "custom" ? <Input label="Base URL (OpenAI-compatible)" value={f.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://openrouter.ai/api/v1" /> : null}
          <Textarea label="System Prompt (kepribadian & instruksi)" value={f.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} style={{ minHeight: 120 }} />
          <Input label="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={data.hasApiKey ? "•••••• (tersimpan, isi untuk ganti)" : "API key provider"} hint={`Disimpan terenkripsi. ${KEY_HINT[f.provider]}`} />
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </Card>

        <Card title="Cara kerja">
          <div style={{ display: "grid", gap: 11, fontSize: 13 }}>
            {["Pesan yang sedang dalam alur survei tetap diproses survei (prioritas).", "Lalu aturan Auto Reply dicek.", "Bila tak ada yang cocok & AI aktif, AI menjawab.", "AI memakai 10 pesan terakhir sebagai konteks.", "Ganti provider kapan saja tanpa ubah kode."].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: theme.primary, display: "flex", marginTop: 1 }}><Icon name="check" size={15} /></span>
                <span style={{ color: theme.textMuted }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: data.hasApiKey ? theme.greenSoft : theme.yellowSoft, borderRadius: 9, fontSize: 12.5, color: data.hasApiKey ? theme.green : theme.yellow }}>
            {data.hasApiKey ? "✓ API key terpasang — AI siap menjawab." : "⚠ Belum ada API key. AI tidak menjawab sampai key diisi."}
          </div>
        </Card>
      </div>
    </div>
  );
}
