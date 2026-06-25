import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Notice, Loading, Empty, useLoader, useIsMobile, theme, Icon, fmtDate } from "../lib/ui";

export default function Chat() {
  const isMobile = useIsMobile();
  const convos = useLoader(useCallback(() => api.conversations(), []));
  const [activeId, setActiveId] = useState(null);
  const list = convos.data || [];
  const active = list.find((c) => c.id === activeId) || null;

  const convoList = (
    <div style={{ borderRight: isMobile ? "none" : `1px solid ${theme.border}`, overflow: "auto" }}>
      {convos.loading ? <Loading /> : list.length ? list.map((c) => (
        <button key={c.id} onClick={() => setActiveId(c.id)} style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: `1px solid ${theme.border}`, background: activeId === c.id ? theme.primarySoft : "transparent", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.surfaceAlt, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{(c.name || c.phone).slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{c.name || c.phone}</div>
            <div style={{ color: theme.textMuted, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastDirection === "out" ? "↪ " : ""}{c.lastMessage}</div>
          </div>
        </button>
      )) : <Empty icon="chat" title="Belum ada percakapan" />}
    </div>
  );

  if (isMobile) {
    return (
      <div>
        <PageHeader title="Chat" subtitle="Percakapan masuk & keluar per kontak." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>Refresh</Button>]} />
        <Notice>{convos.error}</Notice>
        <div style={{ ...cardWrap }}>
          {active ? <Conversation contact={active} isMobile onBack={() => setActiveId(null)} /> : convoList}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Chat" subtitle="Percakapan masuk & keluar per kontak." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>Refresh</Button>]} />
      <Notice>{convos.error}</Notice>
      <div style={{ ...cardWrap, display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 540 }}>
        {convoList}
        <div>{active ? <Conversation contact={active} /> : <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 13.5 }}>Pilih percakapan di kiri</div>}</div>
      </div>
    </div>
  );
}

const cardWrap = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" };

function Conversation({ contact, isMobile, onBack }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.contactMessages(contact.id), [contact.id]));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const endRef = useRef(null);
  const msgs = data || [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true); setSendErr("");
    try { await api.sendMessage(contact.id, text.trim()); setText(""); await reload(); }
    catch (e) { setSendErr(e.message + " (pesan teks hanya bisa dalam 24 jam sejak balasan terakhir kontak)"); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: isMobile ? "calc(100vh - 210px)" : 540, minHeight: 360 }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${theme.border}`, fontWeight: 600, color: theme.text, display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile ? <button onClick={onBack} aria-label="Kembali" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.primary, display: "flex", padding: 0 }}><Icon name="back" size={20} /></button> : null}
        <span>{contact.name || contact.phone} <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: 12.5 }}>{contact.phone}</span></span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16, background: theme.surfaceAlt }}>
        {loading ? <Loading /> : error ? <Notice>{error}</Notice> : msgs.length ? msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.direction === "out" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 12, fontSize: 13.5, background: m.direction === "out" ? theme.green : theme.surface, color: m.direction === "out" ? "#fff" : theme.text, border: m.direction === "out" ? "none" : `1px solid ${theme.border}` }}>
              <div>{m.text}</div>
              <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: "right" }}>{fmtDate(m.createdAt)}</div>
            </div>
          </div>
        )) : <Empty icon="chat" title="Belum ada pesan" />}
        <div ref={endRef} />
      </div>
      {sendErr ? <div style={{ padding: "0 16px" }}><Notice>{sendErr}</Notice></div> : null}
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${theme.border}` }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !sending && send()} placeholder="Ketik balasan..." style={{ flex: 1, padding: "10px 12px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 13.5, outline: "none" }} />
        <Button icon="send" onClick={send} disabled={sending || !text.trim()}>{sending ? "..." : "Kirim"}</Button>
      </div>
    </div>
  );
}
