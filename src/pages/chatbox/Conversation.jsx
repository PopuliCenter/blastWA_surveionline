import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Button, Notice, Loading, Empty, theme, Icon, useLoader } from "../../lib/ui";
import { sessionInfo, shortTime } from "./constants";

// ── Percakapan (tengah) ─────────────────────────────────────────────────────
export function Conversation({ convo, onBack, onReload, onResolve, onShowDetails, isMobile }) {
  const { data, loading, error, reload, setData } = useLoader(
    useCallback(() => api.contactMessages(convo.id), [convo.id]),
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const scrollRef = useRef(null);
  const msgs = data || [];
  const sess = sessionInfo(convo);

  // Gulung HANYA kotak pesan ke bawah (bukan seluruh halaman) saat jumlah pesan berubah /
  // saat membuka percakapan. Memakai scrollTop container, bukan scrollIntoView (yang menggulung
  // seluruh dokumen sehingga header ikut terdorong).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, convo.id]);

  // Auto-update senyap: segarkan pesan thread ini tiap 4 detik (balasan masuk muncul otomatis).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return; // jeda saat tab tak terlihat
      api
        .contactMessages(convo.id)
        .then((d) => setData(d))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [convo.id, setData]);

  // Typing indicator (khusus jalur Baileys — Meta tak mengirim status mengetik).
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (convo.vendor !== "baileys") {
      setTyping(false);
      return;
    }
    let alive = true;
    const tick = () => {
      if (document.hidden) return; // jeda saat tab tak terlihat
      api
        .baileysTyping(convo.phone)
        .then((r) => {
          if (alive) setTyping(!!r.typing);
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [convo.vendor, convo.phone]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setSendErr("");
    try {
      await api.sendMessage(convo.id, text.trim());
      setText("");
      await reload();
      await onReload?.();
    } catch (e) {
      setSendErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: "11px 14px",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {isMobile ? (
          <button
            onClick={onBack}
            aria-label="Kembali"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: theme.primary,
              display: "flex",
              padding: 0,
            }}
          >
            <Icon name="back" size={20} />
          </button>
        ) : null}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: theme.surfaceAlt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: theme.text,
            flexShrink: 0,
          }}
        >
          {(convo.name || convo.phone).slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: theme.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {convo.name || convo.phone}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: typing ? theme.green : sess.tone === "green" ? theme.green : theme.textMuted,
            }}
          >
            {convo.phone} • {typing ? "sedang menulis…" : sess.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <Button
            variant={convo.resolved ? "secondary" : "success"}
            size="sm"
            icon={convo.resolved ? "refresh" : "check"}
            onClick={() => onResolve(convo.id, !convo.resolved)}
          >
            {convo.resolved ? "Buka" : "Selesai"}
          </Button>
          {onShowDetails ? <Button variant="secondary" size="sm" icon="contacts" onClick={onShowDetails} /> : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16, background: theme.surfaceAlt }}
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <Notice>{error}</Notice>
        ) : msgs.length ? (
          msgs.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: m.direction === "out" ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 12px",
                  borderRadius: m.direction === "out" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  fontSize: 13.5,
                  background: m.direction === "out" ? (m.isBot ? "#e2f0ff" : "#dcf8c6") : theme.surface,
                  color: theme.text,
                  border: m.direction === "out" ? "none" : `1px solid ${theme.border}`,
                  boxShadow: "0 1px 1px rgba(0,0,0,.06)",
                }}
              >
                {m.direction === "out" ? (
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: m.isBot ? theme.primary : theme.green,
                      marginBottom: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon name={m.isBot ? "ai" : "contacts"} size={12} />
                    {m.isBot ? "Bot" : "Anda"}
                  </div>
                ) : null}
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3, textAlign: "right" }}>
                  {shortTime(m.createdAt)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <Empty icon="chat" title="Belum ada pesan" />
        )}
      </div>

      {/* Composer */}
      {sendErr ? (
        <div style={{ padding: "8px 14px 0" }}>
          <Notice>{sendErr}</Notice>
        </div>
      ) : null}
      {sess.active ? (
        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${theme.border}` }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sending && send()}
            placeholder="Ketik balasan..."
            style={{
              flex: 1,
              padding: "10px 12px",
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              fontSize: 13.5,
              outline: "none",
            }}
          />
          <Button icon="send" onClick={send} disabled={sending || !text.trim()}>
            {sending ? "..." : "Kirim"}
          </Button>
        </div>
      ) : (
        <div
          style={{
            padding: "12px 14px",
            borderTop: `1px solid ${theme.border}`,
            background: theme.yellowSoft,
            color: theme.yellow,
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="autoreply" size={16} />
          <span>
            {convo.sessionExpiresAt
              ? "Sesi 24 jam berakhir. Balasan teks bebas tidak bisa dikirim — gunakan template (lewat Broadcast) untuk follow up."
              : "Kontak belum pernah membalas. Mulai dengan template lewat Broadcast agar sesi terbuka."}
          </span>
        </div>
      )}
    </div>
  );
}
