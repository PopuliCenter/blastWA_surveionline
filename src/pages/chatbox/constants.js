// ── Helper sesi & waktu ────────────────────────────────────────────────────
export function sessionInfo(convo) {
  if (!convo?.sessionExpiresAt)
    return { active: false, label: "Sesi belum dibuka", detail: "Kontak belum membalas", tone: "default" };
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

export function shortTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString())
    return dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibalas" },
  { key: "active", label: "Sesi aktif" },
  { key: "resolved", label: "Selesai" },
];

export function matchesFilter(c, key) {
  const sess = sessionInfo(c);
  if (key === "unread") return c.unread > 0 && !c.resolved;
  if (key === "active") return sess.active && !c.resolved;
  if (key === "resolved") return c.resolved;
  return true;
}
