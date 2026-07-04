import { useState } from "react";
import { api } from "../../lib/api";
import { Modal, Notice, Button, theme } from "../../lib/ui";
import { ContactImporter } from "../../lib/contactImport";

// Tambah kontak ke segmen yang sudah ada (upload file / tempel nomor).
export function AddContactsModal({ segment, onClose, onDone }) {
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      const r = await api.addSegmentContacts(segment.id, contacts);
      setResult(r); // { added, skipped, total }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Tambah Kontak — ${segment.name}`} onClose={onClose} width={540}>
      <Notice>{err}</Notice>
      {result ? (
        <div>
          <div
            style={{
              background: theme.greenSoft,
              color: theme.green,
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 13,
            }}
          >
            ✓ {result.added} kontak ditambahkan{result.skipped ? `, ${result.skipped} dilewati (duplikat/invalid)` : ""}
            . Total segmen sekarang: <strong>{result.total}</strong>.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <Button onClick={onDone}>Selesai</Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 10 }}>
            Nomor yang sudah ada di segmen ini otomatis dilewati (tidak dobel).
          </div>
          <ContactImporter onContacts={setContacts} />
          <div style={{ color: theme.textMuted, fontSize: 12.5, margin: "6px 0 14px" }}>
            {contacts.length} kontak akan ditambahkan (nomor dinormalisasi ke 62…).
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={submit} disabled={!contacts.length || saving}>
              {saving ? "Menambahkan..." : `Tambahkan (${contacts.length})`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
