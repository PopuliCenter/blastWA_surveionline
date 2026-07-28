import { useRef, useState } from "react";
import { api, apiBase } from "../../lib/api";
import { Modal, Select, Notice, Input, Textarea, Button, theme } from "../../lib/ui";
import { loadRates, rupiah } from "./constants";

const MEDIA_TYPES = ["image", "document", "video"];
const MEDIA_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
  video: "video/mp4,video/3gpp",
};

export function BlastModal({ surveys, segments, templates, onClose, onSave }) {
  const [f, setF] = useState({
    surveyId: "",
    segmentId: segments[0]?.id || "",
    vendor: "meta",
    templateId: "",
    templateName: "",
    templateLang: "en_US",
    bodyParams: "",
    messageText: "",
    schedule: "",
    headerMediaType: "",
    headerMediaUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [rates] = useState(loadRates);
  const set = (k, v) => setF({ ...f, [k]: v });

  // Upload/ganti file header media untuk blast ini
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState("");
  const onPickedFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUpErr("");
    try {
      const r = await api.uploadMedia(file);
      set("headerMediaUrl", `${apiBase}${r.path}`);
    } catch (err) {
      setUpErr(err.message);
    } finally {
      setUploading(false);
    }
  };
  // Prefill URL dari template lokal yang namanya sama (mis. padanan template Meta).
  const localMediaUrl = (name, language) =>
    templates.find((x) => x.name === name && (x.language || "id") === language)?.headerMediaUrl || "";

  // Ambil daftar template approved langsung dari Meta (hindari salah nama/bahasa).
  const [metaTpls, setMetaTpls] = useState(null);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState("");
  const loadMetaTpls = async () => {
    setTplLoading(true);
    setTplErr("");
    setMetaTpls(null);
    try {
      const r = await api.getWaTemplates();
      if (r.error) setTplErr(r.error);
      else setMetaTpls((r.templates || []).filter((t) => String(t.status).toUpperCase() === "APPROVED"));
    } catch (e) {
      setTplErr(e.message);
    } finally {
      setTplLoading(false);
    }
  };
  const pickMetaTpl = (val) => {
    if (!val) return;
    const [name, language] = val.split("|");
    // Template Meta ber-header media → wajib file saat kirim; deteksi dari headerFormat.
    const mt = (metaTpls || []).find((t) => t.name === name && t.language === language);
    const mediaType = MEDIA_TYPES.includes(mt?.headerFormat) ? mt.headerFormat : "";
    setF({
      ...f,
      templateName: name,
      templateLang: language || "id",
      templateId: "",
      headerMediaType: mediaType,
      headerMediaUrl: mediaType ? localMediaUrl(name, language || "id") : "",
    });
  };

  const pickTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) {
      setF({ ...f, templateId: "", templateName: "", bodyParams: "", headerMediaType: "", headerMediaUrl: "" });
      return;
    }
    const preview = (t.bodyText || "").replace(/\{\{(\d+)\}\}/g, (_, n) => t.sampleParams?.[+n - 1] || `{{${n}}}`);
    const mediaType = MEDIA_TYPES.includes(t.headerType) ? t.headerType : "";
    setF({
      ...f,
      templateId: id,
      templateName: t.name,
      templateLang: t.language || "id",
      bodyParams: (t.sampleParams || []).join(", "),
      messageText: preview,
      headerMediaType: mediaType,
      headerMediaUrl: mediaType ? t.headerMediaUrl || "" : "",
    });
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
      await onSave({
        surveyId: f.surveyId || undefined,
        segmentId: f.segmentId,
        vendor: f.vendor,
        templateName: isBaileys ? undefined : f.templateName.trim(),
        templateLang: f.templateLang,
        messageText: f.messageText,
        bodyParams: f.bodyParams.trim() ? f.bodyParams.split(",").map((s) => s.trim()) : undefined,
        scheduledAt: f.schedule || undefined,
        ...(!isBaileys && f.headerMediaType && f.headerMediaUrl.trim()
          ? { headerMediaType: f.headerMediaType, headerMediaUrl: f.headerMediaUrl.trim() }
          : {}),
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Buat Blast" onClose={onClose}>
      <Select
        label="Survei (opsional)"
        value={f.surveyId}
        onChange={(e) => set("surveyId", e.target.value)}
        options={[
          { value: "", label: "— tanpa survei —" },
          ...surveys.map((s) => ({ value: s.id, label: `${s.title}${s.mode === "flow" ? " (Flow)" : ""}` })),
        ]}
      />
      {selSurvey?.mode === "flow" ? (
        <Notice kind="info">
          Survei <strong>Flow</strong>: pakai template yang punya <strong>tombol Flow</strong> (terhubung ke Flow ID
          survei ini di Meta). Jawaban responden tertangkap otomatis tanpa tanya-jawab per pesan.
        </Notice>
      ) : null}
      <Select
        label="Segmen"
        value={f.segmentId}
        onChange={(e) => set("segmentId", e.target.value)}
        options={segments.map((s) => ({ value: s.id, label: `${s.name} (${s.contacts.length})` }))}
      />
      <Select
        label="Vendor"
        value={f.vendor}
        onChange={(e) => set("vendor", e.target.value)}
        options={[
          { value: "meta", label: "Meta Cloud API" },
          { value: "qontak", label: "Qontak" },
          { value: "baileys", label: "WhatsApp Langsung (QR) — tanpa template" },
        ]}
      />
      {isBaileys ? (
        <>
          <Notice kind="info">
            Jalur <strong>tidak resmi</strong> (scan QR). Pesan teks dikirim langsung tanpa template/approval. ⚠ Ada
            risiko nomor diblokir — pakai volume kecil & nomor non-kritis. Pastikan sudah <strong>Terhubung</strong> di
            menu Akun WhatsApp.
          </Notice>
          <Input
            label="Parameter (pisah koma, opsional)"
            value={f.bodyParams}
            onChange={(e) => set("bodyParams", e.target.value)}
            hint="nilai untuk {{1}}, {{2}}, … di dalam pesan — kosongkan bila tak pakai variabel"
          />
          <Textarea
            label="Isi Pesan"
            value={f.messageText}
            onChange={(e) => set("messageText", e.target.value)}
            hint="Teks yang dikirim apa adanya. Boleh pakai {{1}} untuk personalisasi (mis. nama)."
          />
        </>
      ) : (
        <>
          {f.vendor === "meta" ? (
            <div style={{ background: theme.primarySoft, borderRadius: 10, padding: "11px 12px", marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.primary }}>
                  Template dari Meta (Approved)
                </span>
                <Button variant="secondary" size="sm" icon="refresh" onClick={loadMetaTpls} disabled={tplLoading}>
                  {tplLoading ? "Memuat…" : "Ambil dari Meta"}
                </Button>
              </div>
              {tplErr ? <Notice>{tplErr}</Notice> : null}
              {metaTpls ? (
                metaTpls.length ? (
                  <Select
                    value={f.templateName ? `${f.templateName}|${f.templateLang}` : ""}
                    onChange={(e) => pickMetaTpl(e.target.value)}
                    options={[
                      { value: "", label: `— pilih (${metaTpls.length} approved) —` },
                      ...metaTpls.map((t) => ({
                        value: `${t.name}|${t.language}`,
                        label: `${t.name} · ${t.language}${t.category ? ` · ${t.category}` : ""}`,
                      })),
                    ]}
                  />
                ) : (
                  <div style={{ fontSize: 12.5, color: theme.textMuted }}>
                    Belum ada template <strong>Approved</strong>. Buat & setujui dulu di Meta WhatsApp Manager.
                  </div>
                )
              ) : (
                <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
                  Klik <strong>Ambil dari Meta</strong> untuk memuat template approved. Butuh <strong>WABA ID</strong>{" "}
                  terisi di menu Akun WhatsApp.
                </div>
              )}
            </div>
          ) : null}
          <Select
            label="Template Tersimpan (lokal)"
            value={f.templateId}
            onChange={(e) => pickTemplate(e.target.value)}
            options={[
              { value: "", label: "— ketik manual —" },
              ...templates.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.status === "approved" ? "disetujui" : t.status})`,
              })),
            ]}
          />
          {selectedTpl && selectedTpl.status !== "approved" ? (
            <Notice kind="info">
              Template ini berstatus <strong>{selectedTpl.status}</strong>. Pastikan sudah disetujui Meta sebelum
              benar-benar dikirim.
            </Notice>
          ) : null}
          <Input
            label="Nama / ID Template"
            value={f.templateName}
            onChange={(e) => set("templateName", e.target.value)}
            hint="Terisi otomatis bila memilih template tersimpan. Manual: hello_world (Meta) / Template ID (Qontak)"
          />
          <Input
            label="Bahasa Template"
            value={f.templateLang}
            onChange={(e) => set("templateLang", e.target.value)}
            hint="id / en_US"
          />
          <Input
            label="Parameter (pisah koma, opsional)"
            value={f.bodyParams}
            onChange={(e) => set("bodyParams", e.target.value)}
            hint="nilai untuk {{1}}, {{2}}, … — kosongkan bila template tanpa variabel"
          />
          <Select
            label="Header media (bila template ber-header media)"
            value={f.headerMediaType}
            onChange={(e) => set("headerMediaType", e.target.value)}
            options={[
              { value: "", label: "— tanpa media —" },
              { value: "image", label: "Gambar / Foto" },
              { value: "document", label: "Dokumen (PDF)" },
              { value: "video", label: "Video" },
            ]}
          />
          {f.headerMediaType ? (
            <div style={{ background: theme.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Input
                label="URL media"
                value={f.headerMediaUrl}
                onChange={(e) => set("headerMediaUrl", e.target.value)}
                error={upErr}
                hint="Terisi otomatis dari template lokal; klik Upload File untuk mengganti. WAJIB terisi — template ber-header media ditolak Meta bila dikirim tanpa file."
                placeholder="https://..."
              />
              <input
                ref={fileRef}
                type="file"
                accept={MEDIA_ACCEPT[f.headerMediaType]}
                style={{ display: "none" }}
                onChange={onPickedFile}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginTop: -6 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="upload"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Mengunggah…" : "Upload File"}
                </Button>
                {f.headerMediaUrl.trim() ? (
                  f.headerMediaType === "image" ? (
                    <img
                      src={f.headerMediaUrl}
                      alt="Preview header"
                      style={{ maxHeight: 90, maxWidth: 160, borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : f.headerMediaType === "video" ? (
                    <video src={f.headerMediaUrl} controls style={{ maxHeight: 90, maxWidth: 200, borderRadius: 8 }} />
                  ) : (
                    <span style={{ fontSize: 12.5, color: theme.text, wordBreak: "break-all", paddingTop: 6 }}>
                      📄 {decodeURIComponent(f.headerMediaUrl.split("/").pop()?.split("?")[0] || "dokumen")}
                    </span>
                  )
                ) : null}
              </div>
            </div>
          ) : null}
          <Textarea
            label="Preview Pesan (audit)"
            value={f.messageText}
            onChange={(e) => set("messageText", e.target.value)}
          />
        </>
      )}
      <Input
        label="Jadwal (opsional)"
        type="datetime-local"
        value={f.schedule}
        onChange={(e) => set("schedule", e.target.value)}
      />

      {recipients > 0 ? (
        <div
          style={{
            background: theme.primarySoft,
            borderRadius: 10,
            padding: "11px 14px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>
            Perkiraan biaya{" "}
            <span style={{ textTransform: "capitalize", color: theme.primary, fontWeight: 600 }}>{catKey}</span>
            {!selectedTpl ? " (asumsi)" : ""}
            <br />
            {recipients.toLocaleString("id-ID")} penerima × {rupiah(estRate)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: theme.primary }}>{rupiah(estTotal)}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button
          icon="send"
          onClick={submit}
          disabled={
            !f.segmentId ||
            (isBaileys ? !f.messageText.trim() : !f.templateName.trim()) ||
            (!isBaileys && !!f.headerMediaType && !f.headerMediaUrl.trim()) ||
            saving
          }
        >
          {saving ? "Mengirim..." : "Kirim Blast"}
        </Button>
      </div>
    </Modal>
  );
}
