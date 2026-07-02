import { useCallback, useState } from "react";
import { api, apiBase } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Notice,
  Loading,
  Empty,
  useLoader,
  theme,
  fmtDate,
  Icon,
} from "../lib/ui";

export default function Webhook() {
  const logs = useLoader(useCallback(() => api.webhookLogs(100), []));
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState("");
  const [publicBase, setPublicBase] = useState(() => localStorage.getItem("populi.publicBase") || "");
  const [copied, setCopied] = useState("");

  const base = (publicBase.trim() || apiBase).replace(/\/+$/, "");
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(base);
  const savePublic = () => {
    localStorage.setItem("populi.publicBase", publicBase.trim());
    setNote("URL publik disimpan.");
  };
  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* ignore */
    }
  };

  const endpoints = [
    { vendor: "Meta Cloud API", url: `${base}/webhook/meta`, methods: "GET + POST" },
    { vendor: "Qontak", url: `${base}/webhook/qontak`, methods: "POST" },
  ];

  const sendTest = async () => {
    setTesting(true);
    setNote("");
    try {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "628123456789",
                      id: `wamid.TEST_${Date.now()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      text: { body: "Pesan uji dari dashboard" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const res = await fetch(`${apiBase}/webhook/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNote(res.ok ? "Test inbound terkirim — lihat log di bawah." : `Gagal: HTTP ${res.status}`);
      await logs.reload();
    } catch (e) {
      setNote(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Webhook"
        subtitle="Endpoint penerima pesan & status dari WhatsApp/Qontak."
        actions={[
          <Button key="t" variant="secondary" onClick={sendTest} disabled={testing}>
            {testing ? "Mengirim..." : "Kirim Test Inbound"}
          </Button>,
          <Button key="r" variant="ghost" icon="refresh" onClick={logs.reload}>
            Refresh
          </Button>,
        ]}
      />
      <Notice kind="info">{note}</Notice>

      <Card title="URL Webhook — daftarkan di Meta/Qontak" style={{ marginBottom: 16 }}>
        {isLocal ? (
          <div
            style={{
              background: theme.yellowSoft,
              color: theme.yellow,
              borderRadius: 9,
              padding: "11px 13px",
              fontSize: 12.5,
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            <strong>⚠ localhost tidak bisa dipakai untuk Meta/Qontak.</strong> URL{" "}
            <span style={{ fontFamily: "monospace" }}>localhost</span> hanya bisa diakses dari komputer ini — server
            Meta di internet tidak bisa menjangkaunya. Pakai <strong>URL publik</strong>:
            <div style={{ marginTop: 6 }}>
              • <strong>Saat uji lokal:</strong> jalankan tunnel (mis.{" "}
              <span style={{ fontFamily: "monospace" }}>ngrok http 3000</span> atau{" "}
              <span style={{ fontFamily: "monospace" }}>cloudflared</span>), salin URL https-nya.
            </div>
            <div>
              • <strong>Saat produksi:</strong> pakai domain server/hosting Anda (https).
            </div>
            <div style={{ marginTop: 6 }}>
              Lalu tempel di kolom di bawah agar URL webhook lengkapnya otomatis terbentuk.
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              label="Base URL publik server (opsional)"
              value={publicBase}
              onChange={(e) => setPublicBase(e.target.value)}
              placeholder="https://xxxx.ngrok-free.app  atau  https://api.domainanda.com"
              hint="Tanpa garis miring di akhir. Kosongkan untuk pakai alamat aplikasi saat ini."
              style={{ marginBottom: 0 }}
            />
          </div>
          <Button variant="secondary" onClick={savePublic}>
            Simpan
          </Button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {endpoints.map((ep) => (
            <div key={ep.vendor} style={{ padding: 13, background: theme.surfaceAlt, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13.5, color: theme.text }}>{ep.vendor}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge tone="blue">{ep.methods}</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied === ep.url ? "check" : "download"}
                    onClick={() => copy(ep.url)}
                  >
                    {copied === ep.url ? "Disalin" : "Salin"}
                  </Button>
                </div>
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12.5,
                  marginTop: 7,
                  color: isLocal ? theme.textMuted : theme.primary,
                  wordBreak: "break-all",
                }}
              >
                {ep.url}
              </div>
            </div>
          ))}
        </div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>
          Verify Token (Meta) & Secret diatur di halaman <strong>Akun WhatsApp</strong>; samakan dengan yang Anda isi di
          Meta/Qontak.
        </div>
      </Card>

      <Card title="Log Webhook">
        {logs.loading ? (
          <Loading />
        ) : (logs.data || []).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(logs.data || []).map((l) => (
              <details key={l.id} style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    listStyle: "none",
                  }}
                >
                  <span style={{ fontSize: 13, color: theme.text }}>
                    {l.vendor} • {l.event}
                  </span>
                  <Badge tone={l.status === "success" ? "green" : l.status === "ignored" ? "blue" : "red"}>
                    {l.status}
                  </Badge>
                </summary>
                <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  {fmtDate(l.createdAt)} • {l.note}
                </div>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#cbd5e1",
                    whiteSpace: "pre-wrap",
                    fontSize: 11.5,
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(l.payload, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        ) : (
          <Empty icon="webhook" title="Belum ada log" />
        )}
      </Card>
    </div>
  );
}
