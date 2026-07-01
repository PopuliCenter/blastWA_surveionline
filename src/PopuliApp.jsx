import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { api, getToken, setToken } from "./lib/api";
import { theme, fontStack, card, Icon, Button, Input, PasswordInput, Modal, Notice, Loading, useIsMobile } from "./lib/ui";
import { LegalModal } from "./lib/legal";
import ComingSoon from "./pages/ComingSoon"; // kecil & dipakai beberapa menu → biarkan statis

// Halaman berat dimuat saat dibuka saja (code-splitting) → bundle awal ringan di HP.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Chat = lazy(() => import("./pages/Chat"));
const Broadcast = lazy(() => import("./pages/Broadcast"));
const Templates = lazy(() => import("./pages/Templates"));
const Surveys = lazy(() => import("./pages/Surveys"));
const Reports = lazy(() => import("./pages/Reports"));
const AutoReply = lazy(() => import("./pages/AutoReply"));
const AiAgent = lazy(() => import("./pages/AiAgent"));
const WhatsAppAccount = lazy(() => import("./pages/WhatsAppAccount"));
const Webhook = lazy(() => import("./pages/Webhook"));
const Admin = lazy(() => import("./pages/Admin"));

const NAV = [
  { group: "Utama", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "wa-account", label: "Akun WhatsApp", icon: "whatsapp" },
    { id: "instagram", label: "Instagram", icon: "instagram", soon: true },
    { id: "contacts", label: "Kontak", icon: "contacts" },
  ]},
  { group: "Pesan", items: [
    { id: "chat", label: "Chat", icon: "chat" },
    { id: "broadcast", label: "Broadcast", icon: "broadcast" },
    { id: "templates", label: "Template", icon: "template" },
    { id: "story", label: "WA Story", icon: "story", soon: true },
  ]},
  { group: "Survei", items: [
    { id: "surveys", label: "Survei", icon: "survey" },
    { id: "reports", label: "Laporan", icon: "report" },
  ]},
  { group: "Otomasi", items: [
    { id: "autoreply", label: "Auto Reply", icon: "autoreply" },
    { id: "ai", label: "Agen AI", icon: "ai" },
    { id: "leads", label: "Daily Leads", icon: "leads", soon: true },
    { id: "invoice", label: "Invoice", icon: "invoice", soon: true },
  ]},
  { group: "Sistem", items: [
    { id: "webhook", label: "Webhook", icon: "webhook" },
    { id: "admin", label: "Admin", icon: "admin", superadmin: true },
  ]},
];

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legal, setLegal] = useState(null); // "privacy" | "terms" | null

  const handleLogin = async () => {
    setLoading(true); setError("");
    try { const { token, user } = await api.login(username.trim(), password); setToken(token); onLogin(user); }
    catch (e) { setError(e.message || "Login gagal."); } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${theme.primarySoft} 0%, ${theme.bg} 60%)`, display: "flex", justifyContent: "center", alignItems: "center", padding: 24, fontFamily: fontStack }}>
      <div style={{ ...card, width: "100%", maxWidth: 410, padding: "36px 32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src="/logopopuli.png" alt="Populi" style={{ height: 60, objectFit: "contain", marginBottom: 16 }} />
          <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700, color: theme.text }}>Populi WA Platform</h1>
          <p style={{ margin: 0, color: theme.textMuted, fontSize: 13 }}>Survei, broadcast, & automasi WhatsApp.</p>
        </div>
        <div onKeyDown={(e) => e.key === "Enter" && !loading && username && password && handleLogin()}>
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" />
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" error={error} />
        </div>
        <Button onClick={handleLogin} disabled={loading || !username || !password} style={{ width: "100%" }}>{loading ? "Memverifikasi..." : "Masuk"}</Button>
        <div style={{ marginTop: 14, fontSize: 12, color: theme.textMuted, textAlign: "center" }}>Default: <strong style={{ color: theme.text }}>populi / populi13!</strong></div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${theme.border}`, fontSize: 11.5, color: theme.textMuted, textAlign: "center" }}>
          © 2026 Populi Center · v1.0.0<br />
          <span onClick={() => setLegal("privacy")} style={{ color: theme.primary, cursor: "pointer" }}>Kebijakan Privasi</span>
          {" · "}
          <span onClick={() => setLegal("terms")} style={{ color: theme.primary, cursor: "pointer" }}>Syarat &amp; Ketentuan</span>
        </div>
      </div>
      {legal ? <LegalModal initialTab={legal} onClose={() => setLegal(null)} /> : null}
    </div>
  );
}

function Sidebar({ active, setActive, currentUser, onLogout, onChangePassword, mobile, onClose, collapsed, onToggleCollapse, unread = 0 }) {
  const mini = !mobile && collapsed;
  const asideStyle = mobile
    ? { width: "100%", background: theme.surface, padding: "16px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", minHeight: "100vh" }
    : { width: mini ? 74 : 250, background: theme.surface, borderRight: `1px solid ${theme.border}`, padding: mini ? "18px 10px" : "18px 14px", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", transition: "width .16s ease" };
  return (
    <aside style={asideStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: mini ? "0 0 16px" : "0 8px 18px", justifyContent: mini ? "center" : "flex-start" }}>
        {!mini ? <img src="/logopopuli.png" alt="Populi" style={{ height: 30, objectFit: "contain" }} /> : null}
        {!mini && !mobile ? <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Populi</div> : null}
        {mobile ? <>
          <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Populi</div>
          <button onClick={onClose} aria-label="Tutup menu" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="close" size={22} /></button>
        </> : null}
        {!mobile ? <button onClick={onToggleCollapse} aria-label={mini ? "Buka sidebar" : "Tutup sidebar"} title={mini ? "Buka sidebar" : "Tutup sidebar"} style={{ marginLeft: mini ? 0 : "auto", border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex", padding: 2 }}><Icon name="sidebar" size={20} /></button> : null}
      </div>
      <nav style={{ flex: 1 }}>
        {NAV.map((sec) => {
          const items = sec.items.filter((it) => !it.superadmin || currentUser.role === "superadmin");
          if (!items.length) return null;
          return (
            <div key={sec.group} style={{ marginBottom: mini ? 8 : 14 }}>
              {!mini ? <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: theme.textMuted, padding: "0 10px 7px" }}>{sec.group}</div> : <div style={{ height: 1, background: theme.border, margin: "0 6px 8px" }} />}
              <div style={{ display: "grid", gap: 2 }}>
                {items.map((it) => {
                  const on = active === it.id;
                  return (
                    <button key={it.id} onClick={() => setActive(it.id)} title={mini ? it.label : undefined} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: mini ? "11px 0" : "9px 10px", borderRadius: 9, border: "none", background: on ? theme.primarySoft : "transparent", color: on ? theme.primary : theme.text, fontWeight: on ? 600 : 500, fontSize: 13.5, textAlign: "left", cursor: "pointer", justifyContent: mini ? "center" : "flex-start", position: "relative" }}>
                      <Icon name={it.icon} size={18} />
                      {!mini ? <span style={{ flex: 1 }}>{it.label}</span> : null}
                      {!mini && it.soon ? <span style={{ fontSize: 9.5, color: theme.yellow, background: theme.yellowSoft, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>SOON</span> : null}
                      {mini && it.soon ? <span style={{ position: "absolute", top: 6, right: 12, width: 6, height: 6, borderRadius: "50%", background: theme.yellow }} /> : null}
                      {/* Badge notifikasi pesan belum dibalas pada menu Chat */}
                      {!mini && it.id === "chat" && unread > 0 ? <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: theme.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{unread > 99 ? "99+" : unread}</span> : null}
                      {mini && it.id === "chat" && unread > 0 ? <span style={{ position: "absolute", top: 6, right: 12, width: 8, height: 8, borderRadius: "50%", background: theme.red, border: `2px solid ${theme.surface}` }} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: "flex", alignItems: "center", gap: 10, flexDirection: mini ? "column" : "row" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: theme.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{(currentUser.name || currentUser.username || "?").slice(0, 1).toUpperCase()}</div>
        {!mini ? <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name || currentUser.username}</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted }}>{currentUser.role}</div>
        </div> : null}
        <button onClick={onChangePassword} title="Ganti password" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="settings" size={17} /></button>
        <button onClick={onLogout} title="Keluar" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="logout" size={18} /></button>
      </div>
    </aside>
  );
}

export default function PopuliApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem("populi.activePage") || "dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("populi.sidebarCollapsed") === "1");
  const [showChangePw, setShowChangePw] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { localStorage.setItem("populi.activePage", active); }, [active]);
  useEffect(() => { localStorage.setItem("populi.sidebarCollapsed", collapsed ? "1" : "0"); }, [collapsed]);

  useEffect(() => {
    if (!getToken()) { setAuthReady(true); return; }
    api.me().then((r) => setCurrentUser(r.user)).catch(() => setToken(null)).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => { setCurrentUser(null); setActive("dashboard"); };
    window.addEventListener("populi:logout", onLogout);
    return () => window.removeEventListener("populi:logout", onLogout);
  }, []);

  // Tutup drawer otomatis saat berpindah ke layar lebar
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  // Badge notifikasi global: hitung total pesan belum dibalas, poll tiap 10 detik.
  const [unreadTotal, setUnreadTotal] = useState(0);
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    const tick = () => api.conversations()
      .then((cs) => { if (alive) setUnreadTotal((cs || []).reduce((n, c) => n + (c.resolved ? 0 : (c.unread || 0)), 0)); })
      .catch(() => {});
    tick();
    const id = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [currentUser]);

  const logout = () => { setToken(null); setCurrentUser(null); setActive("dashboard"); };
  const openChangePw = () => { setShowChangePw(true); setDrawerOpen(false); };
  const selectPage = (id) => { setActive(id); setDrawerOpen(false); };

  const pages = useMemo(() => ({
    dashboard: <Dashboard />,
    "wa-account": <WhatsAppAccount />,
    instagram: <ComingSoon title="Instagram" icon="instagram" desc="Kelola DM & komentar Instagram dalam satu inbox bersama WhatsApp." features={["Balas DM Instagram", "Auto reply komentar", "Inbox terpadu"]} />,
    contacts: <Contacts />,
    chat: <Chat />,
    broadcast: <Broadcast />,
    templates: <Templates />,
    story: <ComingSoon title="WA Story" icon="story" desc="Posting status/story WhatsApp Business langsung dari dashboard." features={["Jadwal story", "Story ke banyak akun"]} />,
    surveys: <Surveys />,
    reports: <Reports />,
    autoreply: <AutoReply />,
    ai: <AiAgent />,
    leads: <ComingSoon title="Daily Leads" icon="leads" desc="Kumpulkan & kelola leads harian dari percakapan WhatsApp secara otomatis." features={["Tangkap leads dari chat", "Pipeline & status", "Ekspor ke CRM"]} />,
    invoice: <ComingSoon title="Invoice" icon="invoice" desc="Buat & kirim invoice ke pelanggan lewat WhatsApp." features={["Buat invoice", "Kirim & reminder otomatis", "Status pembayaran"]} />,
    webhook: <Webhook />,
    admin: currentUser?.role === "superadmin" ? <Admin currentUser={currentUser} /> : <Dashboard />,
  }), [currentUser]);

  if (!authReady) return <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}><Loading /></div>;
  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: fontStack }}>
        <header style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="Buka menu" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.text, display: "flex", padding: 2 }}><Icon name="menu" size={24} /></button>
          <img src="/logopopuli.png" alt="Populi" style={{ height: 26, objectFit: "contain" }} />
          <div style={{ fontWeight: 800, fontSize: 15.5, color: theme.text }}>Populi</div>
        </header>

        {drawerOpen ? (
          <>
            <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 50 }} />
            <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 270, maxWidth: "84vw", background: theme.surface, zIndex: 55, boxShadow: "2px 0 18px rgba(15,23,42,0.18)", overflowY: "auto" }}>
              <Sidebar active={active} setActive={selectPage} currentUser={currentUser} onLogout={logout} onChangePassword={openChangePw} mobile onClose={() => setDrawerOpen(false)} unread={unreadTotal} />
            </div>
          </>
        ) : null}

        <main style={{ padding: "16px 14px", minWidth: 0 }}><Suspense fallback={<Loading />}>{pages[active] || pages.dashboard}</Suspense></main>
        {showChangePw ? <ChangePasswordModal onClose={() => setShowChangePw(false)} /> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: fontStack }}>
      <Sidebar active={active} setActive={setActive} currentUser={currentUser} onLogout={logout} onChangePassword={openChangePw} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} unread={unreadTotal} />
      <main style={{ flex: 1, padding: "26px 30px", maxWidth: 1200, minWidth: 0, width: "100%" }}><Suspense fallback={<Loading />}>{pages[active] || pages.dashboard}</Suspense></main>
      {showChangePw ? <ChangePasswordModal onClose={() => setShowChangePw(false)} /> : null}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr("");
    if (next.length < 8) return setErr("Password baru minimal 8 karakter.");
    if (next !== confirm) return setErr("Konfirmasi password tidak sama.");
    if (next === cur) return setErr("Password baru harus berbeda dari yang lama.");
    setSaving(true);
    try {
      await api.changePassword(cur, next);
      setOk(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Ganti Password" onClose={onClose} width={440}>
      {ok ? (
        <div>
          <Notice kind="success">Password berhasil diganti. Gunakan password baru saat login berikutnya.</Notice>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={onClose}>Tutup</Button></div>
        </div>
      ) : (
        <div>
          <Notice>{err}</Notice>
          <PasswordInput label="Password lama" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
          <PasswordInput label="Password baru (min. 8 karakter)" value={next} onChange={(e) => setNext(e.target.value)} />
          <PasswordInput label="Ulangi password baru" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={submit} disabled={!cur || !next || !confirm || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
