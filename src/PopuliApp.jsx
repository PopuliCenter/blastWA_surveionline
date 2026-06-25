import { useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./lib/api";
import { theme, fontStack, card, Icon, Button, Input, Loading, useIsMobile } from "./lib/ui";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Chat from "./pages/Chat";
import Broadcast from "./pages/Broadcast";
import Surveys from "./pages/Surveys";
import Reports from "./pages/Reports";
import AutoReply from "./pages/AutoReply";
import AiAgent from "./pages/AiAgent";
import WhatsAppAccount from "./pages/WhatsAppAccount";
import Webhook from "./pages/Webhook";
import Admin from "./pages/Admin";
import ComingSoon from "./pages/ComingSoon";

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
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" error={error} />
        </div>
        <Button onClick={handleLogin} disabled={loading || !username || !password} style={{ width: "100%" }}>{loading ? "Memverifikasi..." : "Masuk"}</Button>
        <div style={{ marginTop: 14, fontSize: 12, color: theme.textMuted, textAlign: "center" }}>Default: <strong style={{ color: theme.text }}>populi / populi13!</strong></div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, currentUser, onLogout, mobile, onClose }) {
  const asideStyle = mobile
    ? { width: "100%", background: theme.surface, padding: "16px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", minHeight: "100vh" }
    : { width: 250, background: theme.surface, borderRight: `1px solid ${theme.border}`, padding: "18px 14px", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", overflowY: "auto", display: "flex", flexDirection: "column" };
  return (
    <aside style={asideStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px" }}>
        <img src="/logopopuli.png" alt="Populi" style={{ height: 30, objectFit: "contain" }} />
        <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Populi</div>
        {mobile ? <button onClick={onClose} aria-label="Tutup menu" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="close" size={22} /></button> : null}
      </div>
      <nav style={{ flex: 1 }}>
        {NAV.map((sec) => {
          const items = sec.items.filter((it) => !it.superadmin || currentUser.role === "superadmin");
          if (!items.length) return null;
          return (
            <div key={sec.group} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: theme.textMuted, padding: "0 10px 7px" }}>{sec.group}</div>
              <div style={{ display: "grid", gap: 2 }}>
                {items.map((it) => {
                  const on = active === it.id;
                  return (
                    <button key={it.id} onClick={() => setActive(it.id)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 9, border: "none", background: on ? theme.primarySoft : "transparent", color: on ? theme.primary : theme.text, fontWeight: on ? 600 : 500, fontSize: 13.5, textAlign: "left", cursor: "pointer" }}>
                      <Icon name={it.icon} size={18} />
                      <span style={{ flex: 1 }}>{it.label}</span>
                      {it.soon ? <span style={{ fontSize: 9.5, color: theme.yellow, background: theme.yellowSoft, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>SOON</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: theme.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(currentUser.name || currentUser.username || "?").slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name || currentUser.username}</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted }}>{currentUser.role}</div>
        </div>
        <button onClick={onLogout} title="Keluar" style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex" }}><Icon name="logout" size={18} /></button>
      </div>
    </aside>
  );
}

export default function PopuliApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const logout = () => { setToken(null); setCurrentUser(null); setActive("dashboard"); };
  const selectPage = (id) => { setActive(id); setDrawerOpen(false); };

  const pages = useMemo(() => ({
    dashboard: <Dashboard />,
    "wa-account": <WhatsAppAccount />,
    instagram: <ComingSoon title="Instagram" icon="instagram" desc="Kelola DM & komentar Instagram dalam satu inbox bersama WhatsApp." features={["Balas DM Instagram", "Auto reply komentar", "Inbox terpadu"]} />,
    contacts: <Contacts />,
    chat: <Chat />,
    broadcast: <Broadcast />,
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
              <Sidebar active={active} setActive={selectPage} currentUser={currentUser} onLogout={logout} mobile onClose={() => setDrawerOpen(false)} />
            </div>
          </>
        ) : null}

        <main style={{ padding: "16px 14px", minWidth: 0 }}>{pages[active] || pages.dashboard}</main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: fontStack }}>
      <Sidebar active={active} setActive={setActive} currentUser={currentUser} onLogout={logout} />
      <main style={{ flex: 1, padding: "26px 30px", maxWidth: 1200, minWidth: 0, width: "100%" }}>{pages[active] || pages.dashboard}</main>
    </div>
  );
}
