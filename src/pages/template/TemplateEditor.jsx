import { useMemo, useState } from "react";
import { Button, Input, Textarea, Select, Modal, Badge, Icon, useIsMobile, theme } from "../../lib/ui";
import {
  CATEGORIES,
  LANGS,
  HEADER_TYPES,
  USECASE_LABEL,
  STATUS_LABEL,
  blankTemplate,
  maxVar,
  normalizeName,
} from "./constants";
import { WaPreview, MetaChecklist, metaChecks } from "./preview";

// ===== Editor =====
export function TemplateEditor({ initial, onClose, onSave }) {
  const [f, setF] = useState({
    ...blankTemplate(),
    ...initial,
    buttons: initial.buttons || [],
    sampleParams: initial.sampleParams || [],
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const isMobile = useIsMobile();
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const nVars = Math.max(maxVar(f.bodyText), maxVar(f.headerType === "text" ? f.headerText || "" : ""));
  const checks = useMemo(() => metaChecks(f, nVars), [f, nVars]);
  const blocking = checks.filter((c) => c.level === "error" && !c.ok);

  const setSample = (i, v) => {
    const arr = [...(f.sampleParams || [])];
    arr[i] = v;
    set("sampleParams", arr);
  };
  const addVar = () => set("bodyText", `${f.bodyText}{{${nVars + 1}}}`);

  const addButton = (type) => {
    if ((f.buttons || []).length >= 3) return;
    const base = { type, text: type === "URL" ? "Buka Tautan" : type === "PHONE_NUMBER" ? "Telepon" : "Balas" };
    set("buttons", [
      ...(f.buttons || []),
      type === "URL" ? { ...base, url: "https://" } : type === "PHONE_NUMBER" ? { ...base, phone: "+62" } : base,
    ]);
  };
  const setButton = (i, k, v) => {
    const arr = [...f.buttons];
    arr[i] = { ...arr[i], [k]: v };
    set("buttons", arr);
  };
  const delButton = (i) =>
    set(
      "buttons",
      f.buttons.filter((_, idx) => idx !== i),
    );

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ ...f, name: normalizeName(f.name) || "template" });
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <div>
      <Input
        label="Nama Template"
        value={f.name}
        onChange={(e) => set("name", e.target.value)}
        hint={`Disimpan sebagai: ${normalizeName(f.name) || "—"} (huruf kecil & underscore, sesuai aturan Meta)`}
        placeholder="undangan_survei"
      />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Select
          label="Kategori"
          value={f.category}
          onChange={(e) => set("category", e.target.value)}
          options={CATEGORIES}
        />
        <Select label="Bahasa" value={f.language} onChange={(e) => set("language", e.target.value)} options={LANGS} />
      </div>
      <Select
        label="Untuk kebutuhan"
        value={f.useCase}
        onChange={(e) => set("useCase", e.target.value)}
        options={Object.entries(USECASE_LABEL).map(([value, label]) => ({ value, label }))}
      />

      {/* Header */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 14px" }} />
      <Select
        label="Header (opsional)"
        value={f.headerType}
        onChange={(e) => set("headerType", e.target.value)}
        options={HEADER_TYPES}
      />
      {f.headerType === "text" ? (
        <Input
          label="Teks Header"
          value={f.headerText}
          onChange={(e) => set("headerText", e.target.value)}
          hint="Maks. 60 karakter. Boleh 1 variabel."
          maxLength={60}
        />
      ) : null}
      {["image", "document", "video"].includes(f.headerType) ? (
        <Input
          label={`Contoh URL ${f.headerType === "image" ? "gambar" : f.headerType === "document" ? "dokumen (PDF)" : "video"}`}
          value={f.headerMediaUrl}
          onChange={(e) => set("headerMediaUrl", e.target.value)}
          hint="Dipakai sebagai contoh saat pengajuan ke Meta & untuk preview. Saat blast, file aktual dilampirkan per pengiriman."
          placeholder="https://..."
        />
      ) : null}

      {/* Body */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 14px" }} />
      <Textarea
        label="Isi Pesan (body)"
        value={f.bodyText}
        onChange={(e) => set("bodyText", e.target.value)}
        hint="Format: *tebal*, _miring_. Variabel: {{1}}, {{2}}. Maks. 1024 karakter."
        style={{ minHeight: 120 }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -6, marginBottom: 12 }}>
        <Button size="sm" variant="secondary" icon="plus" onClick={addVar}>
          Sisipkan {`{{${nVars + 1}}}`}
        </Button>
        <span style={{ fontSize: 12, color: theme.textMuted, alignSelf: "center" }}>{nVars} variabel terdeteksi</span>
      </div>

      {/* Contoh nilai variabel */}
      {nVars > 0 ? (
        <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: "12px 12px 2px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
            Contoh nilai variabel (untuk preview & approval)
          </div>
          {Array.from({ length: nVars }).map((_, i) => (
            <Input
              key={i}
              label={`Contoh untuk {{${i + 1}}}`}
              value={f.sampleParams[i] || ""}
              onChange={(e) => setSample(i, e.target.value)}
              placeholder={`nilai contoh {{${i + 1}}}`}
            />
          ))}
        </div>
      ) : null}

      <Input
        label="Footer (opsional)"
        value={f.footerText}
        onChange={(e) => set("footerText", e.target.value)}
        hint="Teks statis kecil di bawah pesan. Maks. 60 karakter, tidak boleh ada variabel."
        maxLength={60}
      />

      {/* Tombol */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 12px" }} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
        Tombol (opsional, maks. 3)
      </div>
      {(f.buttons || []).map((b, i) => (
        <div key={i} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Badge tone="blue">
              {b.type === "QUICK_REPLY" ? "Balasan Cepat" : b.type === "URL" ? "Tautan" : "Telepon"}
            </Badge>
            <button
              onClick={() => delButton(i)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: theme.red,
                display: "flex",
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
          <input
            value={b.text}
            onChange={(e) => setButton(i, "text", e.target.value)}
            placeholder="Teks tombol"
            maxLength={25}
            style={miniInput}
          />
          {b.type === "URL" ? (
            <input
              value={b.url || ""}
              onChange={(e) => setButton(i, "url", e.target.value)}
              placeholder="https://..."
              style={{ ...miniInput, marginTop: 6 }}
            />
          ) : null}
          {b.type === "PHONE_NUMBER" ? (
            <input
              value={b.phone || ""}
              onChange={(e) => setButton(i, "phone", e.target.value)}
              placeholder="+628123456789"
              style={{ ...miniInput, marginTop: 6 }}
            />
          ) : null}
        </div>
      ))}
      {(f.buttons || []).length < 3 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <Button size="sm" variant="ghost" icon="autoreply" onClick={() => addButton("QUICK_REPLY")}>
            + Balasan Cepat
          </Button>
          <Button size="sm" variant="ghost" icon="link" onClick={() => addButton("URL")}>
            + Tautan
          </Button>
          <Button size="sm" variant="ghost" icon="phone" onClick={() => addButton("PHONE_NUMBER")}>
            + Telepon
          </Button>
        </div>
      ) : null}

      {/* Status */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 12px" }} />
      <Select
        label="Status (label lokal)"
        value={f.status}
        onChange={(e) => set("status", e.target.value)}
        options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
      />
      <div style={{ fontSize: 11.5, color: theme.yellow, marginTop: -8, marginBottom: 4, lineHeight: 1.5 }}>
        ⚠ Ini hanya <strong>label lokal</strong> — mengubahnya jadi "Disetujui" di sini <strong>tidak</strong> membuat
        Meta menyetujui. Gunakan <strong>Ajukan ke Meta</strong> lalu <strong>Sinkron status Meta</strong> di daftar
        template untuk status yang sebenarnya.
      </div>
    </div>
  );

  const preview = (
    <div>
      <WaPreview tpl={f} />
      <MetaChecklist checks={checks} />
    </div>
  );

  return (
    <Modal title={initial.id ? "Edit Template" : "Buat Template"} onClose={onClose} width={920}>
      {isMobile ? (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => setShowPreview(false)} style={tabBtn(!showPreview)}>
              Form
            </button>
            <button onClick={() => setShowPreview(true)} style={tabBtn(showPreview)}>
              Preview
            </button>
          </div>
          {showPreview ? preview : form}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
          {form}
          <div style={{ position: "sticky", top: 0 }}>{preview}</div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 16,
          borderTop: `1px solid ${theme.border}`,
          paddingTop: 14,
        }}
      >
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button icon="check" onClick={submit} disabled={saving || !f.bodyText.trim() || blocking.length > 0}>
          {saving ? "Menyimpan..." : "Simpan Template"}
        </Button>
      </div>
    </Modal>
  );
}

const miniInput = {
  width: "100%",
  padding: "8px 11px",
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};
const tabBtn = (on) => ({
  flex: 1,
  padding: "9px 0",
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  background: on ? theme.primary : theme.surfaceAlt,
  color: on ? "#fff" : theme.textMuted,
});
