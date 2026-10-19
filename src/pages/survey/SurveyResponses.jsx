import { useCallback, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { exportResponses, ditolakKuota, ditolakKarenaDitutup, labelStatusLokasi } from "../../lib/exportSurvey";
import { confirmDialog } from "../../lib/confirm";
import {
  Button,
  Badge,
  Notice,
  Loading,
  Empty,
  Icon,
  StatStrip,
  useLoader,
  useSelection,
  useIsMobile,
  Checkbox,
  BulkBar,
  theme,
  card,
  fmtDate,
} from "../../lib/ui";

const PER_PAGE_OPTIONS = [25, 50, 100, 200];
const STATUS_TABS = [
  { id: "all", label: "Semua" },
  { id: "done", label: "Selesai" },
  { id: "ongoing", label: "Berlangsung" },
  // Hanya muncul bila ada isinya: yang ditolak karena kuota penuh, dan yang masuk setelah
  // survei ditutup. Tidak ikut tab lain — dan karena ekspor mengikuti apa yang tampil, tidak
  // pula ikut berkas — tapi tetap bisa dilihat dan dihapus.
  { id: "kuota", label: "Ditolak" },
  // Juga hanya bila ada isinya: responden yang lokasinya berada di provinsi LAIN dari yang
  // ia sebut — kandidat untuk diperiksa ulang, bukan otomatis dibuang (orang bisa saja
  // sedang bepergian saat membagikan lokasi).
  { id: "lokasi-beda", label: "Beda provinsi" },
];

const lokasiBeda = (r) => !ditolakKuota(r) && r.statusLokasi === "tidak-sesuai";

// Cocokkan kata kunci ke nama, nomor, atau nilai atribut kontak.
function matches(r, q) {
  if (!q) return true;
  const hay = [r.name, r.phone, ...Object.values(r.attributes || {})].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

/**
 * Daftar respons survei — halaman penuh, bukan modal.
 * Satu survei bisa mengumpulkan ribuan responden, jadi yang menentukan bukan cuma
 * ruang layar: tanpa pencarian dan saringan, daftar sepanjang itu tidak menjawab
 * pertanyaan apa pun. Ekspor selalu mengikuti apa yang sedang tampil.
 */
export function SurveyResponses({ survey, onClose }) {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.surveyResponses(survey.id), [survey.id]));
  const responses = useMemo(() => data || [], [data]);

  const [q, setQ] = useState("");
  const [statusDipilih, setStatus] = useState("all");
  const [upper, setUpper] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [delErr, setDelErr] = useState("");
  const sel = useSelection();

  const tolakCount = useMemo(() => responses.filter(ditolakKuota).length, [responses]);
  // Dua sebab di tab "Ditolak": kuota penuh, atau masuk setelah survei ditutup. Penjelasan
  // dan cara memulihkannya berbeda, jadi keduanya dihitung terpisah.
  const ditutupCount = useMemo(() => responses.filter(ditolakKarenaDitutup).length, [responses]);
  const kuotaCount = tolakCount - ditutupCount;
  const doneCount = useMemo(() => responses.filter((r) => r.completedAt && !ditolakKuota(r)).length, [responses]);
  // Tab "Ditolak" hilang begitu isinya habis dihapus — jangan tinggalkan pemakai di
  // tab yang tak lagi terlihat dengan daftar kosong.
  const bedaCount = useMemo(() => responses.filter(lokasiBeda).length, [responses]);
  const status =
    (statusDipilih === "kuota" && !tolakCount) || (statusDipilih === "lokasi-beda" && !bedaCount)
      ? "all"
      : statusDipilih;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return responses.filter((r) => {
      if (status === "kuota") return ditolakKuota(r) && matches(r, needle);
      if (ditolakKuota(r)) return false;
      if (status === "lokasi-beda" && !lokasiBeda(r)) return false;
      if (status === "done" && !r.completedAt) return false;
      if (status === "ongoing" && r.completedAt) return false;
      return matches(r, needle);
    });
  }, [responses, q, status]);
  // Yang ditolak kuota memang tidak pernah masuk berkas. Di tab mereka sendiri tombol
  // ekspornya menunjukkan 0, bukan jumlah baris yang tampil, supaya tidak menjanjikan isi.
  const untukEkspor = status === "kuota" ? [] : filtered;
  const tabs = STATUS_TABS.filter((t) => (t.id === "kuota" ? tolakCount : t.id === "lokasi-beda" ? bedaCount : true));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const curPage = Math.min(page, pageCount); // daftar bisa menyusut setelah hapus / saring
  const start = (curPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // Setiap perubahan saringan mengembalikan ke halaman 1 — kalau tidak, hasil
  // pencarian bisa tampak kosong hanya karena masih berada di halaman jauh.
  const setFilter = (fn) => {
    fn();
    setPage(1);
  };

  const toggleExpand = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allExpanded = pageItems.length > 0 && pageItems.every((r) => expanded.has(r.id));
  const toggleAllExpand = () =>
    setExpanded((s) => {
      const n = new Set(s);
      pageItems.forEach((r) => (allExpanded ? n.delete(r.id) : n.add(r.id)));
      return n;
    });

  const bulkDelete = async () => {
    if (!sel.size) return;
    if (
      !(await confirmDialog({
        title: "Hapus responden",
        message: `Hapus ${sel.size} responden terpilih? Jawaban mereka ikut terhapus permanen.`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    setBulkBusy(true);
    setDelErr("");
    try {
      await api.bulkDeleteResponses(sel.list());
      sel.clear();
      await reload();
    } catch (e) {
      setDelErr(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteOne = async (r) => {
    if (
      !(await confirmDialog({
        title: "Hapus respons",
        message: `Hapus respons dari ${r.name || r.phone}? Jawabannya terhapus permanen. (mis. tertukar setelah revisi soal)`,
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    setBusyId(r.id);
    setDelErr("");
    try {
      await api.bulkDeleteResponses([r.id]);
      await reload();
    } catch (e) {
      setDelErr(e.message);
    } finally {
      setBusyId("");
    }
  };

  const menyaring = Boolean(q.trim()) || status !== "all";
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => sel.has(r.id));

  return (
    <div>
      {/* Bilah atas lengket — ekspor & tombol kembali selalu terjangkau walau daftarnya panjang. */}
      <div
        style={{
          position: "sticky",
          top: isMobile ? 48 : 0,
          zIndex: 30,
          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
          padding: isMobile ? "10px 0" : "14px 0",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" icon="back" onClick={onClose}>
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
            title={survey.title}
          >
            {survey.title}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Jawaban responden</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: theme.textMuted,
              cursor: "pointer",
            }}
            title="Ubah semua nilai jadi huruf kapital saat ekspor"
          >
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> HURUF KAPITAL
          </label>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => exportResponses(survey, untukEkspor, "xlsx", { upper })}
            disabled={!untukEkspor.length}
          >
            Excel ({untukEkspor.length})
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => exportResponses(survey, untukEkspor, "csv", { upper })}
            disabled={!untukEkspor.length}
          >
            CSV
          </Button>
        </div>
      </div>

      <Notice>{error || delErr}</Notice>

      <div style={{ marginBottom: 16 }}>
        <StatStrip
          items={[
            { label: "Responden", value: responses.length, tone: "blue" },
            { label: "Selesai", value: doneCount, tone: "green" },
            { label: "Berlangsung", value: responses.length - doneCount - tolakCount, tone: "yellow" },
            // Hanya bila ada — supaya ketiga angka di atas tetap menjumlah ke "Responden".
            ...(tolakCount ? [{ label: "Ditolak", value: tolakCount, tone: "red" }] : []),
            { label: "Pertanyaan", value: survey.questions?.length ?? 0, tone: "purple" },
          ]}
        />
      </div>

      {/* Pencarian & saringan */}
      <div style={{ ...card, padding: 12, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: theme.textMuted,
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setFilter(() => setQ(e.target.value))}
            placeholder="Cari nama, nomor, atau pembobot…"
            aria-label="Cari responden"
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              background: theme.surface,
              color: theme.text,
            }}
          />
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 4,
            background: theme.surfaceAlt,
            padding: 4,
            borderRadius: 11,
          }}
        >
          {tabs.map((t) => {
            const on = status === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(() => setStatus(t.id))}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: on ? theme.surface : "transparent",
                  color: on ? theme.primary : theme.textMuted,
                  boxShadow: on ? "0 1px 2px rgba(16,24,40,0.10)" : "none",
                  // Tab yang tidak muat pindah utuh ke baris berikutnya, bukan diperas
                  // jadi label dua baris.
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {pageItems.length ? (
          <Button variant="secondary" size="sm" icon={allExpanded ? "up" : "down"} onClick={toggleAllExpand}>
            {allExpanded ? "Tutup semua" : "Buka semua"}
          </Button>
        ) : null}
      </div>

      {status === "kuota" ? (
        <Notice kind="info">
          {kuotaCount && ditutupCount
            ? "Responden ini datang saat kuotanya sudah penuh, atau mengirim jawaban setelah survei ditutup. "
            : ditutupCount
              ? "Responden ini mengirim jawaban setelah survei ditutup. "
              : "Responden ini datang saat kuotanya sudah penuh. "}
          Jawabannya disimpan, tetapi <strong>tidak dihitung</strong> dan <strong>tidak ikut</strong> berkas Excel, CSV,
          maupun Google Sheets.
          {kuotaCount
            ? " Bila kuotanya dinaikkan, yang ditolak kuota dan jawabannya lengkap bisa dipulihkan dengan skrip "
            : null}
          {kuotaCount ? <code>pulihkan:kuota</code> : null}
          {kuotaCount ? "." : null}
          {ditutupCount
            ? ` Yang bertanda "setelah ditutup" baru bisa dipulihkan${kuotaCount ? " dengan skrip yang sama" : " dengan skrip pulihkan:kuota"} bila surveinya dibuka lagi.`
            : null}
        </Notice>
      ) : null}

      <BulkBar
        count={sel.size}
        total={filtered.length}
        allSelected={allFilteredSelected}
        noun="responden"
        busy={bulkBusy}
        onToggleAll={() => (allFilteredSelected ? sel.clear() : sel.setAll(filtered.map((r) => r.id)))}
        onClear={sel.clear}
        onDelete={bulkDelete}
      />

      {loading ? (
        <Loading />
      ) : !responses.length ? (
        <div style={{ ...card, padding: 18 }}>
          <Empty icon="survey" title="Belum ada respons" note="Kirim survei lewat Broadcast atau kata kunci pemicu." />
        </div>
      ) : !filtered.length ? (
        <div style={{ ...card, padding: 18 }}>
          {/* Tanpa saringan apa pun tapi daftar kosong = semua isinya ditolak kuota. Jangan
              menyuruh memilih "Semua" kepada orang yang sudah berada di tab itu. */}
          {!menyaring && tolakCount ? (
            <Empty
              icon="survey"
              title="Belum ada respons yang dihitung"
              note={`Semua ${tolakCount} responden ${
                kuotaCount && ditutupCount
                  ? "ditolak karena kuotanya penuh atau masuk setelah survei ditutup"
                  : ditutupCount
                    ? "masuk setelah survei ditutup"
                    : "datang saat kuotanya sudah penuh"
              }. Lihat tab "Ditolak".`}
            />
          ) : (
            <Empty
              icon="survey"
              title="Tidak ada yang cocok"
              note={`Tidak ada responden yang cocok dengan saringan ini. Coba kata kunci lain atau pilih "Semua".`}
            />
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr)" }}>
          {pageItems.map((r) => {
            const open = expanded.has(r.id);
            return (
              <div
                key={r.id}
                style={{
                  ...card,
                  padding: "10px 12px",
                  outline: sel.has(r.id) ? `2px solid ${theme.primary}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Checkbox checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} />
                  {/* Satu baris padat: nama, nomor, waktu — supaya lebih banyak muat per layar. */}
                  <button
                    onClick={() => toggleExpand(r.id)}
                    aria-expanded={open}
                    title={open ? "Tutup jawaban" : "Lihat jawaban"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      minWidth: 0,
                      flex: 1,
                      textAlign: "left",
                      color: theme.text,
                      fontFamily: "inherit",
                    }}
                  >
                    <Icon name={open ? "up" : "down"} size={15} />
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: isMobile ? 130 : 240,
                      }}
                    >
                      {r.name || r.phone}
                    </span>
                    {!isMobile ? (
                      <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {r.phone} • {fmtDate(r.startedAt)}
                      </span>
                    ) : null}
                    <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>
                      {r.answers.length} jawaban
                    </span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Di ponsel badge ini pindah ke baris kedua: di baris judul ia memeras nama
                        responden sampai tinggal satu huruf. */}
                    {lokasiBeda(r) && !isMobile ? <Badge tone="yellow">beda provinsi</Badge> : null}
                    {ditolakKarenaDitutup(r) ? (
                      <Badge tone="default">setelah ditutup</Badge>
                    ) : ditolakKuota(r) ? (
                      <Badge tone="red">ditolak kuota</Badge>
                    ) : (
                      <Badge tone={r.completedAt ? "green" : "yellow"}>
                        {r.completedAt ? "selesai" : "berlangsung"}
                      </Badge>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash"
                      title="Hapus respons"
                      onClick={() => deleteOne(r)}
                      disabled={busyId === r.id}
                    />
                  </div>
                </div>
                {isMobile ? (
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: 11.5,
                      marginTop: 6,
                      marginLeft: 26,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      {r.phone} • {fmtDate(r.startedAt)}
                    </span>
                    {lokasiBeda(r) ? <Badge tone="yellow">beda provinsi</Badge> : null}
                  </div>
                ) : null}
                {open ? (
                  <div style={{ marginTop: 10, marginLeft: 26 }}>
                    {r.answers.length ? (
                      r.answers.map((a, i) => (
                        <div
                          key={i}
                          style={{ borderLeft: `3px solid ${theme.green}`, paddingLeft: 11, marginBottom: 8 }}
                        >
                          <div style={{ fontSize: 12, color: theme.textMuted }}>{a.question}</div>
                          <div style={{ fontSize: 13.5, color: theme.text }}>{a.value}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: theme.textMuted, fontSize: 12 }}>Belum ada jawaban.</div>
                    )}
                    {r.statusLokasi && r.statusLokasi !== "tidak-diminta" ? (
                      <div style={{ borderLeft: `3px solid ${theme.primary}`, paddingLeft: 11, marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: theme.textMuted }}>Lokasi</div>
                        <div style={{ fontSize: 13.5, color: theme.text }}>
                          {r.lokasi?.provinsi ? `${r.lokasi.provinsi} — ` : ""}
                          {labelStatusLokasi(r.statusLokasi)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {total > PER_PAGE_OPTIONS[0] ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>
            Menampilkan {start + 1}–{Math.min(start + perPage, total)} dari {total}
            {menyaring ? ` (disaring dari ${responses.length})` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select
              value={perPage}
              onChange={(e) => setFilter(() => setPerPage(Number(e.target.value)))}
              aria-label="Jumlah per halaman"
              style={{
                padding: "6px 9px",
                border: `1px solid ${theme.border}`,
                borderRadius: 8,
                background: theme.surface,
                color: theme.text,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / halaman
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon="back"
              onClick={() => setPage(curPage - 1)}
              disabled={curPage <= 1}
            >
              Sebelumnya
            </Button>
            <span style={{ fontSize: 12.5, color: theme.textMuted, minWidth: 78, textAlign: "center" }}>
              Hal. {curPage} / {pageCount}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage(curPage + 1)} disabled={curPage >= pageCount}>
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
