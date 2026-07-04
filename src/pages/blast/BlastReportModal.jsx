import { useCallback } from "react";
import { api } from "../../lib/api";
import { Modal, Notice, Loading, Button, useLoader, theme, fmtDate } from "../../lib/ui";

// Laporan rinci 1 blast: total penerima, rincian status, daftar nomor gagal + ekspor.
export function BlastReportModal({ blast, onClose }) {
  const { data, loading, error } = useLoader(useCallback(() => api.blastReport(blast.id), [blast.id]));
  const t = data?.totals;
  const pct = (n) => (t?.recipients ? Math.round((n / t.recipients) * 100) : 0);

  const exportFailed = async () => {
    const XLSX = await import("xlsx");
    const rows = (data?.failed || []).map((f) => ({
      Nomor: f.phone,
      Nama: f.name || "",
      Alasan: f.error,
      Waktu: f.updatedAt,
    }));
    const ws = XLSX.utils.json_to_sheet(
      rows.length ? rows : [{ Nomor: "", Nama: "", Alasan: "(tidak ada yang gagal)", Waktu: "" }],
    );
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
      {loading ? (
        <Loading />
      ) : data ? (
        <div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 14 }}>
            {data.surveyTitle ? (
              <span>
                <strong style={{ color: theme.text }}>{data.surveyTitle}</strong> •{" "}
              </span>
            ) : null}
            Segmen {data.segmentName || "-"} • vendor {data.vendor} • status {data.status} • {fmtDate(data.createdAt)}
            {data.messageText ? (
              <div style={{ marginTop: 6, background: theme.surfaceAlt, borderRadius: 8, padding: "8px 11px" }}>
                {data.messageText}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))",
              gap: 10,
              marginBottom: 6,
            }}
          >
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
            <div
              style={{
                fontSize: 12,
                color: theme.yellow,
                background: theme.yellowSoft,
                borderRadius: 8,
                padding: "8px 11px",
                marginBottom: 14,
              }}
            >
              Catatan: status "Sampai/Dibaca" untuk WhatsApp Langsung bergantung pada tanda terima yang dikirim
              WhatsApp; bisa terlambat atau tidak muncul untuk sebagian penerima.
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>Nomor gagal ({data.failed.length})</span>
            <Button variant="secondary" size="sm" icon="download" onClick={exportFailed} disabled={!data.failed.length}>
              Ekspor Excel
            </Button>
          </div>
          {data.failed.length ? (
            <div style={{ maxHeight: 240, overflow: "auto", border: `1px solid ${theme.border}`, borderRadius: 9 }}>
              {data.failed.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 11px",
                    borderTop: i ? `1px solid ${theme.border}` : "none",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: theme.text, fontWeight: 600, fontFamily: "monospace" }}>
                    {f.phone}
                    {f.name ? ` · ${f.name}` : ""}
                  </span>
                  <span style={{ color: theme.red, textAlign: "right", maxWidth: "60%" }}>{f.error}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: 12.5 }}>Tidak ada penerima yang gagal. 🎉</div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
