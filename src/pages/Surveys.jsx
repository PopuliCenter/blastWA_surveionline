import { useCallback, useMemo, useState } from "react";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirm";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  Notice,
  Loading,
  Empty,
  Pagination,
  useLoader,
  useIsMobile,
  theme,
} from "../lib/ui";
import { SurveyBuilder } from "./survey/SurveyBuilder";
import { SurveyResponses } from "./survey/SurveyResponses";
import { SurveyPreviewModal } from "./survey/SurveyPreviewModal";
import { SurveyGuide } from "./survey/SurveyGuide";
import { SurveyKuotaModal } from "./survey/SurveyKuotaModal";

// Survei menumpuk per gelombang: empat bulan survei bulanan sudah jadi selusin kartu,
// dan mencari satu di antaranya berarti memindai seluruh halaman dengan mata.
const PER_HALAMAN = 12;

export default function Surveys() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listSurveys(), []));
  const [modal, setModal] = useState(null);
  const [responsesFor, setResponsesFor] = useState(null);
  const [previewFor, setPreviewFor] = useState(null);
  const [kuotaFor, setKuotaFor] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [err, setErr] = useState("");
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("");
  const [halaman, setHalaman] = useState(1);
  const semua = useMemo(() => data || [], [data]);

  // Penyaringan di klien: jumlah survei dihitung lusinan, bukan ribuan seperti kontak,
  // jadi memindahkannya ke server hanya menambah perjalanan tanpa menambah kecepatan.
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return semua.filter(
      (s) =>
        (!status || s.status === status) &&
        (!q || s.title.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)),
    );
  }, [semua, cari, status]);

  const pageCount = Math.max(1, Math.ceil(tersaring.length / PER_HALAMAN));
  // Saringan baru bisa memendekkan hasil sampai di bawah posisi halaman sekarang;
  // tanpa jepitan ini layar jadi kosong padahal datanya ada.
  const curPage = Math.min(halaman, pageCount);
  const start = (curPage - 1) * PER_HALAMAN;
  const surveys = tersaring.slice(start, start + PER_HALAMAN);

  const run = async (fn) => {
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  const save = async (draft, id) =>
    run(async () => {
      if (id) await api.updateSurvey(id, draft);
      else await api.createSurvey(draft);
      setModal(null);
    });
  const delSurvey = async (s) => {
    const withResp = s.responses ? ` beserta ${s.responses} respons yang sudah masuk` : "";
    if (
      !(await confirmDialog({
        title: "Hapus survei",
        message: `Hapus survei "${s.title}"${withResp}? Tindakan ini permanen dan tidak bisa dibatalkan.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    run(() => api.deleteSurvey(s.id));
  };

  // Daftar respons juga mengambil alih halaman: satu survei bisa mengumpulkan ribuan
  // responden, yang butuh ruang untuk pencarian, saringan, dan paginasi.
  if (responsesFor) return <SurveyResponses survey={responsesFor} onClose={() => setResponsesFor(null)} />;

  // Builder mengambil alih seluruh halaman — pertanyaan & pengaturannya terlalu banyak untuk modal.
  if (modal !== null)
    return (
      <SurveyBuilder
        survey={modal.id ? modal : null}
        error={err}
        onClose={() => {
          setErr("");
          setModal(null);
        }}
        onSave={(d) => save(d, modal.id)}
      />
    );

  return (
    <div>
      <PageHeader
        title="Survei"
        subtitle="Buat survei & lihat jawaban responden."
        actions={[
          <Button key="g" variant="secondary" icon="doc" onClick={() => setGuideOpen((v) => !v)}>
            {guideOpen ? "Tutup Panduan" : "Panduan"}
          </Button>,
          <Button key="r" variant="ghost" icon="refresh" onClick={reload}>
            Refresh
          </Button>,
          <Button key="n" icon="plus" onClick={() => setModal({})}>
            Buat Survei
          </Button>,
        ]}
      />
      {guideOpen ? <SurveyGuide /> : null}
      <Notice>{error || err}</Notice>

      {semua.length ? (
        <Card style={{ marginBottom: 16 }} pad={14}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,190px)",
              gap: 10,
              alignItems: "end",
            }}
          >
            <Input
              label="Cari survei"
              placeholder="Judul atau deskripsi"
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setHalaman(1);
              }}
              options={[
                { value: "", label: `Semua status (${semua.length})` },
                { value: "active", label: "Berjalan" },
                { value: "draft", label: "Draf" },
                { value: "closed", label: "Ditutup" },
              ]}
            />
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Loading />
      ) : surveys.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16 }}>
          {surveys.map((s) => (
            <Card
              key={s.id}
              style={{ display: "flex", flexDirection: "column" }}
              bodyStyle={{ display: "flex", flexDirection: "column", flex: 1 }}
            >
              {/* Judul memakai lebar penuh; badge turun ke bawahnya supaya judul panjang
                  tidak terdesak jadi banyak baris. */}
              <div style={{ fontWeight: 700, fontSize: 15.5, color: theme.text, lineHeight: 1.35 }}>{s.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <Badge tone={s.status === "active" ? "green" : s.status === "draft" ? "yellow" : "default"}>
                  {s.status}
                </Badge>
                {s.mode === "flow" ? <Badge tone="blue">flow</Badge> : null}
                {s.triggerEnabled ? <Badge tone="purple">bot</Badge> : null}
                {s.oncePerContact ? <Badge tone="yellow">sekali isi</Badge> : null}
              </div>
              {s.description ? (
                /* Dibatasi 2 baris — deskripsi panjang membuat tinggi kartu tak terduga,
                   dan seluruh baris grid ikut memanjang mengikuti yang tertinggi. */
                <div
                  title={s.description}
                  style={{
                    color: theme.textMuted,
                    fontSize: 12.5,
                    marginTop: 8,
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {s.description}
                </div>
              ) : null}
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                {s.questions.length} pertanyaan • {s.responses} respons
                {s.triggerEnabled && s.triggerKeywords?.length
                  ? ` • pemicu: ${s.triggerKeywords.slice(0, 3).join(", ")}${s.triggerKeywords.length > 3 ? "…" : ""}`
                  : ""}
              </div>
              {/* marginTop auto → baris tombol menempel di dasar kartu, sejajar antar kartu */}
              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 12, flexWrap: "wrap" }}>
                {/* Jumlahnya sudah tertulis di baris ringkasan di atas. Mengulangnya di
                    label membuat lebar tombol ikut membesar — "Respons (1240)" akan
                    memaksa baris tombol membungkus. */}
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setResponsesFor(s)}>
                  Respons
                </Button>
                <Button variant="secondary" size="sm" icon="eye" onClick={() => setPreviewFor(s)}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" icon="survey" onClick={() => setKuotaFor(s)}>
                  Kuota
                </Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(s)}>
                  Edit
                </Button>
                {/* Tanpa marginLeft:"auto" — di baris flex-wrap, margin auto menyerap
                    seluruh sisa ruang sehingga tombol ini terdorong ke baris kedua
                    padahal sebenarnya masih muat. */}
                <Button variant="danger" size="sm" icon="trash" title="Hapus survei" onClick={() => delSurvey(s)} />
              </div>
            </Card>
          ))}
        </div>
      ) : semua.length ? (
        <Card>
          <Empty
            icon="search"
            title="Tidak ada survei yang cocok"
            note="Ubah kata pencarian atau pilih status lain."
          />
        </Card>
      ) : (
        <Card>
          <Empty icon="survey" title="Belum ada survei" note="Buat survei lalu kirim lewat Broadcast." />
        </Card>
      )}

      {tersaring.length > PER_HALAMAN ? (
        <Card pad={0} style={{ marginTop: 16 }}>
          <Pagination
            page={curPage}
            pageCount={pageCount}
            pageSize={PER_HALAMAN}
            total={tersaring.length}
            start={start}
            onPage={setHalaman}
            noun="survei"
          />
        </Card>
      ) : null}

      {previewFor ? <SurveyPreviewModal survey={previewFor} onClose={() => setPreviewFor(null)} /> : null}
      {kuotaFor ? <SurveyKuotaModal survey={kuotaFor} onClose={() => setKuotaFor(null)} /> : null}
    </div>
  );
}
