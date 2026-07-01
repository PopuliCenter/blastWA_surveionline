import { useCallback, useMemo, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Input, Textarea, Select, Modal, Notice, Loading, Empty, Toggle, Icon, useLoader, useIsMobile, theme, fmtDate } from "../lib/ui";

// ===== Util =====
// Cari variabel {{n}} di teks, kembalikan jumlah variabel tertinggi (mis. {{1}} {{3}} → 3)
function maxVar(text = "") {
  let max = 0;
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, parseInt(m[1], 10));
  return max;
}
// Ganti {{n}} dengan contoh nilai (atau placeholder bila kosong)
function fillVars(text = "", params = []) {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const v = params[parseInt(n, 10) - 1];
    return v && v.trim() ? v : `[contoh ${n}]`;
  });
}
function normalizeName(name = "") {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing — promosi, undangan, survei" },
  { value: "UTILITY", label: "Utility — notifikasi/transaksi" },
  { value: "AUTHENTICATION", label: "Authentication — kode OTP" },
];
const LANGS = [
  { value: "id", label: "Indonesia (id)" },
  { value: "en_US", label: "English (en_US)" },
];
const HEADER_TYPES = [
  { value: "none", label: "Tanpa header" },
  { value: "text", label: "Teks" },
  { value: "image", label: "Gambar / Foto" },
  { value: "document", label: "Dokumen (PDF dll.)" },
  { value: "video", label: "Video" },
];
const STATUS_TONE = { draft: "default", submitted: "yellow", approved: "green", rejected: "red" };
const STATUS_LABEL = { draft: "Draf", submitted: "Menunggu Meta", approved: "Disetujui", rejected: "Ditolak" };
const USECASE_LABEL = { survei: "Blast Survei", rilis: "Rilis ke Media", acara: "Undangan Acara", lainnya: "Lainnya" };

// ===== Contoh template siap-pakai (bisa diedit sebelum disimpan) =====
const PRESETS = [
  {
    key: "survei",
    title: "Blast Survei",
    desc: "Mengajak responden ikut survei singkat.",
    icon: "survey",
    data: {
      name: "undangan_survei", category: "MARKETING", language: "id", useCase: "survei",
      headerType: "text", headerText: "Undangan Survei", headerMediaUrl: "",
      bodyText: "Halo {{1}}, kami dari {{2}} sedang mengadakan survei singkat (±3 menit). Pendapat Anda sangat berarti bagi kami.\n\nBalas *MULAI* untuk ikut serta, atau abaikan pesan ini bila sedang tidak berkenan.",
      footerText: "Balas BERHENTI untuk tidak menerima pesan lagi.",
      buttons: [{ type: "QUICK_REPLY", text: "Mulai Survei" }, { type: "QUICK_REPLY", text: "Tidak, terima kasih" }],
      sampleParams: ["Bapak/Ibu", "Populi Center"], status: "draft",
    },
  },
  {
    key: "rilis",
    title: "Rilis Survei ke Media",
    desc: "Kirim siaran pers hasil survei + dokumen PDF.",
    icon: "doc",
    data: {
      name: "rilis_hasil_survei", category: "MARKETING", language: "id", useCase: "rilis",
      headerType: "document", headerText: "", headerMediaUrl: "https://contoh.com/rilis-survei.pdf",
      bodyText: "Yth. Rekan Media {{1}},\n\nBersama ini kami sampaikan rilis hasil survei *{{2}}* periode {{3}}. Dokumen lengkap terlampir pada pesan ini.\n\nUntuk wawancara atau konfirmasi data, silakan hubungi narahubung kami.",
      footerText: "Tim Media — Populi Center",
      buttons: [{ type: "URL", text: "Unduh Rilis", url: "https://contoh.com/rilis-survei.pdf" }, { type: "PHONE_NUMBER", text: "Hubungi Narahubung", phone: "+628123456789" }],
      sampleParams: ["Redaksi", "Persepsi Publik terhadap Ekonomi", "Juni 2026"], status: "draft",
    },
  },
  {
    key: "acara",
    title: "Undangan Acara ke Media",
    desc: "Undang media ke konferensi pers/acara + foto.",
    icon: "image",
    data: {
      name: "undangan_acara_media", category: "MARKETING", language: "id", useCase: "acara",
      headerType: "image", headerText: "", headerMediaUrl: "https://contoh.com/undangan-acara.jpg",
      bodyText: "Yth. Rekan Media {{1}},\n\nKami mengundang Anda menghadiri *{{2}}* yang akan diselenggarakan pada:\n🗓️ {{3}}\n📍 {{4}}\n\nMohon konfirmasi kehadiran Anda. Terima kasih.",
      footerText: "Populi Center",
      buttons: [{ type: "QUICK_REPLY", text: "Konfirmasi Hadir" }, { type: "URL", text: "Detail Acara", url: "https://contoh.com/acara" }],
      sampleParams: ["Redaksi", "Konferensi Pers Hasil Survei Nasional", "Jumat, 10 Juli 2026 • 10.00 WIB", "Kantor Populi Center, Jakarta"], status: "draft",
    },
  },
];

const blankTemplate = () => ({ name: "", category: "MARKETING", language: "id", useCase: "lainnya", headerType: "none", headerText: "", headerMediaUrl: "", bodyText: "", footerText: "", buttons: [], sampleParams: [], status: "draft" });

export default function Templates() {
  const tpls = useLoader(useCallback(() => api.listTemplates(), []));
  const [editing, setEditing] = useState(null); // objek template yg diedit/dibuat
  const [presetOpen, setPresetOpen] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const isMobile = useIsMobile();

  const run = async (fn) => { setErr(""); try { await fn(); await tpls.reload(); } catch (e) { setErr(e.message); } };

  const submitToMeta = async (t) => {
    if (!window.confirm(`Ajukan template "${t.name}" (${t.language}) ke Meta untuk direview?`)) return;
    setBusyId(t.id); setErr(""); setNote("");
    try {
      const r = await api.submitTemplate(t.id);
      setNote(`Template "${t.name}" diajukan ke Meta (status: ${r.status}). Tunggu review Meta (menit–jam), lalu klik "Sinkron status Meta".`);
      await tpls.reload();
    } catch (e) { setErr(e.message); } finally { setBusyId(""); }
  };

  const syncStatus = async () => {
    setSyncing(true); setErr(""); setNote("");
    try {
      const r = await api.syncTemplates();
      setNote(`Sinkron selesai: ${r.updated} status diperbarui dari Meta, ${r.notFound} belum ada di Meta (total ${r.remoteCount} template di Meta).`);
      await tpls.reload();
    } catch (e) { setErr(e.message); } finally { setSyncing(false); }
  };

  const save = async (data) => {
    const payload = { ...data, buttons: data.buttons || [], sampleParams: data.sampleParams || [] };
    if (data.id) await api.updateTemplate(data.id, payload);
    else await api.createTemplate(payload);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader title="Template Pesan" subtitle="Buat & kelola template WhatsApp untuk broadcast. Template wajib disetujui Meta sebelum dipakai." actions={[
        <Button key="s" variant="secondary" icon="refresh" onClick={syncStatus} disabled={syncing}>{syncing ? "Sinkron…" : "Sinkron status Meta"}</Button>,
        <Button key="p" variant="secondary" icon="sparkle" onClick={() => setPresetOpen(true)}>Pakai Contoh</Button>,
        <Button key="n" icon="plus" onClick={() => setEditing(blankTemplate())}>Buat Template</Button>,
      ]} />

      <Notice>{err || tpls.error}</Notice>
      <Notice kind="success">{note}</Notice>

      <Card style={{ marginBottom: 16 }} pad={16}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: theme.primarySoft, color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="template" size={18} /></span>
          <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: theme.text }}>Cara kerja:</strong> susun template di sini → klik <strong>Ajukan ke Meta</strong> (kirim untuk direview) → tunggu → klik <strong>Sinkron status Meta</strong> agar status berubah <strong>Disetujui</strong> secara otomatis → baru bisa dipilih di Blast.
            <div style={{ marginTop: 5, color: theme.yellow }}>⚠ Status pada kartu adalah <strong>label lokal</strong>. Yang menentukan bisa/tidaknya dipakai broadcast adalah status ASLI di Meta — pastikan lewat <strong>Ajukan → Sinkron</strong> (atau lihat di Broadcast → "Ambil dari Meta"). Butuh <strong>WABA ID</strong> terisi di Akun WhatsApp.</div>
          </div>
        </div>
      </Card>

      {tpls.loading ? <Loading /> : (tpls.data || []).length ? (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
          {(tpls.data || []).map((t) => <TemplateCard key={t.id} t={t} onEdit={() => setEditing(t)} onDelete={() => run(() => api.deleteTemplate(t.id))} onDuplicate={() => setEditing({ ...t, id: undefined, name: `${t.name}_copy`, status: "draft" })} onSubmit={() => submitToMeta(t)} submitting={busyId === t.id} />)}
        </div>
      ) : <Card><Empty icon="template" title="Belum ada template" note="Klik 'Pakai Contoh' untuk mulai dari template siap-pakai." /></Card>}

      {presetOpen ? <PresetPicker onClose={() => setPresetOpen(false)} onPick={(d) => { setPresetOpen(false); setEditing({ ...d }); }} /> : null}
      {editing ? <TemplateEditor initial={editing} onClose={() => setEditing(null)} onSave={save} /> : null}
    </div>
  );
}

function TemplateCard({ t, onEdit, onDelete, onDuplicate, onSubmit, submitting }) {
  const headerIcon = { image: "image", document: "doc", video: "eye", text: "template" }[t.headerType];
  return (
    <Card pad={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: theme.text, fontSize: 14.5, fontFamily: "monospace", wordBreak: "break-all" }}>{t.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
            <Badge tone="blue">{t.category}</Badge>
            <Badge tone="purple">{t.language}</Badge>
            {t.useCase ? <Badge>{USECASE_LABEL[t.useCase] || t.useCase}</Badge> : null}
          </div>
        </div>
        <Badge tone={STATUS_TONE[t.status] || "default"}>{STATUS_LABEL[t.status] || t.status}</Badge>
      </div>

      {t.headerType !== "none" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12, color: theme.textMuted }}>
          <Icon name={headerIcon} size={15} />
          <span>Header: {t.headerType === "text" ? `"${t.headerText || ""}"` : HEADER_TYPES.find((h) => h.value === t.headerType)?.label}</span>
        </div>
      ) : null}

      <div style={{ marginTop: 10, background: theme.surfaceAlt, borderRadius: 9, padding: 11, fontSize: 12.5, color: theme.text, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 96, overflow: "hidden" }}>
        {fillVars(t.bodyText, t.sampleParams)}
      </div>

      {(t.buttons || []).length ? <div style={{ marginTop: 8, fontSize: 11.5, color: theme.textMuted }}>{t.buttons.length} tombol</div> : null}

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {t.status !== "approved" && t.status !== "submitted" ? <Button size="sm" icon="send" onClick={onSubmit} disabled={submitting}>{submitting ? "Mengajukan…" : "Ajukan ke Meta"}</Button> : null}
        {t.status === "submitted" ? <Badge tone="yellow">menunggu review Meta</Badge> : null}
        <Button size="sm" variant="secondary" icon="edit" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={onDuplicate}>Duplikat</Button>
        <Button size="sm" variant="danger" icon="trash" onClick={onDelete}>Hapus</Button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>Diubah {fmtDate(t.updatedAt)}</div>
    </Card>
  );
}

function PresetPicker({ onClose, onPick }) {
  return (
    <Modal title="Pilih Contoh Template" onClose={onClose} width={560}>
      <p style={{ marginTop: 0, color: theme.textMuted, fontSize: 13 }}>Pilih sesuai kebutuhan. Isinya bisa Anda edit sebelum disimpan.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => onPick(p.data)} style={{ display: "flex", gap: 13, alignItems: "center", textAlign: "left", padding: 14, border: `1px solid ${theme.border}`, borderRadius: 11, background: theme.surface, cursor: "pointer" }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: theme.primarySoft, color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={p.icon} size={20} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, color: theme.text, fontSize: 14 }}>{p.title}</span>
              <span style={{ display: "block", color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{p.desc}</span>
            </span>
            <Icon name="back" size={18} style={{ transform: "rotate(180deg)" }} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ===== Editor =====
function TemplateEditor({ initial, onClose, onSave }) {
  const [f, setF] = useState({ ...blankTemplate(), ...initial, buttons: initial.buttons || [], sampleParams: initial.sampleParams || [] });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const isMobile = useIsMobile();
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const nVars = Math.max(maxVar(f.bodyText), maxVar(f.headerType === "text" ? f.headerText || "" : ""));
  const checks = useMemo(() => metaChecks(f, nVars), [f, nVars]);
  const blocking = checks.filter((c) => c.level === "error" && !c.ok);

  const setSample = (i, v) => { const arr = [...(f.sampleParams || [])]; arr[i] = v; set("sampleParams", arr); };
  const addVar = () => set("bodyText", `${f.bodyText}{{${nVars + 1}}}`);

  const addButton = (type) => {
    if ((f.buttons || []).length >= 3) return;
    const base = { type, text: type === "URL" ? "Buka Tautan" : type === "PHONE_NUMBER" ? "Telepon" : "Balas" };
    set("buttons", [...(f.buttons || []), type === "URL" ? { ...base, url: "https://" } : type === "PHONE_NUMBER" ? { ...base, phone: "+62" } : base]);
  };
  const setButton = (i, k, v) => { const arr = [...f.buttons]; arr[i] = { ...arr[i], [k]: v }; set("buttons", arr); };
  const delButton = (i) => set("buttons", f.buttons.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSaving(true);
    try { await onSave({ ...f, name: normalizeName(f.name) || "template" }); }
    finally { setSaving(false); }
  };

  const form = (
    <div>
      <Input label="Nama Template" value={f.name} onChange={(e) => set("name", e.target.value)} hint={`Disimpan sebagai: ${normalizeName(f.name) || "—"} (huruf kecil & underscore, sesuai aturan Meta)`} placeholder="undangan_survei" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Select label="Kategori" value={f.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES} />
        <Select label="Bahasa" value={f.language} onChange={(e) => set("language", e.target.value)} options={LANGS} />
      </div>
      <Select label="Untuk kebutuhan" value={f.useCase} onChange={(e) => set("useCase", e.target.value)} options={Object.entries(USECASE_LABEL).map(([value, label]) => ({ value, label }))} />

      {/* Header */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 14px" }} />
      <Select label="Header (opsional)" value={f.headerType} onChange={(e) => set("headerType", e.target.value)} options={HEADER_TYPES} />
      {f.headerType === "text" ? (
        <Input label="Teks Header" value={f.headerText} onChange={(e) => set("headerText", e.target.value)} hint="Maks. 60 karakter. Boleh 1 variabel." maxLength={60} />
      ) : null}
      {["image", "document", "video"].includes(f.headerType) ? (
        <Input label={`Contoh URL ${f.headerType === "image" ? "gambar" : f.headerType === "document" ? "dokumen (PDF)" : "video"}`} value={f.headerMediaUrl} onChange={(e) => set("headerMediaUrl", e.target.value)} hint="Dipakai sebagai contoh saat pengajuan ke Meta & untuk preview. Saat blast, file aktual dilampirkan per pengiriman." placeholder="https://..." />
      ) : null}

      {/* Body */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 14px" }} />
      <Textarea label="Isi Pesan (body)" value={f.bodyText} onChange={(e) => set("bodyText", e.target.value)} hint="Format: *tebal*, _miring_. Variabel: {{1}}, {{2}}. Maks. 1024 karakter." style={{ minHeight: 120 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -6, marginBottom: 12 }}>
        <Button size="sm" variant="secondary" icon="plus" onClick={addVar}>Sisipkan {`{{${nVars + 1}}}`}</Button>
        <span style={{ fontSize: 12, color: theme.textMuted, alignSelf: "center" }}>{nVars} variabel terdeteksi</span>
      </div>

      {/* Contoh nilai variabel */}
      {nVars > 0 ? (
        <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: "12px 12px 2px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Contoh nilai variabel (untuk preview & approval)</div>
          {Array.from({ length: nVars }).map((_, i) => (
            <Input key={i} label={`Contoh untuk {{${i + 1}}}`} value={f.sampleParams[i] || ""} onChange={(e) => setSample(i, e.target.value)} placeholder={`nilai contoh {{${i + 1}}}`} />
          ))}
        </div>
      ) : null}

      <Input label="Footer (opsional)" value={f.footerText} onChange={(e) => set("footerText", e.target.value)} hint="Teks statis kecil di bawah pesan. Maks. 60 karakter, tidak boleh ada variabel." maxLength={60} />

      {/* Tombol */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 12px" }} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Tombol (opsional, maks. 3)</div>
      {(f.buttons || []).map((b, i) => (
        <div key={i} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Badge tone="blue">{b.type === "QUICK_REPLY" ? "Balasan Cepat" : b.type === "URL" ? "Tautan" : "Telepon"}</Badge>
            <button onClick={() => delButton(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.red, display: "flex" }}><Icon name="trash" size={15} /></button>
          </div>
          <input value={b.text} onChange={(e) => setButton(i, "text", e.target.value)} placeholder="Teks tombol" maxLength={25} style={miniInput} />
          {b.type === "URL" ? <input value={b.url || ""} onChange={(e) => setButton(i, "url", e.target.value)} placeholder="https://..." style={{ ...miniInput, marginTop: 6 }} /> : null}
          {b.type === "PHONE_NUMBER" ? <input value={b.phone || ""} onChange={(e) => setButton(i, "phone", e.target.value)} placeholder="+628123456789" style={{ ...miniInput, marginTop: 6 }} /> : null}
        </div>
      ))}
      {(f.buttons || []).length < 3 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <Button size="sm" variant="ghost" icon="autoreply" onClick={() => addButton("QUICK_REPLY")}>+ Balasan Cepat</Button>
          <Button size="sm" variant="ghost" icon="link" onClick={() => addButton("URL")}>+ Tautan</Button>
          <Button size="sm" variant="ghost" icon="phone" onClick={() => addButton("PHONE_NUMBER")}>+ Telepon</Button>
        </div>
      ) : null}

      {/* Status */}
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "6px 0 12px" }} />
      <Select label="Status (label lokal)" value={f.status} onChange={(e) => set("status", e.target.value)} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
      <div style={{ fontSize: 11.5, color: theme.yellow, marginTop: -8, marginBottom: 4, lineHeight: 1.5 }}>⚠ Ini hanya <strong>label lokal</strong> — mengubahnya jadi "Disetujui" di sini <strong>tidak</strong> membuat Meta menyetujui. Gunakan <strong>Ajukan ke Meta</strong> lalu <strong>Sinkron status Meta</strong> di daftar template untuk status yang sebenarnya.</div>
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
            <button onClick={() => setShowPreview(false)} style={tabBtn(!showPreview)}>Form</button>
            <button onClick={() => setShowPreview(true)} style={tabBtn(showPreview)}>Preview</button>
          </div>
          {showPreview ? preview : form}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
          {form}
          <div style={{ position: "sticky", top: 0 }}>{preview}</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button icon="check" onClick={submit} disabled={saving || !f.bodyText.trim() || blocking.length > 0}>{saving ? "Menyimpan..." : "Simpan Template"}</Button>
      </div>
    </Modal>
  );
}

const miniInput = { width: "100%", padding: "8px 11px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none" };
const tabBtn = (on) => ({ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: on ? theme.primary : theme.surfaceAlt, color: on ? "#fff" : theme.textMuted });

// ===== Preview gaya WhatsApp =====
function WaText({ text }) {
  return text.split("\n").map((line, li) => (
    <span key={li}>{li > 0 && <br />}{line.split(/(\*[^*]+\*|_[^_]+_)/).map((p, pi) => {
      if (p.startsWith("*") && p.endsWith("*")) return <strong key={pi}>{p.slice(1, -1)}</strong>;
      if (p.startsWith("_") && p.endsWith("_")) return <em key={pi} style={{ color: "#555" }}>{p.slice(1, -1)}</em>;
      return p;
    })}</span>
  ));
}

function WaPreview({ tpl }) {
  const body = fillVars(tpl.bodyText || "", tpl.sampleParams);
  const header = tpl.headerType === "text" ? fillVars(tpl.headerText || "", tpl.sampleParams) : "";
  const mediaLabel = { image: "🖼️ Gambar / Foto", document: "📄 Dokumen (PDF)", video: "🎬 Video" }[tpl.headerType];
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>Pratinjau WhatsApp</div>
      <div style={{ background: "#ECE5DD", borderRadius: 12, padding: 14, minHeight: 120 }}>
        <div style={{ background: "#fff", borderRadius: "2px 12px 12px 12px", boxShadow: "0 1px 2px rgba(0,0,0,.15)", overflow: "hidden", fontSize: 13.5, lineHeight: 1.5, color: "#111" }}>
          {mediaLabel ? (
            <div style={{ background: "#dfe7e2", color: "#4a5a52", padding: "22px 12px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>{mediaLabel}</div>
          ) : null}
          <div style={{ padding: "9px 12px 10px" }}>
            {header ? <div style={{ fontWeight: 700, marginBottom: 5 }}>{header}</div> : null}
            <div><WaText text={body || "(isi pesan kosong)"} /></div>
            {tpl.footerText ? <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 7 }}>{tpl.footerText}</div> : null}
          </div>
          {(tpl.buttons || []).length ? (
            <div style={{ borderTop: "1px solid #eee" }}>
              {tpl.buttons.map((b, i) => (
                <div key={i} style={{ borderTop: i ? "1px solid #eee" : "none", color: "#1ca0e3", textAlign: "center", padding: "9px 6px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon name={b.type === "URL" ? "link" : b.type === "PHONE_NUMBER" ? "phone" : "autoreply"} size={14} />
                  {b.text || "(tombol)"}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ===== Cek kesiapan untuk disetujui Meta (heuristik) =====
function metaChecks(f, nVars) {
  const out = [];
  const body = f.bodyText || "";
  const add = (level, ok, text) => out.push({ level, ok, text });

  add("error", !!body.trim(), "Isi pesan tidak boleh kosong");
  add("error", normalizeName(f.name).length > 0, "Nama template wajib diisi");
  add("warn", body.length <= 1024, "Isi pesan ≤ 1024 karakter");
  add("warn", (f.headerText || "").length <= 60, "Header teks ≤ 60 karakter");
  add("warn", (f.footerText || "").length <= 60, "Footer ≤ 60 karakter");

  // variabel berurutan 1..n & ada contohnya
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10));
  const seqOk = nVars === 0 || (Math.max(...nums, 0) === nVars && new Set(nums).size === nVars && !nums.includes(0));
  add("error", seqOk, "Variabel berurutan mulai {{1}} tanpa lompatan");
  const filled = Array.from({ length: nVars }).every((_, i) => (f.sampleParams[i] || "").trim());
  if (nVars > 0) add("warn", filled, "Semua variabel punya contoh nilai");

  // variabel tidak di awal/akhir body
  const trimmed = body.trim();
  const edgeVar = /^\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}$/.test(trimmed);
  add("warn", !edgeVar, "Variabel tidak di paling awal/akhir pesan");

  // media header butuh contoh
  if (["image", "document", "video"].includes(f.headerType)) add("warn", !!(f.headerMediaUrl || "").trim(), "Header media punya contoh URL");

  // footer tidak boleh ada variabel
  add("warn", !/\{\{\d+\}\}/.test(f.footerText || ""), "Footer tanpa variabel");

  // tombol URL/telepon valid
  for (const b of f.buttons || []) {
    if (b.type === "URL") add("warn", /^https?:\/\/.+/.test(b.url || ""), `Tombol "${b.text}" punya URL valid`);
    if (b.type === "PHONE_NUMBER") add("warn", /^\+?\d{6,}/.test(b.phone || ""), `Tombol "${b.text}" punya nomor valid`);
  }

  // kategori vs OTP
  if (f.category === "AUTHENTICATION") add("warn", /kode|otp|verif/i.test(body), "Kategori Authentication khusus kode/OTP");
  return out;
}

function MetaChecklist({ checks }) {
  const errors = checks.filter((c) => c.level === "error" && !c.ok);
  const warns = checks.filter((c) => c.level === "warn" && !c.ok);
  const allOk = errors.length === 0 && warns.length === 0;
  return (
    <div style={{ marginTop: 14, border: `1px solid ${theme.border}`, borderRadius: 11, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <Icon name="check" size={16} />
        <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>Kesiapan lolos Meta</span>
        {allOk ? <Badge tone="green">Siap</Badge> : errors.length ? <Badge tone="red">{errors.length} wajib</Badge> : <Badge tone="yellow">{warns.length} saran</Badge>}
      </div>
      {allOk ? (
        <div style={{ fontSize: 12.5, color: theme.green }}>✓ Semua syarat dasar terpenuhi. Tetap ikuti kebijakan Meta saat pengajuan.</div>
      ) : (
        <div style={{ display: "grid", gap: 5 }}>
          {errors.map((c, i) => <div key={`e${i}`} style={{ fontSize: 12.5, color: theme.red }}>✕ {c.text}</div>)}
          {warns.map((c, i) => <div key={`w${i}`} style={{ fontSize: 12.5, color: theme.yellow }}>⚠ {c.text}</div>)}
        </div>
      )}
    </div>
  );
}
