import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Notice, Loading, Empty, useLoader, useSelection, Checkbox, BulkBar, useIsMobile, useMediaQuery, theme, Icon, fmtDate } from "../lib/ui";

// ── Helper sesi & waktu ────────────────────────────────────────────────────
function sessionInfo(convo) {
  if (!convo?.sessionExpiresAt) return { active: false, label: "Sesi belum dibuka", detail: "Kontak belum membalas", tone: "default" };
  const exp = new Date(convo.sessionExpiresAt).getTime();
  const now = Date.now();
  if (now < exp) {
    const ms = exp - now;
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return { active: true, label: "Sesi aktif", detail: `Berakhir dalam ${hrs}j ${mins}m`, tone: "green" };
  }
  return { active: false, label: "Sesi kedaluwarsa", detail: "Lewat 24 jam — balas via template", tone: "yellow" };
}

function shortTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibalas" },
  { key: "active", label: "Sesi aktif" },
  { key: "resolved", label: "Selesai" },
];

function matchesFilter(c, key) {
  const sess = sessionInfo(c);
  if (key === "unread") return c.unread > 0 && !c.resolved;
  if (key === "active") return sess.active && !c.resolved;
  if (key === "resolved") return c.resolved;
  return true;
}

export default function Chat() {
  const isMobile = useIsMobile();
  const detailsInline = useMediaQuery("(min-width: 1100px)");
  const convos = useLoader(useCallback(() => api.conversations(), []));
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const sel = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);

  const all = convos.data || [];
  const active = all.find((c) => c.id === activeId) || null;

  // Auto-update senyap: segarkan daftar percakapan tiap 5 detik (pesan masuk & badge
  // ter-update otomatis tanpa klik Refresh). Pakai setData agar tidak memunculkan spinner.
  useEffect(() => {
    const id = setInterval(() => {
      api.conversations().then((d) => convos.setData(d)).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [convos.setData]);

  const bulkDeleteConvos = async () => {
    if (!sel.size || !window.confirm(`Hapus ${sel.size} percakapan terpilih? Riwayat pesannya akan dihapus (kontak tetap ada).`)) return;
    setBulkBusy(true); setActionErr("");
    try {
      const ids = sel.list();
      await api.bulkDeleteConversations(ids);
      if (ids.includes(activeId)) setActiveId(null);
      sel.clear(); await convos.reload();
    } catch (e) { setActionErr(e.message); } finally { setBulkBusy(false); }
  };

  const counts = useMemo(() => {
    const o = {};
    for (const f of FILTERS) o[f.key] = all.filter((c) => matchesFilter(c, f.key)).length;
    return o;
  }, [all]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = all.filter((c) => matchesFilter(c, filter));
    if (q) arr = arr.filter((c) => `${c.phone} ${c.name || ""} ${c.lastMessage || ""}`.toLowerCase().includes(q));
    arr = [...arr].sort((a, b) => {
      const da = new Date(a.lastAt).getTime(), db = new Date(b.lastAt).getTime();
      return sortNewest ? db - da : da - db;
    });
    return arr;
  }, [all, filter, search, sortNewest]);

  const resolve = async (id, resolved) => {
    setActionErr("");
    try { await api.resolveConversation(id, resolved); await convos.reload(); }
    catch (e) { setActionErr(e.message); }
  };

  // ── Sub-render: daftar percakapan ──
  const listPanel = (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", borderRight: isMobile ? "none" : `1px solid ${theme.border}` }}>
      {/* Search + sort */}
      <div style={{ padding: 12, borderBottom: `1px solid ${theme.border}`, display: "grid", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: 9, color: theme.textMuted }}><Icon name="search" size={15} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, nomor, pesan..." style={{ width: "100%", padding: "8px 10px 8px 32px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "5px 10px", borderRadius: 999, border: `1px solid ${filter === f.key ? theme.primary : theme.border}`, background: filter === f.key ? theme.primarySoft : theme.surface, color: filter === f.key ? theme.primary : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {f.label}{counts[f.key] ? ` (${counts[f.key]})` : ""}
            </button>
          ))}
          <button onClick={() => setSortNewest((s) => !s)} title="Urutkan" style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {sortNewest ? "Terbaru" : "Terlama"}
          </button>
        </div>
      </div>

      {sel.size ? <div style={{ padding: "8px 12px 0" }}><BulkBar count={sel.size} total={list.length} allSelected={list.length > 0 && list.every((c) => sel.has(c.id))} noun="percakapan" busy={bulkBusy}
        onToggleAll={() => list.every((c) => sel.has(c.id)) ? sel.clear() : sel.setAll(list.map((c) => c.id))}
        onClear={sel.clear} onDelete={bulkDeleteConvos} /></div> : null}

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {convos.loading ? <Loading /> : list.length ? list.map((c) => {
          const sess = sessionInfo(c);
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 13px", borderBottom: `1px solid ${theme.border}`, background: sel.has(c.id) ? theme.primarySoft : activeId === c.id ? theme.primarySoft : "transparent" }}>
            <Checkbox checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
            <button onClick={() => { setActiveId(c.id); setShowDetails(false); }} style={{ display: "flex", gap: 10, flex: 1, minWidth: 0, textAlign: "left", padding: "11px 0", border: "none", background: "transparent", cursor: "pointer" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: theme.surfaceAlt, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>{(c.name || c.phone).slice(0, 1).toUpperCase()}</div>
                {sess.active ? <span style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%", background: theme.green, border: `2px solid ${theme.surface}` }} /> : null}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || c.phone}</span>
                  <span style={{ color: theme.textMuted, fontSize: 11, flexShrink: 0 }}>{shortTime(c.lastAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", marginTop: 3 }}>
                  <span style={{ color: theme.textMuted, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastDirection === "out" ? "↪ " : ""}{c.lastMessage || "—"}</span>
                  <span style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                    {c.resolved ? <Badge tone="green">selesai</Badge> : c.unread > 0 ? <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: theme.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.unread}</span> : null}
                  </span>
                </div>
              </div>
            </button>
            </div>
          );
        }) : <Empty icon="chat" title="Tidak ada percakapan" note={filter !== "all" ? "Coba filter lain." : undefined} />}
      </div>
    </div>
  );

  const detailsPanel = active ? <DetailsPanel convo={active} onResolve={resolve} /> : null;

  // ── Mobile: master-detail ──
  if (isMobile) {
    return (
      <div>
        <PageHeader title="Chat" subtitle="Inbox percakapan WhatsApp." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>Refresh</Button>]} />
        <Notice>{convos.error || actionErr}</Notice>
        <div style={{ ...cardWrap, height: "calc(100vh - 180px)", minHeight: 420, display: "flex", flexDirection: "column" }}>
          {active
            ? <Conversation convo={active} onBack={() => setActiveId(null)} onReload={convos.reload} onResolve={resolve} onShowDetails={() => setShowDetails(true)} isMobile />
            : listPanel}
        </div>
        {showDetails && active ? <Modal title="Detail Kontak" onClose={() => setShowDetails(false)} width={420}><DetailsPanel convo={active} onResolve={resolve} bare /></Modal> : null}
      </div>
    );
  }

  // ── Desktop / tablet ──
  const cols = detailsInline ? "300px 1fr 320px" : "300px 1fr";
  return (
    <div>
      <PageHeader title="Chat" subtitle="Inbox percakapan WhatsApp." actions={[<Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>Refresh</Button>]} />
      <Notice>{convos.error || actionErr}</Notice>
      <div style={{ ...cardWrap, display: "grid", gridTemplateColumns: cols, height: "calc(100vh - 170px)", minHeight: 480 }}>
        {listPanel}
        <div style={{ minWidth: 0, minHeight: 0, height: "100%", overflow: "hidden", borderRight: detailsInline ? `1px solid ${theme.border}` : "none" }}>
          {active
            ? <Conversation convo={active} onReload={convos.reload} onResolve={resolve} onShowDetails={detailsInline ? null : () => setShowDetails(true)} />
            : <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 13.5 }}>Pilih percakapan untuk mulai membalas</div>}
        </div>
        {detailsInline ? <div style={{ minHeight: 0, height: "100%", overflowY: "auto" }}>{detailsPanel || <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: theme.textMuted, fontSize: 12.5, padding: 16, textAlign: "center" }}>Detail kontak muncul di sini</div>}</div> : null}
      </div>
      {!detailsInline && showDetails && active ? <Modal title="Detail Kontak" onClose={() => setShowDetails(false)} width={420}><DetailsPanel convo={active} onResolve={resolve} bare /></Modal> : null}
    </div>
  );
}

const cardWrap = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" };

// ── Percakapan (tengah) ─────────────────────────────────────────────────────
function Conversation({ convo, onBack, onReload, onResolve, onShowDetails, isMobile }) {
  const { data, loading, error, reload, setData } = useLoader(useCallback(() => api.contactMessages(convo.id), [convo.id]));
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
      api.contactMessages(convo.id).then((d) => setData(d)).catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [convo.id, setData]);

  // Typing indicator (khusus jalur Baileys — Meta tak mengirim status mengetik).
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (convo.vendor !== "baileys") { setTyping(false); return; }
    let alive = true;
    const tick = () => api.baileysTyping(convo.phone).then((r) => { if (alive) setTyping(!!r.typing); }).catch(() => {});
    tick();
    const id = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [convo.vendor, convo.phone]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true); setSendErr("");
    try { await api.sendMessage(convo.id, text.trim()); setText(""); await reload(); await onReload?.(); }
    catch (e) { setSendErr(e.message); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile ? <button onClick={onBack} aria-label="Kembali" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.primary, display: "flex", padding: 0 }}><Icon name="back" size={20} /></button> : null}
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: theme.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: theme.text, flexShrink: 0 }}>{(convo.name || convo.phone).slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{convo.name || convo.phone}</div>
          <div style={{ fontSize: 11.5, color: typing ? theme.green : sess.tone === "green" ? theme.green : theme.textMuted }}>{convo.phone} • {typing ? "sedang menulis…" : sess.label}</div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <Button variant={convo.resolved ? "secondary" : "success"} size="sm" icon={convo.resolved ? "refresh" : "check"} onClick={() => onResolve(convo.id, !convo.resolved)}>{convo.resolved ? "Buka" : "Selesai"}</Button>
          {onShowDetails ? <Button variant="secondary" size="sm" icon="contacts" onClick={onShowDetails} /> : null}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16, background: theme.surfaceAlt }}>
        {loading ? <Loading /> : error ? <Notice>{error}</Notice> : msgs.length ? msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.direction === "out" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: m.direction === "out" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", fontSize: 13.5, background: m.direction === "out" ? (m.isBot ? "#e2f0ff" : "#dcf8c6") : theme.surface, color: theme.text, border: m.direction === "out" ? "none" : `1px solid ${theme.border}`, boxShadow: "0 1px 1px rgba(0,0,0,.06)" }}>
              {m.direction === "out" ? (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: m.isBot ? theme.primary : theme.green, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name={m.isBot ? "ai" : "contacts"} size={12} />{m.isBot ? "Bot" : "Anda"}
                </div>
              ) : null}
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
              <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3, textAlign: "right" }}>{shortTime(m.createdAt)}</div>
            </div>
          </div>
        )) : <Empty icon="chat" title="Belum ada pesan" />}
      </div>

      {/* Composer */}
      {sendErr ? <div style={{ padding: "8px 14px 0" }}><Notice>{sendErr}</Notice></div> : null}
      {sess.active ? (
        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${theme.border}` }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !sending && send()} placeholder="Ketik balasan..." style={{ flex: 1, padding: "10px 12px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 13.5, outline: "none" }} />
          <Button icon="send" onClick={send} disabled={sending || !text.trim()}>{sending ? "..." : "Kirim"}</Button>
        </div>
      ) : (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${theme.border}`, background: theme.yellowSoft, color: theme.yellow, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="autoreply" size={16} />
          <span>{convo.sessionExpiresAt ? "Sesi 24 jam berakhir. Balasan teks bebas tidak bisa dikirim — gunakan template (lewat Broadcast) untuk follow up." : "Kontak belum pernah membalas. Mulai dengan template lewat Broadcast agar sesi terbuka."}</span>
        </div>
      )}
    </div>
  );
}

// ── Panel detail (kanan) ────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: theme.text }}>{value}</div>
    </div>
  );
}

function DetailsPanel({ convo, onResolve, bare }) {
  const notes = useLoader(useCallback(() => api.listNotes(convo.id), [convo.id]));
  const [noteText, setNoteText] = useState("");
  const [adding, setAdding] = useState(false);
  const sess = sessionInfo(convo);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAdding(true);
    try { await api.addNote(convo.id, noteText.trim()); setNoteText(""); await notes.reload(); }
    finally { setAdding(false); }
  };

  const body = (
    <div style={{ padding: bare ? 0 : 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: theme.primarySoft, color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 24, marginBottom: 8 }}>{(convo.name || convo.phone).slice(0, 1).toUpperCase()}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{convo.name || "(tanpa nama)"}</div>
        <div style={{ fontSize: 12.5, color: theme.textMuted }}>{convo.phone}</div>
        <div style={{ marginTop: 8 }}><Badge tone={sess.tone}>{sess.label}</Badge></div>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Detail Percakapan</div>
        <DetailRow label="Vendor" value={convo.vendor ? convo.vendor.toUpperCase() : "—"} />
        <DetailRow label="Dibuat" value={fmtDate(convo.firstAt)} />
        <DetailRow label="Aktivitas terakhir" value={fmtDate(convo.lastAt)} />
        <DetailRow label="Status sesi" value={sess.active ? sess.detail : (convo.sessionExpiresAt ? `Kedaluwarsa ${fmtDate(convo.sessionExpiresAt)}` : "Belum dibuka")} />
        <DetailRow label="Status" value={convo.resolved ? "Selesai" : "Terbuka"} />
        <Button variant={convo.resolved ? "secondary" : "success"} size="sm" icon={convo.resolved ? "refresh" : "check"} onClick={() => onResolve(convo.id, !convo.resolved)} style={{ width: "100%", marginTop: 4 }}>{convo.resolved ? "Buka kembali" : "Tandai selesai"}</Button>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Catatan</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !adding && addNote()} placeholder="Tambah catatan..." style={{ flex: 1, padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 12.5, outline: "none", boxSizing: "border-box" }} />
          <Button size="sm" icon="plus" onClick={addNote} disabled={adding || !noteText.trim()} />
        </div>
        {notes.loading ? <Loading /> : (notes.data || []).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(notes.data || []).map((n, i) => (
              <div key={i} style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "8px 11px" }}>
                <div style={{ fontSize: 12.5, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</div>
                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3 }}>{fmtDate(n.at)}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12.5, color: theme.textMuted }}>Belum ada catatan.</div>}
      </div>
    </div>
  );

  return body;
}
