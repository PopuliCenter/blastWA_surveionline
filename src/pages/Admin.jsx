import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Select, Modal, Notice, Loading, useLoader, useIsMobile, theme } from "../lib/ui";

export default function Admin({ currentUser }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listUsers(), []));
  const [modalUser, setModalUser] = useState(null);
  const [actionError, setActionError] = useState("");
  const users = data || [];

  const run = async (fn) => { setActionError(""); try { await fn(); await reload(); } catch (e) { setActionError(e.message); } };

  return (
    <div>
      <PageHeader title="Admin" subtitle="Kelola user & akses dashboard." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>,
        <Button key="n" icon="plus" onClick={() => setModalUser({})}>Tambah User</Button>,
      ]} />
      <Notice>{error || actionError}</Notice>
      <Card pad={0}>
        {loading ? <Loading /> : (
          <div>
            {users.map((u, i) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: i ? `1px solid ${theme.border}` : "none" }}>
                <div>
                  <div style={{ fontWeight: 600, color: theme.text }}>{u.name}</div>
                  <div style={{ fontSize: 12.5, color: theme.textMuted }}>{u.username} • {u.email || "-"}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <Badge tone={u.active ? "green" : "red"}>{u.active ? "aktif" : "nonaktif"}</Badge>
                    <Badge tone="purple">{u.role}</Badge>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModalUser(u)}>Edit</Button>
                  {u.id !== currentUser.id ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => run(() => api.updateUser(u.id, { active: !u.active }))}>{u.active ? "Nonaktifkan" : "Aktifkan"}</Button>
                      <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteUser(u.id))} />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {modalUser !== null ? <UserModal user={modalUser.id ? modalUser : null} onClose={() => setModalUser(null)} onSave={(draft) => run(async () => { if (modalUser.id) await api.updateUser(modalUser.id, draft); else await api.createUser(draft); setModalUser(null); })} /> : null}
    </div>
  );
}

function UserModal({ user, onClose, onSave }) {
  const isMobile = useIsMobile();
  const [f, setF] = useState({ name: user?.name || "", username: user?.username || "", password: "", email: user?.email || "", role: user?.role || "admin", active: user?.active ?? true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const submit = async () => {
    setSaving(true);
    try { const d = { name: f.name, username: f.username, email: f.email, role: f.role, active: f.active }; if (f.password.trim()) d.password = f.password; await onSave(d); } finally { setSaving(false); }
  };
  return (
    <Modal title={user ? "Edit User" : "Tambah User"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Input label="Nama" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <Input label="Username" value={f.username} onChange={(e) => set("username", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Input label={user ? "Password (kosongkan = tetap)" : "Password"} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        <Input label="Email" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <Select label="Role" value={f.role} onChange={(e) => set("role", e.target.value)} options={[{ value: "superadmin", label: "Superadmin" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }]} />
      <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, color: theme.text, fontSize: 13 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Akun aktif
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!f.name.trim() || !f.username.trim() || (!user && !f.password.trim()) || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}
