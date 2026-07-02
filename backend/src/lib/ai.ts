// Dispatcher Agen AI multi-provider: Anthropic, OpenAI, Google Gemini, Custom (OpenAI-compatible).

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiProviderConfig = {
  provider: string; // anthropic | openai | gemini | custom
  apiKey: string;
  model: string;
  baseUrl?: string; // untuk custom (OpenAI-compatible)
  systemPrompt: string;
  messages: AiMessage[];
};

export async function generateReply(cfg: AiProviderConfig): Promise<string> {
  switch (cfg.provider) {
    case "openai":
      return openaiCompatible(cfg, "https://api.openai.com/v1");
    case "custom":
      return openaiCompatible(cfg, (cfg.baseUrl || "").replace(/\/$/, ""));
    case "gemini":
      return gemini(cfg);
    case "anthropic":
    default:
      return anthropic(cfg);
  }
}

async function anthropic(cfg: AiProviderConfig): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 512, system: cfg.systemPrompt, messages: cfg.messages }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${errText(json)}`);
  return (
    (json?.content ?? [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim() || fallback()
  );
}

async function openaiCompatible(cfg: AiProviderConfig, base: string): Promise<string> {
  if (!base) throw new Error("Base URL kosong untuk provider custom");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 512,
      messages: [{ role: "system", content: cfg.systemPrompt }, ...cfg.messages],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${errText(json)}`);
  return (json?.choices?.[0]?.message?.content ?? "").trim() || fallback();
}

async function gemini(cfg: AiProviderConfig): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: cfg.systemPrompt }] },
      contents: cfg.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${errText(json)}`);
  return (
    (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text)
      .join("\n")
      .trim() || fallback()
  );
}

function errText(json: any): string {
  return JSON.stringify(json?.error ?? json).slice(0, 300);
}
function fallback(): string {
  return "Maaf, saya belum bisa menjawab saat ini.";
}
