import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  Button,
  Badge,
  Modal,
  Notice,
  Loading,
  Empty,
  useLoader,
  useSelection,
  Checkbox,
  BulkBar,
  useIsMobile,
  useMediaQuery,
  theme,
  Icon,
} from "../lib/ui";
import { FILTERS, sessionInfo, shortTime, matchesFilter } from "./chatbox/constants";
import { Conversation } from "./chatbox/Conversation";
import { DetailsPanel } from "./chatbox/DetailsPanel";

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
      if (document.hidden) return; // jeda saat tab tak terlihat → hemat kuota/baterai
      api
        .conversations()
        .then((d) => convos.setData(d))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [convos.setData]);

  const bulkDeleteConvos = async () => {
    if (
      !sel.size ||
      !window.confirm(`Hapus ${sel.size} percakapan terpilih? Riwayat pesannya akan dihapus (kontak tetap ada).`)
    )
      return;
    setBulkBusy(true);
    setActionErr("");
    try {
      const ids = sel.list();
      await api.bulkDeleteConversations(ids);
      if (ids.includes(activeId)) setActiveId(null);
      sel.clear();
      await convos.reload();
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setBulkBusy(false);
    }
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
      const da = new Date(a.lastAt).getTime(),
        db = new Date(b.lastAt).getTime();
      return sortNewest ? db - da : da - db;
    });
    return arr;
  }, [all, filter, search, sortNewest]);

  const resolve = async (id, resolved) => {
    setActionErr("");
    try {
      await api.resolveConversation(id, resolved);
      await convos.reload();
    } catch (e) {
      setActionErr(e.message);
    }
  };

  // ── Sub-render: daftar percakapan ──
  const listPanel = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        borderRight: isMobile ? "none" : `1px solid ${theme.border}`,
      }}
    >
      {/* Search + sort */}
      <div style={{ padding: 12, borderBottom: `1px solid ${theme.border}`, display: "grid", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: 9, color: theme.textMuted }}>
            <Icon name="search" size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor, pesan..."
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${filter === f.key ? theme.primary : theme.border}`,
                background: filter === f.key ? theme.primarySoft : theme.surface,
                color: filter === f.key ? theme.primary : theme.textMuted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
              {counts[f.key] ? ` (${counts[f.key]})` : ""}
            </button>
          ))}
          <button
            onClick={() => setSortNewest((s) => !s)}
            title="Urutkan"
            style={{
              marginLeft: "auto",
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              color: theme.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {sortNewest ? "Terbaru" : "Terlama"}
          </button>
        </div>
      </div>

      {sel.size ? (
        <div style={{ padding: "8px 12px 0" }}>
          <BulkBar
            count={sel.size}
            total={list.length}
            allSelected={list.length > 0 && list.every((c) => sel.has(c.id))}
            noun="percakapan"
            busy={bulkBusy}
            onToggleAll={() => (list.every((c) => sel.has(c.id)) ? sel.clear() : sel.setAll(list.map((c) => c.id)))}
            onClear={sel.clear}
            onDelete={bulkDeleteConvos}
          />
        </div>
      ) : null}

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {convos.loading ? (
          <Loading />
        ) : list.length ? (
          list.map((c) => {
            const sess = sessionInfo(c);
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 13px",
                  borderBottom: `1px solid ${theme.border}`,
                  background: sel.has(c.id) ? theme.primarySoft : activeId === c.id ? theme.primarySoft : "transparent",
                }}
              >
                <Checkbox checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
                <button
                  onClick={() => {
                    setActiveId(c.id);
                    setShowDetails(false);
                  }}
                  style={{
                    display: "flex",
                    gap: 10,
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: "11px 0",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: theme.surfaceAlt,
                        color: theme.text,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {(c.name || c.phone).slice(0, 1).toUpperCase()}
                    </div>
                    {sess.active ? (
                      <span
                        style={{
                          position: "absolute",
                          right: -1,
                          bottom: -1,
                          width: 11,
                          height: 11,
                          borderRadius: "50%",
                          background: theme.green,
                          border: `2px solid ${theme.surface}`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: theme.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name || c.phone}
                      </span>
                      <span style={{ color: theme.textMuted, fontSize: 11, flexShrink: 0 }}>{shortTime(c.lastAt)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 6,
                        alignItems: "center",
                        marginTop: 3,
                      }}
                    >
                      <span
                        style={{
                          color: theme.textMuted,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.lastDirection === "out" ? "↪ " : ""}
                        {c.lastMessage || "—"}
                      </span>
                      <span style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                        {c.resolved ? (
                          <Badge tone="green">selesai</Badge>
                        ) : c.unread > 0 ? (
                          <span
                            style={{
                              minWidth: 18,
                              height: 18,
                              padding: "0 5px",
                              borderRadius: 999,
                              background: theme.red,
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {c.unread}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })
        ) : (
          <Empty icon="chat" title="Tidak ada percakapan" note={filter !== "all" ? "Coba filter lain." : undefined} />
        )}
      </div>
    </div>
  );

  const detailsPanel = active ? <DetailsPanel convo={active} onResolve={resolve} /> : null;

  // ── Mobile: master-detail ──
  if (isMobile) {
    return (
      <div>
        <PageHeader
          title="Chat"
          subtitle="Inbox percakapan WhatsApp."
          actions={[
            <Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>
              Refresh
            </Button>,
          ]}
        />
        <Notice>{convos.error || actionErr}</Notice>
        <div
          style={{
            ...cardWrap,
            height: "calc(100vh - 180px)",
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {active ? (
            <Conversation
              convo={active}
              onBack={() => setActiveId(null)}
              onReload={convos.reload}
              onResolve={resolve}
              onShowDetails={() => setShowDetails(true)}
              isMobile
            />
          ) : (
            listPanel
          )}
        </div>
        {showDetails && active ? (
          <Modal title="Detail Kontak" onClose={() => setShowDetails(false)} width={420}>
            <DetailsPanel convo={active} onResolve={resolve} bare />
          </Modal>
        ) : null}
      </div>
    );
  }

  // ── Desktop / tablet ──
  const cols = detailsInline ? "300px 1fr 320px" : "300px 1fr";
  return (
    <div>
      <PageHeader
        title="Chat"
        subtitle="Inbox percakapan WhatsApp."
        actions={[
          <Button key="r" variant="ghost" icon="refresh" onClick={convos.reload}>
            Refresh
          </Button>,
        ]}
      />
      <Notice>{convos.error || actionErr}</Notice>
      <div
        style={{
          ...cardWrap,
          display: "grid",
          gridTemplateColumns: cols,
          height: "calc(100vh - 170px)",
          minHeight: 480,
        }}
      >
        {listPanel}
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
            borderRight: detailsInline ? `1px solid ${theme.border}` : "none",
          }}
        >
          {active ? (
            <Conversation
              convo={active}
              onReload={convos.reload}
              onResolve={resolve}
              onShowDetails={detailsInline ? null : () => setShowDetails(true)}
            />
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: theme.textMuted,
                fontSize: 13.5,
              }}
            >
              Pilih percakapan untuk mulai membalas
            </div>
          )}
        </div>
        {detailsInline ? (
          <div style={{ minHeight: 0, height: "100%", overflowY: "auto" }}>
            {detailsPanel || (
              <div
                style={{
                  display: "flex",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.textMuted,
                  fontSize: 12.5,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                Detail kontak muncul di sini
              </div>
            )}
          </div>
        ) : null}
      </div>
      {!detailsInline && showDetails && active ? (
        <Modal title="Detail Kontak" onClose={() => setShowDetails(false)} width={420}>
          <DetailsPanel convo={active} onResolve={resolve} bare />
        </Modal>
      ) : null}
    </div>
  );
}

const cardWrap = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 14,
  overflow: "hidden",
};
