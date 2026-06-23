import { useCallback, useState } from "react";
import { api, apiBase } from "../lib/api";
import { PageHeader, Card, Button, Badge, Notice, Loading, Empty, useLoader, theme, fmtDate } from "../lib/ui";

export default function Webhook() {
  const logs = useLoader(useCallback(() => api.webhookLogs(100), []));
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState("");

  const endpoints = [
    { vendor: "Meta Cloud API", url: `${apiBase}/webhook/meta`, methods: "GET + POST" },
    { vendor: "Qontak", url: `${apiBase}/webhook/qontak`, methods: "POST" },
  ];

  const sendTest = async () => {
    setTesting(true); setNote("");
    try {
      const payload = { entry: [{ changes: [{ value: { messages: [{ from: "628123456789", id: `wamid.TEST_${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), text: { body: "Pesan uji dari dashboard" } }] } }] }] };
      const res = await fetch(`${apiBase}/webhook/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setNote(res.ok ? "Test inbound terkirim — lihat log di bawah." : `Gagal: HTTP ${res.status}`);
      await logs.reload();
    } catch (e) { setNote(e.message); } finally { setTesting(false); }
  };

  return (
    <div>
      <PageHeader title="Webhook" subtitle="Endpoint penerima pesan & status dari WhatsApp/Qontak." actions={[
        <Button key="t" variant="secondary" onClick={sendTest} disabled={testing}>{testing ? "Mengirim..." : "Kirim Test Inbound"}</Button>,
        <Button key="r" variant="ghost" icon="refresh" onClick={logs.reload}>Refresh</Button>,
      ]} />
      <Notice kind="info">{note}</Notice>

      <Card title="URL Webhook — daftarkan di Meta/Qontak" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {endpoints.map((ep) => (
            <div key={ep.vendor} style={{ padding: 13, background: theme.surfaceAlt, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13.5, color: theme.text }}>{ep.vendor}</strong>
                <Badge tone="blue">{ep.methods}</Badge>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12.5, marginTop: 7, color: theme.primary, wordBreak: "break-all" }}>{ep.url}</div>
            </div>
          ))}
        </div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>Saat dev pakai tunnel publik (cloudflared/ngrok). Verify token & secret diatur di server.</div>
      </Card>

      <Card title="Log Webhook">
        {logs.loading ? <Loading /> : (logs.data || []).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(logs.data || []).map((l) => (
              <details key={l.id} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12 }}>
                <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", listStyle: "none" }}>
                  <span style={{ fontSize: 13, color: theme.text }}>{l.vendor} • {l.event}</span>
                  <Badge tone={l.status === "success" ? "green" : l.status === "ignored" ? "blue" : "red"}>{l.status}</Badge>
                </summary>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>{fmtDate(l.createdAt)} • {l.note}</div>
                <pre style={{ marginTop: 8, padding: 11, borderRadius: 8, background: "#0f172a", color: "#cbd5e1", whiteSpace: "pre-wrap", fontSize: 11.5, overflow: "auto" }}>{JSON.stringify(l.payload, null, 2)}</pre>
              </details>
            ))}
          </div>
        ) : <Empty icon="webhook" title="Belum ada log" />}
      </Card>
    </div>
  );
}
