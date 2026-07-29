import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  PasswordInput,
  Textarea,
  Select,
  Notice,
  Loading,
  Toggle,
  useLoader,
  useIsMobile,
  theme,
  Icon,
} from "../lib/ui";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "gemini", label: "Google Gemini" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
];

const MODEL_HINT = {
  anthropic: "cth: claude-haiku-4-5-20251001, claude-sonnet-5, claude-opus-4-8",
  openai: "cth: gpt-4o-mini, gpt-4o",
  gemini: "cth: gemini-2.0-flash, gemini-2.5-pro",
  custom: "model sesuai penyedia (mis. llama-3.1-70b, dll)",
};
// Contoh prompt yang MEMBATASI cakupan AI. Tanpa batas seperti ini, model akan
// dengan senang hati menjawab apa pun — memanjangkan percakapan, menghabiskan token,
// dan berisiko berbicara atas nama lembaga di luar wewenangnya.
const PROMPT_SURVEI = `Anda asisten WhatsApp resmi Populi Center, lembaga riset dan survei opini publik.

TUGAS ANDA HANYA:
- Menjelaskan bahwa kami sedang mengadakan survei online singkat (±5 menit).
- Memberi tahu cara ikut: balas dengan kata "isi survei".
- Menjawab pertanyaan seputar survei: siapa kami, berapa lama, bagaimana data dipakai.
- Menegaskan kami tidak pernah meminta OTP, PIN, atau nomor rekening.

ATURAN:
- Jawab maksimal 3 kalimat. Bahasa Indonesia, sopan, langsung ke inti.
- Di luar topik di atas (politik praktis, curhat, permintaan bantuan lain, opini pribadi),
  jawab singkat: "Maaf, saya hanya bisa membantu seputar survei ini." lalu tawarkan
  untuk mulai mengisi survei.
- Jangan mengarang data, hasil survei, angka, hadiah, atau janji apa pun.
- Jangan menyebut Anda AI kecuali ditanya langsung.
- Bila responden tampak keberatan atau marah, minta maaf singkat dan beri tahu bahwa
  ia bisa membalas "STOP" untuk berhenti menerima pesan.`;

const KEY_HINT = {
  anthropic: "Dapatkan di console.anthropic.com",
  openai: "Dapatkan di platform.openai.com/api-keys",
  gemini: "Dapatkan di aistudio.google.com/apikey",
  custom: "API key dari penyedia OpenAI-compatible Anda",
};

export default function AiAgent() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.getAiAgent(), []));
  const [f, setF] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErr("");
    try {
      setTestResult(await api.testAiAgent("Halo, ini tes koneksi."));
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (data)
      setF({
        enabled: data.enabled,
        provider: data.provider || "anthropic",
        model: data.model,
        baseUrl: data.baseUrl || "",
        systemPrompt: data.systemPrompt,
        maxTokens: data.maxTokens ?? 300,
        historyLimit: data.historyLimit ?? 6,
        maxRepliesPerDay: data.maxRepliesPerDay ?? 5,
      });
  }, [data]);

  const save = async () => {
    setSaving(true);
    setErr("");
    setNote("");
    try {
      const payload = {
        enabled: f.enabled,
        provider: f.provider,
        model: f.model,
        baseUrl: f.baseUrl,
        systemPrompt: f.systemPrompt,
        maxTokens: f.maxTokens,
        historyLimit: f.historyLimit,
        maxRepliesPerDay: f.maxRepliesPerDay,
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      await api.updateAiAgent(payload);
      setApiKey("");
      setNote("Pengaturan Agen AI tersimpan.");
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !f)
    return (
      <div>
        <PageHeader title="Agen AI" />
        <Loading />
      </div>
    );
  const set = (k, v) => setF({ ...f, [k]: v });

  return (
    <div>
      <PageHeader
        title="Agen AI"
        subtitle="Chatbot otomatis untuk membalas pesan masuk — pilih provider AI mana pun."
        actions={<Badge tone={data.enabled ? "green" : "default"}>{data.enabled ? "aktif" : "nonaktif"}</Badge>}
      />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 16 }}>
        <Card title="Konfigurasi">
          <div style={{ marginBottom: 16 }}>
            <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan Agen AI" />
          </div>
          <Select
            label="Provider AI"
            value={f.provider}
            onChange={(e) => set("provider", e.target.value)}
            options={PROVIDERS}
          />
          <Input
            label="Model"
            value={f.model}
            onChange={(e) => set("model", e.target.value)}
            hint={MODEL_HINT[f.provider]}
          />
          {f.provider === "custom" ? (
            <Input
              label="Base URL (OpenAI-compatible)"
              value={f.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          ) : null}
          <Textarea
            label="System Prompt (kepribadian & instruksi)"
            value={f.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            style={{ minHeight: 120 }}
            hint="Batas paling ampuh ada di sini: sebutkan topik yang boleh dijawab dan suruh AI menolak halus sisanya."
          />
          <div style={{ marginTop: -6, marginBottom: 14 }}>
            <Button size="sm" variant="secondary" icon="sparkle" onClick={() => set("systemPrompt", PROMPT_SURVEI)}>
              Pakai contoh prompt survei
            </Button>
          </div>

          {/* Pembatas biaya & waktu */}
          <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: theme.text, marginBottom: 4 }}>Batas pemakaian</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
              Menjaga tagihan token tetap terkendali dan balasan tetap ringkas. Batas ini berlaku untuk Agen AI saja —
              survei dan Auto Reply tidak terpengaruh.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Input
                label="Panjang balasan (token)"
                type="number"
                min={50}
                max={2000}
                value={f.maxTokens}
                onChange={(e) => set("maxTokens", e.target.value)}
                hint="300 ≈ 3–4 kalimat. Balasan WhatsApp memang sebaiknya pendek."
              />
              <Input
                label="Pesan konteks"
                type="number"
                min={0}
                max={30}
                value={f.historyLimit}
                onChange={(e) => set("historyLimit", e.target.value)}
                hint="Jumlah pesan terakhir yang ikut dikirim. Makin banyak, makin mahal."
              />
            </div>
            <Input
              label="Kuota balasan AI per nomor (24 jam)"
              type="number"
              min={0}
              max={100}
              value={f.maxRepliesPerDay}
              onChange={(e) => set("maxRepliesPerDay", e.target.value)}
              hint="Setelah kuota habis, AI mengirim satu pesan alih ke tim lalu berhenti menjawab nomor itu sampai 24 jam berikutnya. Isi 0 untuk tanpa batas."
            />
          </div>
          <PasswordInput
            noAutofill
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={data.hasApiKey ? "•••••• (tersimpan, isi untuk ganti)" : "API key provider"}
            hint={`Disimpan terenkripsi. ${KEY_HINT[f.provider]}`}
          />
          {/* Hasil tes ditampilkan apa adanya — termasuk pesan galat dari provider,
              karena itulah satu-satunya petunjuk saat AI "tidak menjawab". */}
          {testResult ? (
            <Notice kind={testResult.ok ? "success" : "error"}>
              {testResult.ok ? (
                <>
                  <strong>Berhasil</strong> ({testResult.ms} ms, model {testResult.model}):
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{testResult.reply}</div>
                </>
              ) : (
                <>
                  <strong>Gagal</strong>
                  {testResult.model ? ` (model "${testResult.model}")` : ""}:
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{testResult.error}</div>
                </>
              )}
            </Notice>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={save} disabled={saving || testing}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
            <Button variant="secondary" icon="chat" onClick={runTest} disabled={saving || testing}>
              {testing ? "Menguji…" : "Tes Agen AI"}
            </Button>
          </div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
            Tes memakai pengaturan yang <strong>sudah tersimpan</strong> — simpan dulu bila baru diubah.
          </div>
        </Card>

        <Card title="Cara kerja">
          <div style={{ display: "grid", gap: 11, fontSize: 13 }}>
            {[
              "Pesan yang sedang dalam alur survei tetap diproses survei (prioritas).",
              "Pertanyaan tentang survei (mis. “cara isi survei”) tidak memulai survei.",
              "Lalu aturan Auto Reply dicek.",
              "Bila tak ada yang cocok & AI aktif, AI menjawab.",
              `AI memakai ${f.historyLimit} pesan terakhir sebagai konteks.`,
              `Maks ${f.maxRepliesPerDay || "∞"} balasan AI per nomor tiap 24 jam.`,
              "Ganti provider kapan saja tanpa ubah kode.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: theme.primary, display: "flex", marginTop: 1 }}>
                  <Icon name="check" size={15} />
                </span>
                <span style={{ color: theme.textMuted }}>{t}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: data.hasApiKey ? theme.greenSoft : theme.yellowSoft,
              borderRadius: 9,
              fontSize: 12.5,
              color: data.hasApiKey ? theme.green : theme.yellow,
            }}
          >
            {data.hasApiKey
              ? "✓ API key terpasang — AI siap menjawab."
              : "⚠ Belum ada API key. AI tidak menjawab sampai key diisi."}
          </div>
        </Card>
      </div>
    </div>
  );
}
