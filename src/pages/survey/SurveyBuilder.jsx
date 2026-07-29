import { useMemo, useRef, useState } from "react";
import { api, apiBase } from "../../lib/api";
import {
  Button,
  Input,
  Textarea,
  Select,
  Toggle,
  Badge,
  Icon,
  Empty,
  Notice,
  useIsMobile,
  useDirty,
  confirmDiscard,
  theme,
  card,
} from "../../lib/ui";
import { QTYPE_OPTIONS, HAS_CHOICES } from "./constants";
import { QuestionItem } from "./QuestionItem";
import { FlowJsonModal } from "./FlowJsonModal";

// Panel pengaturan di kolom samping.
function Panel({ title, note, children }) {
  return (
    <div style={{ ...card, padding: 14, marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: theme.text, marginBottom: note ? 4 : 10 }}>{title}</div>
      {note ? (
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{note}</div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Builder survei — halaman penuh, bukan modal.
 * Pertanyaan bisa banyak dan pengaturannya bercabang, jadi butuh ruang: kolom utama
 * untuk isi survei, kolom samping untuk pengaturan, dan bilah simpan yang selalu terlihat.
 */
export function SurveyBuilder({ survey, error, onClose, onSave }) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(survey?.title || "");
  const [description, setDescription] = useState(survey?.description || "");
  const [status, setStatus] = useState(survey?.status || "draft");
  const [questions, setQuestions] = useState(() =>
    (survey?.questions || []).map((q) => ({ ...q, required: q.required ?? true })),
  );
  const [triggerEnabled, setTriggerEnabled] = useState(survey?.triggerEnabled ?? false);
  const [oncePerContact, setOncePerContact] = useState(survey?.oncePerContact ?? false);
  const [triggerKeywords, setTriggerKeywords] = useState(survey?.triggerKeywords || []);
  const [kwInput, setKwInput] = useState("");
  const [mode, setMode] = useState(survey?.mode || "chat");
  const [flowId, setFlowId] = useState(survey?.flowId || "");
  const [flowCta, setFlowCta] = useState(survey?.flowCta || "Isi Survei");
  const [flowPerScreen, setFlowPerScreen] = useState(survey?.flowPerScreen ?? 4);
  const [privacyUrl, setPrivacyUrl] = useState(survey?.privacyUrl || "");
  const [bannerUrl, setBannerUrl] = useState(survey?.bannerUrl || "");
  const [closingMessage, setClosingMessage] = useState(survey?.closingMessage || "");
  const [flowJsonOpen, setFlowJsonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const bannerRef = useRef(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerErr, setBannerErr] = useState("");
  const onPickBanner = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBannerUploading(true);
    setBannerErr("");
    try {
      const r = await api.uploadMedia(file);
      setBannerUrl(`${apiBase}${r.path}`);
    } catch (err) {
      setBannerErr(err.message);
    } finally {
      setBannerUploading(false);
    }
  };

  // Draf pertanyaan baru
  const [c, setC] = useState({
    text: "",
    type: "text",
    required: true,
    min: 1,
    max: 5,
    minLabel: "",
    maxLabel: "",
    choices: "",
  });
  const setCk = (k, v) => setC({ ...c, [k]: v });

  // Penanda perubahan belum tersimpan — dipakai saat menutup builder.
  const draft = useMemo(
    () => ({
      title,
      description,
      status,
      triggerEnabled,
      oncePerContact,
      triggerKeywords,
      mode,
      flowId,
      flowCta,
      flowPerScreen,
      privacyUrl,
      bannerUrl,
      closingMessage,
      questions,
    }),
    [
      title,
      description,
      status,
      triggerEnabled,
      oncePerContact,
      triggerKeywords,
      mode,
      flowId,
      flowCta,
      flowPerScreen,
      privacyUrl,
      bannerUrl,
      closingMessage,
      questions,
    ],
  );
  const dirty = useDirty(draft);
  // Draf pertanyaan yang sudah diketik tapi belum ditambahkan ikut dihitung agar tidak hilang diam-diam.
  const leave = async () => {
    if ((dirty() || c.text.trim()) && !(await confirmDiscard({ confirmText: "Keluar & buang" }))) return;
    onClose();
  };

  const addKeywords = (raw) => {
    const parts = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const merged = [...triggerKeywords];
    for (const p of parts) if (!merged.some((k) => k.toLowerCase() === p.toLowerCase())) merged.push(p);
    setTriggerKeywords(merged);
    setKwInput("");
  };
  const removeKeyword = (kw) => setTriggerKeywords(triggerKeywords.filter((k) => k !== kw));

  const addQuestion = () => {
    if (!c.text.trim()) return;
    let options;
    if (c.type === "rating") {
      options = { min: Number(c.min) || 1, max: Number(c.max) || 5 };
      if (c.minLabel.trim() || c.maxLabel.trim())
        options = { ...options, minLabel: c.minLabel.trim(), maxLabel: c.maxLabel.trim() };
    }
    if (HAS_CHOICES(c.type))
      options = {
        choices: c.choices
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    setQuestions([
      ...questions,
      { id: `t${Date.now()}`, text: c.text.trim(), type: c.type, required: c.required, options },
    ]);
    setC({ text: "", type: "text", required: true, min: 1, max: 5, minLabel: "", maxLabel: "", choices: "" });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        status,
        triggerEnabled,
        oncePerContact,
        triggerKeywords,
        mode,
        flowId: mode === "flow" ? flowId.trim() : null,
        flowCta: mode === "flow" ? flowCta.trim() || "Isi Survei" : null,
        flowPerScreen: Math.min(20, Math.max(1, Number(flowPerScreen) || 4)),
        privacyUrl: mode === "flow" ? privacyUrl.trim() || null : null,
        bannerUrl: bannerUrl.trim() || null, // berlaku di kedua mode
        closingMessage: closingMessage.trim() || null,
        questions: questions.map((q) => ({
          id: typeof q.id === "string" && !q.id.startsWith("t") ? q.id : undefined,
          text: q.text,
          type: q.type || "text",
          required: q.required ?? true,
          options: q.options,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  // Mode Flow tidak mendukung tipe "Gambar" → sembunyikan agar tidak salah pilih.
  const qtypeOptions = mode === "flow" ? QTYPE_OPTIONS.filter((o) => o.value !== "image") : QTYPE_OPTIONS;

  return (
    <div>
      {/* Bilah atas yang ikut menempel saat menggulir — tombol Simpan selalu terjangkau. */}
      <div
        style={{
          position: "sticky",
          top: isMobile ? 48 : 0,
          zIndex: 30,
          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
          padding: isMobile ? "10px 0" : "14px 0",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" icon="back" onClick={leave}>
          Kembali
        </Button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 16 : 18,
              color: theme.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title.trim() || (survey ? "Edit Survei" : "Survei baru")}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            {questions.length} pertanyaan • mode {mode === "flow" ? "WhatsApp Flow" : "Chatbot"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={leave}>
            Batal
          </Button>
          <Button icon="check" onClick={submit} disabled={!title.trim() || saving}>
            {saving ? "Menyimpan..." : "Simpan Survei"}
          </Button>
        </div>
      </div>

      <Notice>{error}</Notice>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 360px",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* ── Kolom utama: identitas survei + pertanyaan ── */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <Input
              label="Judul survei"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="cth: Survei Kepuasan Layanan 2026"
            />
            <Textarea
              label="Deskripsi (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan singkat isi survei."
              style={{ minHeight: 70 }}
            />
          </div>

          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: questions.length ? 12 : 0,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Pertanyaan</div>
              <Badge tone={questions.length ? "blue" : "default"}>{questions.length} pertanyaan</Badge>
            </div>
            {questions.length ? (
              <div style={{ display: "grid", gap: 7 }}>
                {questions.map((q, i) => (
                  <QuestionItem
                    key={q.id || i}
                    q={q}
                    index={i}
                    total={questions.length}
                    qtypeOptions={qtypeOptions}
                    allQuestions={questions}
                    flowMode={mode === "flow"}
                    onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))}
                    onDelete={() => setQuestions(questions.filter((_, j) => j !== i))}
                    onMove={(dir) => {
                      const j = i + dir;
                      if (j < 0 || j >= questions.length) return;
                      const arr = [...questions];
                      [arr[i], arr[j]] = [arr[j], arr[i]];
                      setQuestions(arr);
                    }}
                  />
                ))}
              </div>
            ) : (
              <Empty
                icon="survey"
                title="Belum ada pertanyaan"
                note="Tambahkan pertanyaan pertama lewat formulir di bawah."
              />
            )}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: theme.text }}>Tambah pertanyaan</div>
            <Input
              label="Teks pertanyaan"
              value={c.text}
              onChange={(e) => setCk("text", e.target.value)}
              placeholder="cth: Seberapa puas Anda?"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
              <Select
                label="Tipe jawaban"
                value={c.type}
                onChange={(e) => setCk("type", e.target.value)}
                options={qtypeOptions}
              />
              <div style={{ marginBottom: 14 }}>
                <Toggle checked={c.required} onChange={(v) => setCk("required", v)} label="Wajib" />
              </div>
            </div>
            {c.type === "rating" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input
                    label="Nilai minimum"
                    type="number"
                    value={c.min}
                    onChange={(e) => setCk("min", e.target.value)}
                  />
                  <Input
                    label="Nilai maksimum"
                    type="number"
                    value={c.max}
                    onChange={(e) => setCk("max", e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input
                    label="Label minimum (opsional)"
                    value={c.minLabel}
                    onChange={(e) => setCk("minLabel", e.target.value)}
                    placeholder="cth: Sangat tidak puas"
                  />
                  <Input
                    label="Label maksimum (opsional)"
                    value={c.maxLabel}
                    onChange={(e) => setCk("maxLabel", e.target.value)}
                    placeholder="cth: Sangat puas"
                  />
                </div>
              </>
            ) : null}
            {HAS_CHOICES(c.type) ? (
              <Textarea
                label={
                  c.type === "multichoice"
                    ? "Pilihan (boleh dipilih >1; satu per baris atau pisah koma)"
                    : "Pilihan (satu per baris atau pisah koma)"
                }
                value={c.choices}
                onChange={(e) => setCk("choices", e.target.value)}
                placeholder={"Sangat puas\nPuas\nBiasa\nTidak puas"}
              />
            ) : null}
            <Button icon="plus" onClick={addQuestion} disabled={!c.text.trim()}>
              Tambah Pertanyaan
            </Button>
          </div>
        </div>

        {/* ── Kolom samping: pengaturan ── */}
        <div style={{ minWidth: 0 }}>
          <Panel title="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "draft", label: "Draft — belum jalan" },
                { value: "active", label: "Aktif — pemicu & blast jalan" },
                { value: "closed", label: "Ditutup — tidak menerima jawaban" },
              ]}
            />
          </Panel>

          <Panel title="Mode pengisian">
            <Select
              value={mode}
              onChange={(e) => {
                const m = e.target.value;
                setMode(m);
                if (m === "flow" && c.type === "image") setCk("type", "text");
              }}
              options={[
                { value: "chat", label: "Chatbot — tanya-jawab per pesan" },
                { value: "flow", label: "WhatsApp Flow — formulir multi-layar" },
              ]}
            />
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: -8, marginBottom: 4, lineHeight: 1.5 }}>
              {mode === "flow"
                ? "Khusus Meta Cloud API. Tipe Gambar tidak didukung."
                : "Jalan di semua jalur: Meta, Qontak, dan Baileys."}
            </div>
            {mode === "flow" ? (
              <div style={{ marginTop: 12 }}>
                <Input
                  label="Flow ID (dari Meta)"
                  value={flowId}
                  onChange={(e) => setFlowId(e.target.value)}
                  placeholder="cth: 1234567890123456"
                  hint="ID Flow yang sudah diterbitkan di WhatsApp Manager."
                />
                <Input
                  label="Teks tombol pembuka (CTA)"
                  value={flowCta}
                  onChange={(e) => setFlowCta(e.target.value)}
                  placeholder="Isi Survei"
                />
                <Input
                  label="Pertanyaan per layar"
                  type="number"
                  min={1}
                  max={20}
                  value={flowPerScreen}
                  onChange={(e) => setFlowPerScreen(e.target.value)}
                  hint="Bisa ditimpa penanda seksi manual pada tiap pertanyaan."
                />
                <Input
                  label="Tautan kebijakan privasi (opsional)"
                  value={privacyUrl}
                  onChange={(e) => setPrivacyUrl(e.target.value)}
                  placeholder="https://populicenter.com/privasi"
                  hint="Muncul sebagai tautan di layar pertama Flow."
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="download"
                  onClick={() => (survey?.id ? setFlowJsonOpen(true) : null)}
                  disabled={!survey?.id}
                  style={{ width: "100%" }}
                >
                  Lihat / Salin Flow JSON
                </Button>
                <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                  {survey?.id ? (
                    <>
                      Setiap kali pertanyaan berubah, <strong>publish ulang Flow di Meta</strong> — kalau tidak, jawaban
                      masuk kosong.
                    </>
                  ) : (
                    "Simpan survei dulu agar Flow JSON memakai ID pertanyaan final."
                  )}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Banner pesan pembuka"
            note="Gambar di pesan saat survei dimulai. Mode Flow: jadi header pesan formulir. Mode Chat: dikirim sebagai gambar ber-caption. JPG/PNG, maks 10MB."
          >
            <Input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              error={bannerErr}
              placeholder="https://..."
            />
            <input
              ref={bannerRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={onPickBanner}
            />
            {bannerUrl.trim() ? (
              <img
                src={bannerUrl}
                alt="Pratinjau banner"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 120,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              />
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                size="sm"
                variant="secondary"
                icon="upload"
                onClick={() => bannerRef.current?.click()}
                disabled={bannerUploading}
              >
                {bannerUploading ? "Mengunggah…" : bannerUrl.trim() ? "Ganti" : "Upload Banner"}
              </Button>
              {bannerUrl.trim() ? (
                <Button size="sm" variant="ghost" onClick={() => setBannerUrl("")}>
                  Hapus
                </Button>
              ) : null}
            </div>
          </Panel>

          <Panel title="Batas pengisian per responden">
            <Select
              value={oncePerContact ? "once" : "many"}
              onChange={(e) => setOncePerContact(e.target.value === "once")}
              options={[
                { value: "many", label: "Berkali-kali" },
                { value: "once", label: "Sekali saja" },
              ]}
            />
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: -8, lineHeight: 1.5 }}>
              {oncePerContact ? (
                <>
                  Nomor yang <strong>sudah menyelesaikan</strong> survei ini tidak bisa mengisi lagi — pemicu berikutnya
                  dibalas ucapan terima kasih. Yang <em>batal</em> mengisi tetap boleh mengulang.
                </>
              ) : (
                <>
                  Satu nomor bisa mengisi berulang kali dan tiap pengisian tercatat terpisah. Hati-hati pada survei
                  sungguhan — data bisa terkena jawaban ganda.
                </>
              )}
            </div>
          </Panel>

          <Panel title="Pemicu otomatis (bot)">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: theme.textMuted, lineHeight: 1.5 }}>
                Survei dimulai otomatis saat pesan masuk cocok kata kunci.
              </div>
              <Toggle checked={triggerEnabled} onChange={setTriggerEnabled} label="" />
            </div>
            {triggerEnabled ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
                  {triggerKeywords.map((kw) => (
                    <span
                      key={kw}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: theme.primarySoft,
                        color: theme.primary,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      {kw}
                      <button
                        onClick={() => removeKeyword(kw)}
                        aria-label={`Hapus kata kunci ${kw}`}
                        title="Hapus kata kunci"
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: theme.primary,
                          display: "flex",
                          padding: 0,
                        }}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </span>
                  ))}
                  {!triggerKeywords.length ? (
                    <span style={{ fontSize: 12, color: theme.textMuted }}>Belum ada kata kunci.</span>
                  ) : null}
                </div>
                <input
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeywords(kwInput);
                    }
                  }}
                  onBlur={() => addKeywords(kwInput)}
                  placeholder="cth: isi survey, survei"
                  aria-label="Kata kunci pemicu"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 9,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    background: theme.surface,
                  }}
                />
                <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 5, lineHeight: 1.5 }}>
                  Pisahkan dengan koma atau Enter. Survei harus berstatus <strong>Aktif</strong> agar pemicu berfungsi.
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title="Kata penutup" note="Dikirim saat responden menyelesaikan survei. Kosongkan untuk teks default.">
            <Textarea
              value={closingMessage}
              onChange={(e) => setClosingMessage(e.target.value)}
              placeholder="Terima kasih, semua jawaban Anda sudah kami terima. 🙏"
              style={{ minHeight: 70 }}
            />
          </Panel>
        </div>
      </div>

      {flowJsonOpen && survey?.id ? (
        <FlowJsonModal surveyId={survey.id} onClose={() => setFlowJsonOpen(false)} />
      ) : null}
    </div>
  );
}
