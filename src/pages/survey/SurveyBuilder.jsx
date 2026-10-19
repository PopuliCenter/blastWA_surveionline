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
import {
  QTYPE_OPTIONS,
  HAS_CHOICES,
  PESAN_KUOTA_PENUH_BAWAAN,
  PESAN_SURVEI_BERAKHIR_BAWAAN,
  PESAN_MINTA_LOKASI_BAWAAN,
  TERIMA_KASIH_LOKASI_BAWAAN,
  PENUTUP_BAWAAN,
  BATAS_PESAN_BERTOMBOL,
} from "./constants";
import { QuestionItem } from "./QuestionItem";
import { AturanDurasiEditor } from "./AturanDurasiEditor";
import { galatAturanDurasi } from "../../lib/exportSurvey";
import { gandakanPertanyaan, hapusPertanyaan, geserPertanyaan, teksGanda } from "./daftarPertanyaan";
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
export function SurveyBuilder({ survey, error, info, onClose, onSave }) {
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
  // Kosong = teks bawaan backend. Sengaja TIDAK diisi teks bawaan sebagai nilai awal:
  // survei lama akan menyimpan salinannya, lalu perbaikan teks bawaan tak lagi berlaku.
  const [pesanKuotaPenuh, setPesanKuotaPenuh] = useState(survey?.pesanKuotaPenuh || "");
  // Kosong = teks bawaan backend, alasannya sama dengan pesanKuotaPenuh.
  const [pesanSurveiBerakhir, setPesanSurveiBerakhir] = useState(survey?.pesanSurveiBerakhir || "");
  const [mintaLokasi, setMintaLokasi] = useState(survey?.mintaLokasi ?? false);
  // Kosong = teks bawaan backend, alasannya sama dengan pesanKuotaPenuh.
  const [pesanMintaLokasi, setPesanMintaLokasi] = useState(survey?.pesanMintaLokasi || "");
  const [lokasiPesanTerpisah, setLokasiPesanTerpisah] = useState(survey?.lokasiPesanTerpisah ?? false);
  const [balasanLokasi, setBalasanLokasi] = useState(survey?.balasanLokasi || "");
  // Penutup + permintaan yang tak muat dalam satu pesan bertombol tetap terkirim sebagai dua
  // pesan — perhitungannya sama dengan kirimPenutup di backend, supaya biayanya tidak mengejutkan.
  const gabunganTerlaluPanjang =
    (closingMessage.trim() || PENUTUP_BAWAAN).length +
      2 +
      (pesanMintaLokasi.trim() || PESAN_MINTA_LOKASI_BAWAAN).length >
    BATAS_PESAN_BERTOMBOL;
  // null = aturan bawaan (lihat AturanDurasiEditor).
  const [aturanDurasi, setAturanDurasi] = useState(survey?.aturanDurasi ?? null);
  const [flowJsonOpen, setFlowJsonOpen] = useState(false);
  // Salinan pertanyaan yang baru dibuat — dibuka langsung dalam mode sunting.
  const [salinanBaru, setSalinanBaru] = useState(null);
  // Pertanyaan yang formulir suntingnya sedang terbuka. Isinya belum masuk `questions`
  // sebelum "Simpan Pertanyaan" ditekan, jadi "Simpan Survei" di saat itu diam-diam
  // membuang suntingannya — dan salinan tersimpan dengan teks "(salinan)" yang lalu
  // terkirim apa adanya ke responden.
  const [sedangDisunting, setSedangDisunting] = useState(() => new Set());
  const tandaiSunting = (id, buka) =>
    setSedangDisunting((s) => {
      const n = new Set(s);
      if (buka) n.add(id);
      else n.delete(id);
      return n;
    });
  const nomorSalinan = useRef(0);
  // Teks kembar yang SUDAH ada saat survei dibuka. Survei lama yang terlanjur begitu tetap
  // boleh disimpan — termasuk sekadar ditutup — tanpa dipaksa mengubah instrumennya; yang
  // diblokir hanya kembaran BARU. Server memakai aturan yang sama.
  const [kembarAwal] = useState(() => new Set(teksGanda(survey?.questions || [])));
  // Aturan percabangan yang terpaksa dilepas karena tujuannya terhapus.
  const [cabangDilepas, setCabangDilepas] = useState(0);
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
      pesanKuotaPenuh,
      pesanSurveiBerakhir,
      mintaLokasi,
      pesanMintaLokasi,
      lokasiPesanTerpisah,
      balasanLokasi,
      aturanDurasi,
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
      pesanKuotaPenuh,
      pesanSurveiBerakhir,
      mintaLokasi,
      pesanMintaLokasi,
      lokasiPesanTerpisah,
      balasanLokasi,
      aturanDurasi,
      questions,
    ],
  );
  const dirty = useDirty(draft);
  // Draf pertanyaan yang sudah diketik tapi belum ditambahkan ikut dihitung agar tidak hilang diam-diam.
  const leave = async () => {
    // Formulir sunting pertanyaan yang masih terbuka juga perubahan yang belum tersimpan.
    if ((dirty() || c.text.trim() || adaSuntingan) && !(await confirmDiscard({ confirmText: "Keluar & buang" })))
      return;
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

  // Susunan daftar berubah → aturan percabangan ikut dipetakan ulang (lihat daftarPertanyaan.js).
  const terapkan = ({ questions: baru, dilepas }) => {
    setQuestions(baru);
    if (dilepas) setCabangDilepas((n) => n + dilepas);
  };
  const gandakan = (i) => {
    const id = `t${Date.now()}-${++nomorSalinan.current}`;
    terapkan(gandakanPertanyaan(questions, i, id));
    setSalinanBaru(id);
    tandaiSunting(id, true);
  };

  // Teks pertanyaan kembar membuat jawabannya bertumpuk di satu kolom ekspor. Server juga
  // menolaknya; di sini supaya ketahuan sebelum menekan Simpan.
  const semuaKembar = teksGanda(questions);
  const kembar = semuaKembar.filter((t) => !kembarAwal.has(t));
  const galatDurasi = aturanDurasi ? galatAturanDurasi(aturanDurasi) : null;
  const kembarLama = semuaKembar.filter((t) => kembarAwal.has(t));
  // Hanya yang masih ada di daftar — formulir pertanyaan yang sudah dihapus tidak dihitung.
  const adaSuntingan = questions.some((q) => sedangDisunting.has(q.id));
  // Teks "(salinan)" yang belum diubah tampil apa adanya ke responden.
  const masihSalinan = questions.find((q) => /\(salinan(?: \d+)?\)$/i.test((q.text || "").trim()));

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
        pesanKuotaPenuh: pesanKuotaPenuh.trim() || null,
        pesanSurveiBerakhir: pesanSurveiBerakhir.trim() || null,
        mintaLokasi,
        pesanMintaLokasi: pesanMintaLokasi.trim() || null,
        lokasiPesanTerpisah,
        balasanLokasi: balasanLokasi.trim() || null,
        aturanDurasi,
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
          <Button
            icon="check"
            onClick={submit}
            disabled={!title.trim() || saving || kembar.length > 0 || adaSuntingan || Boolean(galatDurasi)}
            title={adaSuntingan ? "Selesaikan dulu pertanyaan yang sedang disunting" : undefined}
          >
            {saving ? "Menyimpan..." : "Simpan Survei"}
          </Button>
        </div>
      </div>

      <Notice>{error}</Notice>
      {info ? <Notice kind="info">{info}</Notice> : null}
      {kembar.length ? (
        <Notice kind="warning">
          Ada pertanyaan yang tulisannya sama persis: <strong>&ldquo;{kembar[0]}&rdquo;</strong>. Jawabannya akan
          bertumpuk di satu kolom ekspor — ubah salah satunya sebelum menyimpan.
        </Notice>
      ) : null}
      {kembarLama.length ? (
        <Notice kind="info">
          Survei ini sudah punya pertanyaan yang tulisannya sama persis sejak sebelumnya:{" "}
          <strong>&ldquo;{kembarLama[0]}&rdquo;</strong>. Jawaban keduanya bertumpuk di satu kolom ekspor. Survei tetap
          bisa disimpan; bedakan tulisannya bila datanya akan diekspor.
        </Notice>
      ) : null}
      {adaSuntingan ? (
        <Notice kind="info">
          Ada pertanyaan yang formulir suntingnya masih terbuka. Tekan <strong>Simpan Pertanyaan</strong> atau{" "}
          <strong>Batal</strong> di formulir itu dulu — isinya belum ikut tersimpan.
        </Notice>
      ) : masihSalinan ? (
        <Notice kind="info">
          Pertanyaan &ldquo;{masihSalinan.text}&rdquo; masih bertanda <strong>(salinan)</strong> — tulisan itu akan
          tampil apa adanya ke responden.
        </Notice>
      ) : null}
      {cabangDilepas ? (
        <Notice kind="info">
          {cabangDilepas} aturan percabangan menuju pertanyaan terakhir yang dihapus, jadi dikembalikan ke &ldquo;lanjut
          normal&rdquo;. Periksa lagi percabangannya bila perlu.
        </Notice>
      ) : null}

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
                    mulaiEdit={q.id === salinanBaru}
                    onSunting={(buka) => tandaiSunting(q.id, buka)}
                    onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))}
                    onDelete={() => terapkan(hapusPertanyaan(questions, i))}
                    onMove={(dir) => terapkan(geserPertanyaan(questions, i, dir))}
                    onDuplicate={() => gandakan(i)}
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
              placeholder={PENUTUP_BAWAAN}
              style={{ minHeight: 70 }}
            />
          </Panel>

          <Panel
            title="Lokasi responden"
            note="Untuk memeriksa responden benar-benar berada di provinsi yang ia sebut, dan untuk peta sebaran di Laporan."
          >
            <Toggle checked={mintaLokasi} onChange={setMintaLokasi} label="Minta lokasi setelah responden selesai" />
            {mintaLokasi ? (
              <div style={{ marginTop: 12 }}>
                <Textarea
                  label="Teks permintaan lokasi"
                  value={pesanMintaLokasi}
                  onChange={(e) => setPesanMintaLokasi(e.target.value)}
                  placeholder={PESAN_MINTA_LOKASI_BAWAAN}
                  maxLength={900}
                  style={{ minHeight: 90 }}
                  hint={
                    <span style={{ lineHeight: 1.5 }}>
                      {lokasiPesanTerpisah || gabunganTerlaluPanjang
                        ? "Dikirim sebagai pesan sendiri sesudah kata penutup"
                        : "Dikirim bersama kata penutup dalam satu pesan"}
                      , dengan tombol <strong>Kirim lokasi</strong>. Sebutkan untuk apa lokasinya dipakai dan bahwa
                      responden boleh melewatinya. Kosongkan untuk teks default.
                    </span>
                  }
                />
                <div style={{ marginBottom: 14 }}>
                  <Toggle
                    checked={lokasiPesanTerpisah}
                    onChange={setLokasiPesanTerpisah}
                    label="Kirim sebagai pesan terpisah dari kata penutup"
                  />
                  <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                    {lokasiPesanTerpisah
                      ? "Responden menerima dua pesan: kata penutup, lalu permintaan lokasi. Meta menagih keduanya."
                      : gabunganTerlaluPanjang
                        ? `Kata penutup dan permintaan lokasi melebihi ${BATAS_PESAN_BERTOMBOL} karakter, jadi tetap dikirim sebagai dua pesan (dua tagihan). Persingkat salah satunya agar muat dalam satu pesan.`
                        : "Mati = satu pesan, satu tagihan per responden."}
                  </div>
                </div>
                <Textarea
                  label="Balasan setelah lokasi diterima"
                  value={balasanLokasi}
                  onChange={(e) => setBalasanLokasi(e.target.value)}
                  placeholder={TERIMA_KASIH_LOKASI_BAWAAN}
                  maxLength={500}
                  style={{ minHeight: 60 }}
                  hint="Dikirim sekali, setelah responden membagikan lokasinya. Kosongkan untuk teks default."
                />
                <div style={{ marginTop: 10 }}>
                  <Notice kind="warning">
                    Lokasi adalah data pribadi. Pastikan kebijakan privasi survei menyebutkannya sebelum fitur ini
                    dipakai. Titik disimpan dibulatkan (sekitar 1 km), dan responden yang menolak persetujuan tidak
                    dimintai lokasi. Hanya untuk nomor WhatsApp Business resmi (Meta): responden yang mengisi lewat
                    vendor lain tidak dimintai lokasi.
                  </Notice>
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Pesan saat kuota penuh"
            note="Dikirim bila kuota survei atau kuota provinsi responden sudah terpenuhi. Jawabannya tidak dihitung dan tidak ikut ekspor maupun Google Sheets. Kosongkan untuk teks default."
          >
            {/* Satu pesan untuk dua momen yang berbeda — dan responden tidak boleh tahu
                wilayah mana yang masih dicari, kalau tidak ia cukup mengaku tinggal di sana. */}
            <Textarea
              value={pesanKuotaPenuh}
              onChange={(e) => setPesanKuotaPenuh(e.target.value)}
              placeholder={PESAN_KUOTA_PENUH_BAWAAN}
              maxLength={1000}
              aria-label="Pesan saat kuota penuh"
              hint={
                <span style={{ lineHeight: 1.5 }}>
                  Pesan yang sama dikirim <strong>sebelum</strong> survei dimulai maupun <strong>sesudah</strong>{" "}
                  responden selesai mengisi formulir Flow, jadi tulis kalimat yang cocok untuk keduanya. Jangan sebut
                  nama provinsi atau angka kuota.
                </span>
              }
            />
          </Panel>

          <Panel
            title="Pesan saat survei sudah berakhir"
            note="Dikirim kepada orang yang mencoba ikut setelah survei ini ditutup (status Ditutup). Kosongkan untuk teks default."
          >
            <Textarea
              value={pesanSurveiBerakhir}
              onChange={(e) => setPesanSurveiBerakhir(e.target.value)}
              placeholder={PESAN_SURVEI_BERAKHIR_BAWAAN}
              maxLength={1000}
              aria-label="Pesan saat survei sudah berakhir"
              hint={
                <span style={{ lineHeight: 1.5 }}>
                  Dikirim bila seseorang mengetik kata pemicu survei ini, membalas blastnya, atau mengirim formulir yang
                  terlanjur dibuka — setelah survei ditutup. Jawaban yang masuk setelah ditutup tetap disimpan, tetapi
                  tidak ikut ekspor, Google Sheets, maupun kuota.
                </span>
              }
            />
          </Panel>

          <Panel
            title="Asesmen durasi"
            note="Label kolom “Asesmen Durasi” di ekspor dan Google Sheets, menurut lama pengisian. Sesuaikan dengan panjang survei ini — tiga menit terburu-buru untuk 40 pertanyaan, tapi wajar untuk 8."
          >
            <AturanDurasiEditor nilai={aturanDurasi} onChange={setAturanDurasi} />
          </Panel>
        </div>
      </div>

      {flowJsonOpen && survey?.id ? (
        <FlowJsonModal surveyId={survey.id} onClose={() => setFlowJsonOpen(false)} />
      ) : null}
    </div>
  );
}
