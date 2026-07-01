import { useEffect, useRef, useState } from "react";
import { Button, Textarea, theme, Icon } from "./ui";

// xlsx (SheetJS) berat (~400 kB) → dimuat lewat dynamic import HANYA saat impor/unduh,
// bukan di bundle awal (code-splitting agar app ringan dibuka di HP).

// ===== Parsing =====
export function parseTextContacts(raw) {
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

export function parseExcelContacts(XLSX, workbook) {
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

// ===== Template unduhan =====
// Pembobot: kolom demografi standar (cocok dengan dataset responden + integrasi hasil survei)
export async function downloadTemplatePembobot() {
  const XLSX = await import("xlsx");
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

// Biasa: hanya Nama + No hp (untuk blast cepat tanpa data pembobot)
export async function downloadTemplateBiasa() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const data = [
    ["Nama", "No hp"],
    ["Andi Susanto", "081234567890"],
    ["Sari Dewi", "6281298765432"],
    ["Budi Pratama", "081200001111"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Kontak");
  XLSX.writeFile(wb, "template-kontak-biasa.xlsx");
}

// ===== Komponen impor kontak (dipakai di Kontak & Segmen) =====
// onContacts(arr) dipanggil setiap daftar kontak hasil parsing berubah.
export function ContactImporter({ onContacts }) {
  const [mode, setMode] = useState("file"); // "file" | "text"
  const [raw, setRaw] = useState("");
  const [contacts, setContacts] = useState([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  const current = mode === "text" ? parseTextContacts(raw) : contacts;
  useEffect(() => { onContacts(current); /* eslint-disable-next-line */ }, [mode, raw, contacts]);

  const handleFile = (file) => {
    if (!file) return;
    setErr(""); setContacts([]); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const parsed = parseExcelContacts(XLSX, wb);
        setContacts(parsed);
        if (!parsed.length) setErr("Tidak ada kontak valid. Pastikan ada kolom 'Nama' dan 'No hp'.");
      } catch { setErr("Gagal membaca file. Pastikan format .xlsx / .xls / .csv."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const tabStyle = (active) => ({
    padding: "7px 16px", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
    color: active ? theme.primary : theme.textMuted, background: "none", border: "none",
    borderBottom: `2px solid ${active ? theme.primary : "transparent"}`, transition: "color 0.15s",
  });

  return (
    <div>
      {err ? <div style={{ background: theme.redSoft, color: theme.red, borderRadius: 9, padding: "9px 12px", marginBottom: 12, fontSize: 12.5 }}>{err}</div> : null}

      <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, marginBottom: 16, gap: 4 }}>
        <button style={tabStyle(mode === "file")} onClick={() => setMode("file")}>Upload Excel / CSV</button>
        <button style={tabStyle(mode === "text")} onClick={() => setMode("text")}>Tempel Teks</button>
      </div>

      {mode === "file" ? (
        <>
          {/* Dua pilihan template */}
          <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 8 }}>Unduh template (pilih sesuai kebutuhan):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={downloadTemplateBiasa} style={tplCard}>
                <Icon name="download" size={16} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Biasa</span>
                <span style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35 }}>Nama + No hp saja. Untuk blast cepat.</span>
              </button>
              <button onClick={downloadTemplatePembobot} style={tplCard}>
                <Icon name="download" size={16} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Pembobot</span>
                <span style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35 }}>+ demografi (umur, agama, pekerjaan…). Tergabung ke hasil survei.</span>
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? theme.primary : theme.border}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: dragging ? theme.primarySoft : theme.surface, transition: "all 0.15s", marginBottom: 14 }}
          >
            <div style={{ color: theme.primary, marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon name="upload" size={26} /></div>
            {fileName
              ? <div style={{ fontWeight: 600, color: theme.text, fontSize: 13.5 }}>{fileName}</div>
              : <div style={{ color: theme.textMuted, fontSize: 13.5 }}>Seret file ke sini atau <span style={{ color: theme.primary, fontWeight: 600 }}>klik untuk pilih</span></div>}
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Format: .xlsx, .xls, .csv • Wajib: Nama, No hp • Opsional: kolom pembobot apa pun</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {contacts.length > 0 ? (() => {
            const attrKeys = [...new Set(contacts.flatMap((c) => Object.keys(c.attributes || {})))];
            return (
              <div style={{ background: theme.greenSoft, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, color: theme.textMuted, marginBottom: 6 }}>
                <span style={{ color: theme.green, fontWeight: 600 }}>✓ {contacts.length} kontak terdeteksi</span>
                {attrKeys.length ? <span> • {attrKeys.length} kolom pembobot: {attrKeys.slice(0, 6).join(", ")}{attrKeys.length > 6 ? "…" : ""}</span> : <span> • tanpa pembobot</span>}
                {contacts.slice(0, 3).map((c, i) => <div key={i} style={{ marginTop: 4, color: theme.text }}>{c.name ? `${c.name} — ` : ""}{c.phone}</div>)}
                {contacts.length > 3 && <div>...dan {contacts.length - 3} lainnya</div>}
              </div>
            );
          })() : null}
        </>
      ) : (
        <>
          <Textarea label="Daftar kontak (satu per baris)" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"Andi, 081234567890\nBudi, 081298765432\n081200001111"} style={{ minHeight: 150 }} hint="Format: Nama, Nomor — atau nomor saja. Pisah dengan koma, titik koma, atau tab." />
          <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 6 }}>Terdeteksi {parseTextContacts(raw).length} kontak valid.</div>
        </>
      )}
    </div>
  );
}

const tplCard = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left", padding: "10px 12px", border: `1px solid ${theme.border}`, borderRadius: 9, background: theme.surface, cursor: "pointer", color: theme.primary };
