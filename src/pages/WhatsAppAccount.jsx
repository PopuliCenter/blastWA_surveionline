import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Notice, Loading, Toggle, useLoader, theme } from "../lib/ui";

export default function WhatsAppAccount() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listVendors(), []));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({ accessToken: "", phoneNumberId: "", appSecret: "", verifyToken: "", graphVersion: "v23.0" });
  const [qontak, setQontak] = useState({ accessToken: "", channelIntegrationId: "", webhookSecret: "", baseUrl: "https://service-chat.qontak.com/api/open/v1" });

  const vendors = data || [];
  const vmeta = vendors.find((v) => v.name === "meta");
  const vqontak = vendors.find((v) => v.name === "qontak");

  const saveCreds = async (vendor, creds) => {
    setErr(""); setNote("");
    try {
      const filtered = Object.fromEntries(Object.entries(creds).filter(([, v]) => String(v).trim() !== ""));
      await api.setVendorCredentials(vendor, filtered);
      setNote(`Kredensial ${vendor} tersimpan (terenkripsi).`);
      await reload();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (vendor, active) => { setErr(""); try { await api.setVendorActive(vendor, active); await reload(); } catch (e) { setErr(e.message); } };

  const Status = ({ v }) => v ? (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <Badge tone={v.configured ? "green" : "yellow"}>{v.configured ? "terkonfigurasi" : "belum lengkap"}</Badge>
      {v.isDefault ? <Badge tone="purple">default</Badge> : null}
      {v.hasStoredCredentials ? <Badge tone="blue">kredensial tersimpan</Badge> : null}
    </div>
  ) : null;

  if (loading) return <div><PageHeader title="Akun WhatsApp" /><Loading /></div>;

  return (
    <div>
      <PageHeader title="Akun WhatsApp" subtitle="Hubungkan vendor pengirim (Meta Cloud API / Qontak). Kredensial disimpan terenkripsi di server." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>]} />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Meta Cloud API" actions={<Status v={vmeta} />}>
          <Input label="Access Token (System User)" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} placeholder={vmeta?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : "EAAG..."} />
          <Input label="Phone Number ID" value={meta.phoneNumberId} onChange={(e) => setMeta({ ...meta, phoneNumberId: e.target.value })} />
          <Input label="App Secret" value={meta.appSecret} onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })} />
          <Input label="Webhook Verify Token" value={meta.verifyToken} onChange={(e) => setMeta({ ...meta, verifyToken: e.target.value })} />
          <Input label="Graph API Version" value={meta.graphVersion} onChange={(e) => setMeta({ ...meta, graphVersion: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("meta", meta)}>Simpan Meta</Button>
            {vmeta ? <Button variant="secondary" onClick={() => toggle("meta", !vmeta.active)}>{vmeta.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </Card>

        <Card title="Mekari Qontak" actions={<Status v={vqontak} />}>
          <Input label="Access Token" value={qontak.accessToken} onChange={(e) => setQontak({ ...qontak, accessToken: e.target.value })} placeholder={vqontak?.hasStoredCredentials ? "tersimpan — isi untuk ganti" : ""} />
          <Input label="Channel Integration ID" value={qontak.channelIntegrationId} onChange={(e) => setQontak({ ...qontak, channelIntegrationId: e.target.value })} />
          <Input label="Webhook Secret" value={qontak.webhookSecret} onChange={(e) => setQontak({ ...qontak, webhookSecret: e.target.value })} />
          <Input label="Base URL" value={qontak.baseUrl} onChange={(e) => setQontak({ ...qontak, baseUrl: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => saveCreds("qontak", qontak)}>Simpan Qontak</Button>
            {vqontak ? <Button variant="secondary" onClick={() => toggle("qontak", !vqontak.active)}>{vqontak.active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
