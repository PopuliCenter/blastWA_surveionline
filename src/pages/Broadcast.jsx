import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, StatCard, Input, Textarea, Select, Modal, Notice, Loading, Empty, Tabs, useLoader, useSelection, Checkbox, BulkBar, theme, fmtDate, Icon } from "../lib/ui";
import { ContactImporter } from "../lib/contactImport";
import { TopUpGuide } from "../lib/topup";

export default function Broadcast() {
  const blasts = useLoader(useCallback(() => api.listBlasts(), []));
  const segments = useLoader(useCallback(() => api.listSegments(), []));
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const templates = useLoader(useCallback(() => api.listTemplates(), []));
  const [tab, setTab] = useState("blasts");
  const [showBlast, setShowBlast] = useState(false);
  const [showSeg, setShowSeg] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [reportBlast, setReportBlast] = useState(null);
  const [addSeg, setAddSeg] = useState(null);
  const selBlast = useSelection();
  const selSeg = useSelection();
  const [bulkBusy, setBulkBusy] = useState(false);
  const blastList = blasts.data || [];
  const segList = segments.data || [];

  const run = async (fn, reloaders = []) => { setErr(""); try { await fn(); await Promise.all(reloaders.map((r) => r())); } catch (e) { setErr(e.message); } };

  const renameSeg = async (s) => {
    const name = window.prompt("Nama baru segmen:", s.name);
    if (name && name.trim() && name.trim() !== s.name) await run(() => api.renameSegment(s.id, name.trim()), [segments.reload]);
  };

  const bulkDel = async (which) => {
    const s = which === "blasts" ? selBlast : selSeg;
    if (!s.size || !window.confirm(`Hapus ${s.size} ${which === "blasts" ? "blast" : "segmen"} terpilih? Tindakan ini permanen.`)) return;
    setBulkBusy(true); setErr("");
    try {
      if (which === "blasts") { await api.bulkDeleteBlasts(s.list()); await blasts.reload(); }
      else { await api.bulkDeleteSegments(s.list()); await segments.reload(); }
      s.clear();
    } catch (e) { setErr(e.message); } finally { setBulkBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="Kirim pesan/survei ke segmen kontak." actions={[
        <Button key="r" variant="ghost" icon="refresh" onClick={() => { blasts.reload(); segments.reload(); }}>Refresh</Button>,
        <Button key="s" variant="secondary" icon="plus" onClick={() => setShowSeg(true)}>Segmen</Button>,
        <Button key="b" icon="broadcast" onClick={() => setShowBlast(true)}>Buat Blast</Button>,
      ]} />
      <Notice>{err || blasts.error || segments.error}</Notice>
      <Notice kind="success">{note}</Notice>
      <Tabs active={tab} onChange={setTab} style={{ marginBottom: 16 }} tabs={[{ id: "blasts", label: "Riwayat Blast" }, { id: "segments", label: "Segmen" }, { id: "cost", label: "Simulasi Biaya" }]} />

      {tab === "cost" ? (
        <CostSimulator segments={segments.data || []} />
      ) : tab === "blasts" ? (
        blasts.loading ? <Loading /> : blastList.length ? (
          <>
          <BulkBar count={selBlast.size} total={blastList.length} allSelected={blastList.every((b) => selBlast.has(b.id))} noun="blast" busy={bulkBusy}
            onToggleAll={() => blastList.every((b) => selBlast.has(b.id)) ? selBlast.clear() : selBlast.setAll(blastList.map((b) => b.id))}
            onClear={selBlast.clear} onDelete={() => bulkDel("blasts")} />
          <div style={{ display: "grid", gap: 14 }}>
            {blastList.map((b) => (
              <Card key={b.id} style={selBlast.has(b.id) ? { outline: `2px solid ${theme.primary}` } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ paddingTop: 2 }}><Checkbox checked={selBlast.has(b.id)} onChange={() => selBlast.toggle(b.id)} /></div>
                    <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{b.surveyTitle}</div>
                    <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{b.segmentName} • vendor {b.vendor} • template {b.message || "-"} • {fmtDate(b.sentAt)}</div>
                    </div>
                  </div>
                  <Badge tone={b.status === "completed" ? "green" : b.status === "failed" ? "red" : b.status === "scheduled" ? "yellow" : "blue"}>{b.status}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginTop: 14 }}>
                  <StatCard label="Sent" value={b.sent} tone="blue" />
                  <StatCard label="Delivered" value={b.delivered} tone="green" />
                  <StatCard label="Dibaca" value={b.opened} tone="purple" />
                  <StatCard label="Gagal" value={b.failed} tone="yellow" />
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="secondary" size="sm" icon="report" onClick={() => setReportBlast(b)}>Laporan</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteBlast(b.id), [blasts.reload])}>Hapus</Button>
                </div>
              </Card>
            ))}
          </div>
          </>
        ) : <Card><Empty icon="broadcast" title="Belum ada blast" /></Card>
      ) : (
        segments.loading ? <Loading /> : segList.length ? (
          <>
          <BulkBar count={selSeg.size} total={segList.length} allSelected={segList.every((s) => selSeg.has(s.id))} noun="segmen" busy={bulkBusy}
            onToggleAll={() => segList.every((s) => selSeg.has(s.id)) ? selSeg.clear() : selSeg.setAll(segList.map((s) => s.id))}
            onClear={selSeg.clear} onDelete={() => bulkDel("segments")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {segList.map((s) => (
              <Card key={s.id} style={selSeg.has(s.id) ? { outline: `2px solid ${theme.primary}` } : undefined}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Checkbox checked={selSeg.has(s.id)} onChange={() => selSeg.toggle(s.id)} />
                  <div style={{ fontWeight: 700, color: theme.text }}>{s.name}</div>
                </div>
                <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{s.contacts.length} kontak</div>
                <div style={{ marginTop: 10, background: theme.surfaceAlt, borderRadius: 9, padding: 10, fontSize: 12, color: theme.textMuted }}>{s.contacts.slice(0, 5).join(", ")}{s.contacts.length > 5 ? "…" : ""}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => setAddSeg(s)}>Tambah Kontak</Button>
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => renameSeg(s)}>Ganti Nama</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => run(() => api.deleteSegment(s.id), [segments.reload])}>Hapus</Button>
                </div>
              </Card>
            ))}
          </div>
          </>
        ) : <Card><Empty icon="contacts" title="Belum ada segmen" /></Card>
      )}

      {showBlast ? <BlastModal surveys={surveys.data || []} segments={segments.data || []} templates={templates.data || []} onClose={() => setShowBlast(false)} onSave={(d) => run(async () => { setNote(""); const r = await api.createBlast(d); setNote(r?.excludedOptOut ? `Blast dibuat. ${r.excludedOptOut} kontak opt-out otomatis dikecualikan.` : "Blast dibuat & sedang dikirim."); }, [blasts.reload]).then(() => setShowBlast(false))} /> : null}
      {showSeg ? <SegmentModal onClose={() => setShowSeg(false)} onSave={(d) => run(() => api.createSegment(d), [segments.reload]).then(() => setShowSeg(false))} /> : null}
      {addSeg ? <AddContactsModal segment={addSeg} onClose={() => setAddSeg(null)} onDone={() => { setAddSeg(null); segments.reload(); }} /> : null}
      {reportBlast ? <BlastReportModal blast={reportBlast} onClose={() => setReportBlast(null)} /> : null}
    </div>
  );
}

// Tambah kontak ke segmen yang sudah ada (upload file / tempel nomor).
function AddContactsModal({ segment, onClose, onDone }) {
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const submit = async () => {
    setSaving(true); setErr("");
    try {
      const r = await api.addSegmentContacts(segment.id, contacts);
      setResult(r); // { added, skipped, total }
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Tambah Kontak — ${segment.name}`} onClose={onClose} width={540}>
      <Notice>{err}</Notice>
      {result ? (
        <div>
          <div style={{ background: theme.greenSoft, color: theme.green, borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
            ✓ {result.added} kontak ditambahkan{result.skipped ? `, ${result.skipped} dilewati (duplikat/invalid)` : ""}. Total segmen sekarang: <strong>{result.total}</strong>.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><Button onClick={onDone}>Selesai</Button></div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 10 }}>Nomor yang sudah ada di segmen ini otomatis dilewati (tidak dobel).</div>
          <ContactImporter onContacts={setContacts} />
          <div style={{ color: theme.textMuted, fontSize: 12.5, margin: "6px 0 14px" }}>{contacts.length} kontak akan ditambahkan (nomor dinormalisasi ke 62…).</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={submit} disabled={!contacts.length || saving}>{saving ? "Menambahkan..." : `Tambahkan (${contacts.length})`}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Laporan rinci 1 blast: total penerima, rincian status, daftar nomor gagal + ekspor.
function BlastReportModal({ blast, onClose }) {
  const { data, loading, error } = useLoader(useCallback(() => api.blastReport(blast.id), [blast.id]));
  const t = data?.totals;
  const pct = (n) => (t?.recipients ? Math.round((n / t.recipients) * 100) : 0);

  const exportFailed = () => {
    const rows = (data?.failed || []).map((f) => ({ Nomor: f.phone, Nama: f.name || "", Alasan: f.error, Waktu: f.updatedAt }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nomor: "", Nama: "", Alasan: "(tidak ada yang gagal)", Waktu: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gagal");
    XLSX.writeFile(wb, `laporan-blast-${blast.id.slice(0, 8)}-gagal.xlsx`);
  };

  const Stat = ({ label, value, tone }) => (
    <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone }}>{value ?? 0}</div>
      <div style={{ fontSize: 11.5, color: theme.textMuted }}>{label}</div>
    </div>
  );

  return (
    <Modal title="Laporan Blast" onClose={onClose} width={620}>
      <Notice>{error}</Notice>
      {loading ? <Loading /> : data ? (
        <div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 14 }}>
            {data.surveyTitle ? <span><strong style={{ color: theme.text }}>{data.surveyTitle}</strong> • </span> : null}
            Segmen {data.segmentName || "-"} • vendor {data.vendor} • status {data.status} • {fmtDate(data.createdAt)}
            {data.messageText ? <div style={{ marginTop: 6, background: theme.surfaceAlt, borderRadius: 8, padding: "8px 11px" }}>{data.messageText}</div> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 10, marginBottom: 6 }}>
            <Stat label="Total penerima" value={t.recipients} tone={theme.text} />
            <Stat label="Terkirim" value={t.sent} tone={theme.primary} />
            <Stat label="Sampai" value={t.delivered} tone={theme.green} />
            <Stat label="Dibaca" value={t.read} tone={theme.purple} />
            <Stat label="Gagal" value={t.failed} tone={theme.red} />
            <Stat label="Antri" value={t.queued} tone={theme.yellow} />
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
            Sampai {pct(t.delivered)}% • Dibaca {pct(t.read)}% • Gagal {pct(t.failed)}% dari total penerima.
          </div>

          {data.vendor === "baileys" ? (
            <div style={{ fontSize: 12, color: theme.yellow, background: theme.yellowSoft, borderRadius: 8, padding: "8px 11px", marginBottom: 14 }}>
              Catatan: status "Sampai/Dibaca" untuk WhatsApp Langsung bergantung pada tanda terima yang dikirim WhatsApp; bisa terlambat atau tidak muncul untuk sebagian penerima.
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>Nomor gagal ({data.failed.length})</span>
            <Button variant="secondary" size="sm" icon="download" onClick={exportFailed} disabled={!data.failed.length}>Ekspor Excel</Button>
          </div>
          {data.failed.length ? (
            <div style={{ maxHeight: 240, overflow: "auto", border: `1px solid ${theme.border}`, borderRadius: 9 }}>
              {data.failed.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 11px", borderTop: i ? `1px solid ${theme.border}` : "none", fontSize: 12.5 }}>
                  <span style={{ color: theme.text, fontWeight: 600, fontFamily: "monospace" }}>{f.phone}{f.name ? ` · ${f.name}` : ""}</span>
                  <span style={{ color: theme.red, textAlign: "right", maxWidth: "60%" }}>{f.error}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ color: theme.textMuted, fontSize: 12.5 }}>Tidak ada penerima yang gagal. 🎉</div>}
        </div>
      ) : null}
    </Modal>
  );
}

function BlastModal({ surveys, segments, templates, onClose, onSave }) {
  const [f, setF] = useState({ surveyId: "", segmentId: segments[0]?.id || "", vendor: "meta", templateId: "", templateName: "", templateLang: "en_US", bodyParams: "", messageText: "", schedule: "" });
  const [saving, setSaving] = useState(false);
  const [rates] = useState(loadRates);
  const set = (k, v) => setF({ ...f, [k]: v });

  const pickTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) { setF({ ...f, templateId: "", templateName: "", bodyParams: "" }); return; }
    const preview = (t.bodyText || "").replace(/\{\{(\d+)\}\}/g, (_, n) => t.sampleParams?.[+n - 1] || `{{${n}}}`);
    setF({ ...f, templateId: id, templateName: t.name, templateLang: t.language || "id", bodyParams: (t.sampleParams || []).join(", "), messageText: preview });
  };
  const selectedTpl = templates.find((x) => x.id === f.templateId);
  const selSurvey = surveys.find((s) => s.id === f.surveyId);
  const isBaileys = f.vendor === "baileys"; // jalur tidak resmi: kirim teks langsung, tanpa template

  // Perkiraan biaya = jumlah kontak segmen × tarif kategori template (atau asumsi Marketing)
  const seg = segments.find((s) => s.id === f.segmentId);
  const recipients = seg?.contacts.length || 0;
  const catKey = (selectedTpl?.category || "MARKETING").toLowerCase();
  const estRate = rates[catKey] || 0;
  const estTotal = recipients * estRate;

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ surveyId: f.surveyId || undefined, segmentId: f.segmentId, vendor: f.vendor, templateName: isBaileys ? undefined : f.templateName.trim(), templateLang: f.templateLang, messageText: f.messageText, bodyParams: f.bodyParams.trim() ? f.bodyParams.split(",").map((s) => s.trim()) : undefined, scheduledAt: f.schedule || undefined });
    } finally { setSaving(false); }
  };
  return (
    <Modal title="Buat Blast" onClose={onClose}>
      <Select label="Survei (opsional)" value={f.surveyId} onChange={(e) => set("surveyId", e.target.value)} options={[{ value: "", label: "— tanpa survei —" }, ...surveys.map((s) => ({ value: s.id, label: `${s.title}${s.mode === "flow" ? " (Flow)" : ""}` }))]} />
      {selSurvey?.mode === "flow" ? <Notice kind="info">Survei <strong>Flow</strong>: pakai template yang punya <strong>tombol Flow</strong> (terhubung ke Flow ID survei ini di Meta). Jawaban responden tertangkap otomatis tanpa tanya-jawab per pesan.</Notice> : null}
      <Select label="Segmen" value={f.segmentId} onChange={(e) => set("segmentId", e.target.value)} options={segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length})` }))} />
      <Select label="Vendor" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} options={[{ value: "meta", label: "Meta Cloud API" }, { value: "qontak", label: "Qontak" }, { value: "baileys", label: "WhatsApp Langsung (QR) — tanpa template" }]} />
      {isBaileys ? (
        <>
          <Notice kind="info">Jalur <strong>tidak resmi</strong> (scan QR). Pesan teks dikirim langsung tanpa template/approval. ⚠ Ada risiko nomor diblokir — pakai volume kecil & nomor non-kritis. Pastikan sudah <strong>Terhubung</strong> di menu Akun WhatsApp.</Notice>
          <Input label="Parameter (pisah koma, opsional)" value={f.bodyParams} onChange={(e) => set("bodyParams", e.target.value)} hint="nilai untuk {{1}}, {{2}}, … di dalam pesan — kosongkan bila tak pakai variabel" />
          <Textarea label="Isi Pesan" value={f.messageText} onChange={(e) => set("messageText", e.target.value)} hint="Teks yang dikirim apa adanya. Boleh pakai {{1}} untuk personalisasi (mis. nama)." />
        </>
      ) : (
        <>
          <Select label="Template Tersimpan" value={f.templateId} onChange={(e) => pickTemplate(e.target.value)} options={[{ value: "", label: "— ketik manual —" }, ...templates.map((t) => ({ value: t.id, label: `${t.name} (${t.status === "approved" ? "disetujui" : t.status})` }))]} />
          {selectedTpl && selectedTpl.status !== "approved" ? <Notice kind="info">Template ini berstatus <strong>{selectedTpl.status}</strong>. Pastikan sudah disetujui Meta sebelum benar-benar dikirim.</Notice> : null}
          <Input label="Nama / ID Template" value={f.templateName} onChange={(e) => set("templateName", e.target.value)} hint="Terisi otomatis bila memilih template tersimpan. Manual: hello_world (Meta) / Template ID (Qontak)" />
          <Input label="Bahasa Template" value={f.templateLang} onChange={(e) => set("templateLang", e.target.value)} hint="id / en_US" />
          <Input label="Parameter (pisah koma, opsional)" value={f.bodyParams} onChange={(e) => set("bodyParams", e.target.value)} hint="nilai untuk {{1}}, {{2}}, … — kosongkan bila template tanpa variabel" />
          <Textarea label="Preview Pesan (audit)" value={f.messageText} onChange={(e) => set("messageText", e.target.value)} />
        </>
      )}
      <Input label="Jadwal (opsional)" type="datetime-local" value={f.schedule} onChange={(e) => set("schedule", e.target.value)} />

      {recipients > 0 ? (
        <div style={{ background: theme.primarySoft, borderRadius: 10, padding: "11px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>Perkiraan biaya <span style={{ textTransform: "capitalize", color: theme.primary, fontWeight: 600 }}>{catKey}</span>{!selectedTpl ? " (asumsi)" : ""}<br />{recipients.toLocaleString("id-ID")} penerima × {rupiah(estRate)}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: theme.primary }}>{rupiah(estTotal)}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button icon="send" onClick={submit} disabled={!f.segmentId || (isBaileys ? !f.messageText.trim() : !f.templateName.trim()) || saving}>{saving ? "Mengirim..." : "Kirim Blast"}</Button>
      </div>
    </Modal>
  );
}

// Simulasi biaya kirim (perkiraan). Tarif per pesan bisa diedit & disimpan (localStorage),
// karena tarif resmi Meta berubah & berbeda per negara.
const RATE_KEY = "populi.waRates";
const DEFAULT_RATES = { marketing: 800, utility: 350, authentication: 300 }; // Rp/pesan (perkiraan Indonesia)
const CAT_LABEL = { marketing: "Marketing (promosi/undangan/survei)", utility: "Utility (notifikasi/transaksi)", authentication: "Authentication (OTP)" };
const rupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

function loadRates() {
  try { const r = JSON.parse(localStorage.getItem(RATE_KEY)); if (r && typeof r === "object") return { ...DEFAULT_RATES, ...r }; } catch { /* ignore */ }
  return { ...DEFAULT_RATES };
}

function CostSimulator({ segments }) {
  const [rates, setRates] = useState(loadRates);
  const [category, setCategory] = useState("marketing");
  const [count, setCount] = useState(1000);
  const [segId, setSegId] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const pickSeg = (id) => { setSegId(id); const s = segments.find((x) => x.id === id); if (s) setCount(s.contacts.length); };
  const setRate = (k, v) => setRates({ ...rates, [k]: Number(v) || 0 });
  const saveRates = () => { localStorage.setItem(RATE_KEY, JSON.stringify(rates)); setSavedNote("Tarif tersimpan."); setTimeout(() => setSavedNote(""), 1500); };

  const rate = rates[category] || 0;
  const n = Number(count) || 0;
  const total = rate * n;
  // perbandingan semua kategori untuk jumlah yang sama
  const compare = Object.keys(CAT_LABEL).map((k) => ({ k, label: CAT_LABEL[k], rate: rates[k], total: rates[k] * n }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      <Card title="Simulasi Biaya Kirim">
        <Notice kind="success">{savedNote}</Notice>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Select label="Kategori pesan" value={category} onChange={(e) => setCategory(e.target.value)} options={Object.entries(CAT_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select label="Ambil jumlah dari segmen (opsional)" value={segId} onChange={(e) => pickSeg(e.target.value)} options={[{ value: "", label: "— isi manual —" }, ...segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length})` }))]} />
          <Input label="Jumlah penerima" type="number" value={count} onChange={(e) => { setSegId(""); setCount(e.target.value); }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch", marginTop: 6 }}>
          <div style={{ flex: "1 1 220px", background: theme.primarySoft, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: theme.primary, fontWeight: 600 }}>Perkiraan total biaya</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: theme.primary, marginTop: 6 }}>{rupiah(total)}</div>
            <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 4 }}>{n.toLocaleString("id-ID")} pesan × {rupiah(rate)} / pesan</div>
          </div>
          <div style={{ flex: "1 1 220px", background: theme.surfaceAlt, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 8 }}>Bandingkan kategori (jumlah sama)</div>
            {compare.map((c) => (
              <div key={c.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: c.k === category ? theme.primary : theme.textMuted, fontWeight: c.k === category ? 700 : 500 }}>
                <span style={{ textTransform: "capitalize" }}>{c.k}</span><span>{rupiah(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Tarif per Pesan (bisa diedit)">
        <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12 }}>Angka di bawah adalah <strong>perkiraan</strong> tarif Indonesia. Sesuaikan dengan tarif terbaru di akun Meta Anda, lalu simpan.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {Object.keys(DEFAULT_RATES).map((k) => (
            <Input key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (Rp/pesan)`} type="number" value={rates[k]} onChange={(e) => setRate(k, e.target.value)} />
          ))}
        </div>
        <Button onClick={saveRates}>Simpan Tarif</Button>
      </Card>

      <TopUpGuide />

      <Card title="Catatan Penting">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.textMuted, lineHeight: 1.7 }}>
          <li>Sejak <strong>Juli 2025</strong> Meta memakai harga <strong>per pesan</strong> (template terkirim), bukan per percakapan.</li>
          <li>Pesan <strong>balasan dari pengguna</strong> (service, dalam 24 jam) <strong>gratis</strong> — biaya hanya untuk template yang Anda kirim duluan.</li>
          <li>Tarif berbeda per <strong>kategori</strong> & per <strong>negara</strong>; kategori ditentukan saat membuat template.</li>
          <li>Pembayaran lewat <strong>akun Meta</strong>: bisa prabayar (top-up saldo) atau pascabayar (kartu kredit/credit line) — biaya WhatsApp ditagih di sana.</li>
        </ul>
      </Card>
    </div>
  );
}

function SegmentModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await onSave({ name, contacts }); } finally { setSaving(false); } };
  const attrKeys = [...new Set(contacts.flatMap((c) => Object.keys(c.attributes || {})))];
  return (
    <Modal title="Tambah Segmen" onClose={onClose} width={540}>
      <Input label="Nama Segmen" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Pemilih Jawa Barat" />
      <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 8 }}>Isi kontak segmen (upload file atau tempel nomor)</div>
      <ContactImporter onContacts={setContacts} />
      <div style={{ color: theme.textMuted, fontSize: 12.5, margin: "6px 0 14px" }}>
        {contacts.length} kontak akan masuk segmen (nomor dinormalisasi ke 62…){attrKeys.length ? ` • ${attrKeys.length} kolom pembobot ikut tersimpan` : ""}.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={submit} disabled={!name.trim() || !contacts.length || saving}>{saving ? "Menyimpan..." : `Simpan Segmen (${contacts.length})`}</Button>
      </div>
    </Modal>
  );
}
