import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Modal, Notice, Loading, Empty, useLoader, theme, fmtDate, Icon } from "../lib/ui";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const loader = useLoader(useCallback(() => api.listContacts(), []));
  const [modal, setModal] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const contacts = (loader.data || []).filter((c) => `${c.phone} ${c.name || ""}`.toLowerCase().includes(search.toLowerCase()));

  const run = async (fn) => { setActionError(""); try { await fn(); await loader.reload(); } catch (e) { setActionError(e.message); } };

  return (
    <div>
      <PageHeader title="Kontak" subtitle="Daftar kontak WhatsApp Anda." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={loader.reload}>Refresh</Button>,
        <Button key="b" variant="secondary" icon="upload" onClick={() => setBulkOpen(true)}>Impor Massal</Button>,
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
                    <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7 }}>
                      {c.name || "(tanpa nama)"}
                      {c.subscribed === false ? <Badge tone="red">berhenti</Badge> : null}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 12.5 }}>{c.phone} • ditambah {fmtDate(c.createdAt)}{c.consentSource ? ` • ${c.consentSource}` : ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => run(() => api.updateContact(c.id, { subscribed: c.subscribed === false }))} title={c.subscribed === false ? "Langganan ulang" : "Tandai berhenti"}>{c.subscribed === false ? "Langgan" : "Berhenti"}</Button>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(c)}>Edit</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteContact(c.id))} />
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon="contacts" title="Belum ada kontak" note="Tambah kontak atau impor lewat segmen." />}
      </Card>
      {modal !== null ? <ContactModal contact={modal.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => run(async () => { if (modal.id) await api.updateContact(modal.id, d); else await api.createContact(d); setModal(null); })} /> : null}
      {bulkOpen ? <BulkModal onClose={() => setBulkOpen(false)} onDone={() => { setBulkOpen(false); loader.reload(); }} /> : null}
    </div>
  );
}

function parseTextContacts(raw) {
  return raw.split("\n").map((line) => {
    const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    if (parts.length === 1) return { phone: parts[0] };
    const phoneIdx = parts.findIndex((p) => p.replace(/\D/g, "").length >= 8);
    if (phoneIdx === -1) return null;
    const phone = parts[phoneIdx];
    const name = parts.filter((_, i) => i !== phoneIdx).join(" ") || undefined;
    return { phone, name };
  }).filter(Boolean);
}

function parseExcelContacts(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows.length) return [];

  // Deteksi kolom dari baris pertama (header)
  const rawHeader = rows[0].map((h) => String(h).trim());
  const headerLc = rawHeader.map((h) => h.toLowerCase());
  const nameIdx = headerLc.findIndex((h) => /\bnama\b|\bname\b/.test(h));
  const phoneIdx = headerLc.findIndex((h) => /nomor|phone|no\.?\s*hp|^hp$|wa|telepon|handphone|no\.?\s*wa/.test(h));
  const hasHeader = nameIdx >= 0 || phoneIdx >= 0;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const ni = nameIdx;
  const pi = phoneIdx >= 0 ? phoneIdx : (ni === 0 ? 1 : 0);

  return dataRows.map((row) => {
    const phone = String(row[pi] ?? "").trim();
    if (phone.replace(/\D/g, "").length < 8) return null;
    const name = ni >= 0 ? String(row[ni] ?? "").trim() || undefined : undefined;
    // Semua kolom lain (selain nama & nomor) → atribut pembobot, lewati sel kosong
    const attributes = {};
    if (hasHeader) {
      rawHeader.forEach((h, idx) => {
        if (idx === ni || idx === pi || !h) return;
        const v = row[idx];
        if (v === "" || v === null || v === undefined) return;
        attributes[h] = typeof v === "number" ? v : String(v).trim();
      });
    }
    const c = { phone };
    if (name) c.name = name;
    if (Object.keys(attributes).length) c.attributes = attributes;
    return c;
  }).filter(Boolean);
}

// Template pembobot: kolom demografi standar (cocok dengan dataset responden)
function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [
    ["Nama", "No hp", "Jenis Kelamin", "Umur", "Agama", "Pendidikan", "Pekerjaan", "Provinsi", "Kab/Kota"],
    ["Andi Susanto", "081234567890", "Laki-Laki", 35, "Islam", "Tamat SMA", "Pegawai Swasta", "ACEH", "Banda Aceh"],
    ["Sari Dewi", "6281298765432", "Perempuan", 28, "Kristen", "Tamat S-1 atau Lebih Tinggi", "Wiraswasta", "JAWA BARAT", "Bandung"],
    ["Budi Pratama", "081200001111", "Laki-Laki", 47, "Islam", "Tamat SD", "Petani/Peternak/Nelayan", "JAWA TENGAH", "Semarang"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 13 }, { wch: 7 }, { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Kontak");
  XLSX.writeFile(wb, "template-pembobot-populi.xlsx");
}

function BulkModal({ onClose, onDone }) {
  const [mode, setMode] = useState("file"); // "file" | "text"
  const [raw, setRaw] = useState("");
  const [contacts, setContacts] = useState([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  const textContacts = mode === "text" ? parseTextContacts(raw) : contacts;

  const handleFile = (file) => {
    if (!file) return;
    setErr(""); setResult(null); setContacts([]);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const parsed = parseExcelContacts(wb);
        setContacts(parsed);
        if (!parsed.length) setErr("Tidak ada kontak valid ditemukan di file. Pastikan kolom 'Nomor WhatsApp' ada.");
      } catch {
        setErr("Gagal membaca file. Pastikan format .xlsx / .xls / .csv.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const submit = async () => {
    setBusy(true); setErr(""); setResult(null);
    try { const r = await api.bulkContacts(textContacts); setResult(r); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const tabStyle = (active) => ({
    padding: "7px 16px", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
    borderBottom: `2px solid ${active ? theme.primary : "transparent"}`,
    color: active ? theme.primary : theme.textMuted, background: "none", border: "none",
    borderBottom: `2px solid ${active ? theme.primary : "transparent"}`,
    transition: "color 0.15s",
  });

  return (
    <Modal title="Impor Kontak Massal" onClose={onClose} width={540}>
      <Notice>{err}</Notice>
      {result ? <Notice kind="success">Selesai: {result.created} baru, {result.updated} diperbarui, {result.skipped} dilewati (dari {result.total}).</Notice> : null}

      {/* Tab mode */}
      <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, marginBottom: 16, gap: 4 }}>
        <button style={tabStyle(mode === "file")} onClick={() => setMode("file")}>Upload Excel / CSV</button>
        <button style={tabStyle(mode === "text")} onClick={() => setMode("text")}>Tempel Teks</button>
      </div>

      {mode === "file" ? (
        <>
          {/* Template download */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>Sertakan kolom pembobot (Jenis Kelamin, Umur, Agama, dll) — otomatis tergabung ke hasil survei.</span>
            <Button variant="ghost" size="sm" icon="download" onClick={downloadTemplate}>Template Pembobot</Button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? theme.primary : theme.border}`,
              borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer",
              background: dragging ? theme.primarySoft : theme.surfaceAlt,
              transition: "all 0.15s", marginBottom: 14,
            }}
          >
            <div style={{ color: theme.primary, marginBottom: 8, display: "flex", justifyContent: "center" }}>
              <Icon name="upload" size={28} />
            </div>
            {fileName
              ? <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5 }}>{fileName}</div>
              : <div style={{ color: theme.textMuted, fontSize: 13.5 }}>Seret file ke sini atau <span style={{ color: theme.primary, fontWeight: 600 }}>klik untuk pilih</span></div>
            }
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Format: .xlsx, .xls, .csv • Wajib: Nama, No hp • Opsional: kolom pembobot apa pun</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {contacts.length > 0 && (() => {
            const attrKeys = [...new Set(contacts.flatMap((c) => Object.keys(c.attributes || {})))];
            return (
              <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, color: theme.textMuted, marginBottom: 14 }}>
                <span style={{ color: theme.green, fontWeight: 600 }}>✓ {contacts.length} kontak terdeteksi</span>
                {attrKeys.length ? <span style={{ marginLeft: 8 }}>• {attrKeys.length} kolom pembobot: {attrKeys.slice(0, 6).join(", ")}{attrKeys.length > 6 ? "…" : ""}</span> : null}
                {contacts.slice(0, 3).map((c, i) => (
                  <div key={i} style={{ marginTop: 4 }}>{c.name ? `${c.name} — ` : ""}{c.phone}</div>
                ))}
                {contacts.length > 3 && <div style={{ color: theme.textMuted }}>...dan {contacts.length - 3} lainnya</div>}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <Textarea
            label="Daftar kontak (satu per baris)"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Andi, 081234567890\nBudi, 081298765432\n081200001111"}
            style={{ minHeight: 160 }}
            hint="Format: Nama, Nomor  — atau nomor saja. Pisah dengan koma, titik koma, atau tab."
          />
          <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 14 }}>
            Terdeteksi {parseTextContacts(raw).length} kontak valid.
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>{result ? "Tutup" : "Batal"}</Button>
        {result
          ? <Button onClick={onDone}>Selesai & Muat Ulang</Button>
          : <Button onClick={submit} disabled={!textContacts.length || busy}>
              {busy ? "Mengimpor..." : `Impor ${textContacts.length} Kontak`}
            </Button>
        }
      </div>
    </Modal>
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
