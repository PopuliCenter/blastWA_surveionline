import { useState } from "react";
import { Modal, Input, Button, theme } from "../../lib/ui";
import { ContactImporter } from "../../lib/contactImport";

export function SegmentModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ name, contacts });
    } finally {
      setSaving(false);
    }
  };
  const attrKeys = [...new Set(contacts.flatMap((c) => Object.keys(c.attributes || {})))];
  return (
    <Modal title="Tambah Segmen" onClose={onClose} width={540}>
      <Input
        label="Nama Segmen"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="cth: Pemilih Jawa Barat"
      />
      <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 8 }}>
        Isi kontak segmen (upload file atau tempel nomor)
      </div>
      <ContactImporter onContacts={setContacts} />
      <div style={{ color: theme.textMuted, fontSize: 12.5, margin: "6px 0 14px" }}>
        {contacts.length} kontak akan masuk segmen (nomor dinormalisasi ke 62…)
        {attrKeys.length ? ` • ${attrKeys.length} kolom pembobot ikut tersimpan` : ""}.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={submit} disabled={!name.trim() || !contacts.length || saving}>
          {saving ? "Menyimpan..." : `Simpan Segmen (${contacts.length})`}
        </Button>
      </div>
    </Modal>
  );
}
