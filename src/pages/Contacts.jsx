import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirm";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Modal,
  Notice,
  Loading,
  Empty,
  useLoader,
  useSelection,
  Checkbox,
  BulkBar,
  theme,
  fmtDate,
  Icon,
} from "../lib/ui";
import { ContactImporter } from "../lib/contactImport";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const loader = useLoader(useCallback(() => api.listContacts(), []));
  const [modal, setModal] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const sel = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const contacts = (loader.data || []).filter((c) =>
    `${c.phone} ${c.name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const allSelected = contacts.length > 0 && contacts.every((c) => sel.has(c.id));

  const run = async (fn) => {
    setActionError("");
    try {
      await fn();
      await loader.reload();
    } catch (e) {
      setActionError(e.message);
    }
  };

  const bulkDelete = async () => {
    if (!sel.size) return;
    if (
      !(await confirmDialog({
        title: "Hapus kontak",
        message: `Hapus ${sel.size} kontak terpilih? Tindakan ini permanen.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    setBulkBusy(true);
    setActionError("");
    try {
      await api.bulkDeleteContacts(sel.list());
      sel.clear();
      await loader.reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Kontak"
        subtitle="Daftar kontak WhatsApp Anda."
        actions={[
          <Button key="r" variant="ghost" icon="refresh" onClick={loader.reload}>
            Refresh
          </Button>,
          <Button key="b" variant="secondary" icon="upload" onClick={() => setBulkOpen(true)}>
            Impor Massal
          </Button>,
          <Button key="n" icon="plus" onClick={() => setModal({})}>
            Tambah Kontak
          </Button>,
        ]}
      />
      <Notice>{loader.error || actionError}</Notice>
      <BulkBar
        count={sel.size}
        total={contacts.length}
        allSelected={allSelected}
        noun="kontak"
        busy={bulkBusy}
        onToggleAll={() => (allSelected ? sel.clear() : sel.setAll(contacts.map((c) => c.id)))}
        onClear={sel.clear}
        onDelete={bulkDelete}
      />
      <Card pad={0}>
        <div style={{ padding: 14, borderBottom: `1px solid ${theme.border}`, position: "relative" }}>
          <span style={{ position: "absolute", left: 26, top: 24, color: theme.textMuted }}>
            <Icon name="search" size={16} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor..."
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              fontSize: 13.5,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>
        {loader.loading ? (
          <Loading />
        ) : contacts.length ? (
          <div>
            {contacts.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "13px 18px",
                  borderTop: i ? `1px solid ${theme.border}` : "none",
                  background: sel.has(c.id) ? theme.primarySoft : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Checkbox checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: theme.primarySoft,
                      color: theme.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {(c.name || c.phone).slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: theme.text,
                        fontSize: 13.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      {c.name || "(tanpa nama)"}
                      {c.subscribed === false ? <Badge tone="red">berhenti</Badge> : null}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 12.5 }}>
                      {c.phone} • ditambah {fmtDate(c.createdAt)}
                      {c.consentSource ? ` • ${c.consentSource}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => run(() => api.updateContact(c.id, { subscribed: c.subscribed === false }))}
                    title={c.subscribed === false ? "Langganan ulang" : "Tandai berhenti"}
                  >
                    {c.subscribed === false ? "Langgan" : "Berhenti"}
                  </Button>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(c)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteContact(c.id))} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="contacts" title="Belum ada kontak" note="Tambah kontak atau impor lewat segmen." />
        )}
      </Card>
      {modal !== null ? (
        <ContactModal
          contact={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(d) =>
            run(async () => {
              if (modal.id) await api.updateContact(modal.id, d);
              else await api.createContact(d);
              setModal(null);
            })
          }
        />
      ) : null}
      {bulkOpen ? (
        <BulkModal
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            loader.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function BulkModal({ onClose, onDone }) {
  const [contacts, setContacts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const r = await api.bulkContacts(contacts);
      setResult(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Impor Kontak Massal" onClose={onClose} width={540}>
      <Notice>{err}</Notice>
      {result ? (
        <Notice kind="success">
          Selesai: {result.created} baru, {result.updated} diperbarui, {result.skipped} dilewati (dari {result.total}).
        </Notice>
      ) : null}

      <ContactImporter onContacts={setContacts} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>
          {result ? "Tutup" : "Batal"}
        </Button>
        {result ? (
          <Button onClick={onDone}>Selesai & Muat Ulang</Button>
        ) : (
          <Button onClick={submit} disabled={!contacts.length || busy}>
            {busy ? "Mengimpor..." : `Impor ${contacts.length} Kontak`}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function ContactModal({ contact, onClose, onSave }) {
  const [name, setName] = useState(contact?.name || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ name, phone });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={contact ? "Edit Kontak" : "Tambah Kontak"} onClose={onClose} width={460}>
      <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kontak" />
      <Input
        label="Nomor WhatsApp"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="08xx / 62xx"
        hint="Otomatis dinormalisasi ke format 62…"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={submit} disabled={!phone.trim() || saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </Modal>
  );
}
