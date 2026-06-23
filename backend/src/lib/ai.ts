// Panggilan ke Anthropic Messages API untuk Agen AI / chatbot.
// Model default: Claude Haiku 4.5 (hemat biaya). Lihat docs/ROADMAP Fase 4.

export type AiMessage = { role: "user" | "assistant"; content: string };

export async function generateAiReply(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: AiMessage[];
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 512,
      system: input.systemPrompt,
      messages: input.messages,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  }
  const text = (json?.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return text || "Maaf, saya belum bisa menjawab saat ini.";
}
