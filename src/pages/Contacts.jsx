import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Input, Modal, Notice, Loading, Empty, useLoader, theme, fmtDate, Icon } from "../lib/ui";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const loader = useLoader(useCallback(() => api.listContacts(), []));
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState("");
  const contacts = (loader.data || []).filter((c) => `${c.phone} ${c.name || ""}`.toLowerCase().includes(search.toLowerCase()));

  const run = async (fn) => { setActionError(""); try { await fn(); await loader.reload(); } catch (e) { setActionError(e.message); } };

  return (
    <div>
      <PageHeader title="Kontak" subtitle="Daftar kontak WhatsApp Anda." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={loader.reload}>Refresh</Button>,
        <Button key="n" icon="plus" onClick={() => setModal({})}>Tambah Kontak</Button>,
      ]} />
      <Notice>{loader.error || actionError}</Notice>
      <Card pad={0}>
        <div style={{ padding: 14, borderBottom: `1px solid ${theme.border}`, position: "relative" }}>
          <span style={{ position: "absolute", left: 26, top: 24, color: theme.textMuted }}><Icon name="search" size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau nomor..." style={{ width: "100%", padding: "9px 12px 9px 36px", border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 13.5, boxSizing: "border-box", outline: "none" }} />
        </div>
        {loader.loading ? <Loading /> : contacts.length ? (
          <div>
            {contacts.map((c, i) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderTop: i ? `1px solid ${theme.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.primarySoft, color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{(c.name || c.phone).slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5 }}>{c.name || "(tanpa nama)"}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12.5 }}>{c.phone} • ditambah {fmtDate(c.createdAt)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(c)}>Edit</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteContact(c.id))} />
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon="contacts" title="Belum ada kontak" note="Tambah kontak atau impor lewat segmen." />}
      </Card>
      {modal !== null ? <ContactModal contact={modal.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => run(async () => { if (modal.id) await api.updateContact(modal.id, d); else await api.createContact(d); setModal(null); })} /> : null}
    </div>
  );
}

function ContactModal({ contact, onClose, onSave }) {
  const [name, setName] = useState(contact?.name || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await onSave({ name, phone }); } finally { setSaving(false); } };
  return (
    <Modal title={contact ? "Edit Kontak" : "Tambah Kontak"} onClose={onClose} width={460}>
      <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kontak" />
      <Input label="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx / 62xx" hint="Otomatis dinormalisasi ke format 62…" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!phone.trim() || saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}
