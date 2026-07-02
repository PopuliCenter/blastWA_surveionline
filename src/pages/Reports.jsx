import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { exportResponses } from "../lib/exportSurvey";
import {
  PageHeader,
  Card,
  Button,
  Select,
  StatCard,
  Badge,
  Notice,
  Loading,
  Empty,
  useLoader,
  theme,
  Icon,
} from "../lib/ui";

const INTERNAL = new Set(["chatResolved", "chatResolvedAt", "notes"]);
const TYPE_LABEL = {
  text: "Teks",
  rating: "Rating",
  number: "Angka",
  choice: "Pilihan",
  boolean: "Ya/Tidak",
  image: "Gambar",
};
const PALETTE = [theme.primary, theme.green, theme.purple, theme.yellow, theme.red, "#0891b2", "#db2777", "#65a30d"];

function tally(values) {
  const m = new Map();
  values.forEach((v) => {
    const k = String(v);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function BarRow({ label, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 12.5,
          color: theme.text,
          marginBottom: 4,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ color: theme.textMuted, flexShrink: 0 }}>
          {count} • {pct}%
        </span>
      </div>
      <div style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color || theme.primary,
            borderRadius: 999,
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );
}

export default function Reports() {
  const surveys = useLoader(useCallback(() => api.listSurveys(), []));
  const [sid, setSid] = useState("");
  const [upper, setUpper] = useState(false);
  const list = surveys.data || [];
  const survey = list.find((s) => s.id === sid) || null;

  useEffect(() => {
    if (!sid && list.length) setSid(list[0].id);
  }, [list, sid]);

  const resp = useLoader(useCallback(() => (sid ? api.surveyResponses(sid) : Promise.resolve([])), [sid]));
  const responses = resp.data || [];

  const perResponse = useMemo(
    () =>
      responses.map((r) => {
        const m = {};
        (r.answers || []).forEach((a) => {
          m[a.question] = a.value;
        });
        return m;
      }),
    [responses],
  );

  const questions = survey?.questions || [];
  const total = responses.length;
  const completed = responses.filter((r) => r.completedAt).length;

  // Kolom pembobot yang tersedia
  const attrKeys = useMemo(() => {
    const s = new Set();
    responses.forEach((r) =>
      Object.keys(r.attributes || {}).forEach((k) => {
        if (!INTERNAL.has(k)) s.add(k);
      }),
    );
    return [...s];
  }, [responses]);
  const [demo, setDemo] = useState("");
  useEffect(() => {
    if (demo && !attrKeys.includes(demo)) setDemo("");
  }, [attrKeys, demo]);

  const demoTally = useMemo(
    () => (demo ? tally(responses.map((r) => r.attributes?.[demo]).filter((v) => v !== undefined && v !== "")) : []),
    [demo, responses],
  );

  // Tabulasi silang: pembobot (demo) × pertanyaan
  const [ctQ, setCtQ] = useState("");
  const crosstab = useMemo(() => {
    if (!demo || !ctQ) return null;
    const colSet = new Set();
    const rowMap = new Map();
    responses.forEach((r, idx) => {
      const dv = r.attributes?.[demo];
      if (dv === undefined || dv === "") return;
      const av = perResponse[idx]?.[ctQ];
      if (av === undefined || av === "") return;
      const D = String(dv),
        A = String(av);
      colSet.add(A);
      if (!rowMap.has(D)) rowMap.set(D, new Map());
      const rm = rowMap.get(D);
      rm.set(A, (rm.get(A) || 0) + 1);
    });
    return { cols: [...colSet], rows: [...rowMap.entries()] };
  }, [demo, ctQ, responses, perResponse]);

  if (surveys.loading)
    return (
      <div>
        <PageHeader title="Laporan" />
        <Loading />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Laporan Survei"
        subtitle="Ringkasan & analisis jawaban responden, termasuk pembobot demografi."
      />
      <Notice>{surveys.error || resp.error}</Notice>

      {!list.length ? (
        <Card>
          <Empty icon="report" title="Belum ada survei" note="Buat survei dulu untuk melihat laporan." />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Select
                  label="Pilih survei"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  options={list.map((s) => ({ value: s.id, label: `${s.title} (${s.responses} respons)` }))}
                  style={{ marginBottom: 0 }}
                />
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
                  icon="download"
                  onClick={() => survey && exportResponses(survey, responses, "xlsx", { upper })}
                  disabled={!total}
                >
                  Export Excel
                </Button>
                <Button
                  variant="secondary"
                  icon="download"
                  onClick={() => survey && exportResponses(survey, responses, "csv", { upper })}
                  disabled={!total}
                >
                  CSV
                </Button>
              </div>
            </div>
          </Card>

          {resp.loading ? (
            <Loading />
          ) : !total ? (
            <Card>
              <Empty icon="report" title="Belum ada respons" note="Survei ini belum punya jawaban masuk." />
            </Card>
          ) : (
            <>
              {/* Ringkasan */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <StatCard label="Total Responden" value={total} tone="blue" icon="contacts" />
                <StatCard
                  label="Selesai"
                  value={completed}
                  note={`${total ? Math.round((completed / total) * 100) : 0}% tingkat penyelesaian`}
                  tone="green"
                  icon="check"
                />
                <StatCard label="Pertanyaan" value={questions.length} tone="purple" icon="survey" />
                <StatCard
                  label="Kolom Pembobot"
                  value={attrKeys.length}
                  note={attrKeys.slice(0, 3).join(", ") || "—"}
                  tone="yellow"
                  icon="leads"
                />
              </div>

              {/* Distribusi pembobot */}
              <Card
                title="Distribusi Responden (Pembobot)"
                style={{ marginBottom: 16 }}
                actions={
                  <Select
                    value={demo}
                    onChange={(e) => setDemo(e.target.value)}
                    options={[
                      { value: "", label: attrKeys.length ? "Pilih pembobot…" : "Tidak ada pembobot" },
                      ...attrKeys.map((k) => ({ value: k, label: k })),
                    ]}
                    style={{ marginBottom: 0, minWidth: 180 }}
                  />
                }
              >
                {demo && demoTally.length ? (
                  <div style={{ maxWidth: 560 }}>
                    {demoTally.map(([val, cnt], i) => (
                      <BarRow key={val} label={val} count={cnt} total={total} color={PALETTE[i % PALETTE.length]} />
                    ))}
                  </div>
                ) : (
                  <div style={{ color: theme.textMuted, fontSize: 13 }}>
                    {attrKeys.length
                      ? "Pilih kolom pembobot untuk melihat distribusi."
                      : "Impor kontak dengan kolom pembobot (Kontak → Impor Massal) agar muncul di sini."}
                  </div>
                )}
              </Card>

              {/* Ringkasan jawaban per pertanyaan */}
              <Card title="Ringkasan Jawaban per Pertanyaan" style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gap: 18 }}>
                  {questions.map((q, qi) => {
                    const values = perResponse.map((m) => m[q.text]).filter((v) => v !== undefined && v !== "");
                    const answered = values.length;
                    return (
                      <div
                        key={q.id || qi}
                        style={{ borderTop: qi ? `1px solid ${theme.border}` : "none", paddingTop: qi ? 14 : 0 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: theme.text }}>
                            {qi + 1}. {q.text}
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <Badge tone="blue">{TYPE_LABEL[q.type] || q.type}</Badge>{" "}
                            <span style={{ color: theme.textMuted, fontSize: 11.5 }}>{answered} jawaban</span>
                          </div>
                        </div>
                        {answered === 0 ? (
                          <div style={{ color: theme.textMuted, fontSize: 12.5 }}>Belum ada jawaban.</div>
                        ) : (
                          <QuestionBreakdown q={q} values={values} total={answered} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Tabulasi silang */}
              <Card title="Tabulasi Silang (Pembobot × Pertanyaan)">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <Select
                    value={demo}
                    onChange={(e) => setDemo(e.target.value)}
                    options={[
                      { value: "", label: "Pilih pembobot…" },
                      ...attrKeys.map((k) => ({ value: k, label: k })),
                    ]}
                    style={{ marginBottom: 0, minWidth: 170 }}
                  />
                  <Select
                    value={ctQ}
                    onChange={(e) => setCtQ(e.target.value)}
                    options={[
                      { value: "", label: "Pilih pertanyaan…" },
                      ...questions.map((q) => ({ value: q.text, label: q.text.slice(0, 40) })),
                    ]}
                    style={{ marginBottom: 0, minWidth: 200 }}
                  />
                </div>
                {crosstab && crosstab.rows.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", minWidth: 360 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{demo} \ Jawaban</th>
                          {crosstab.cols.map((c) => (
                            <th key={c} style={thStyle}>
                              {c}
                            </th>
                          ))}
                          <th style={thStyle}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crosstab.rows.map(([rv, rm]) => {
                          const rowTotal = [...rm.values()].reduce((a, b) => a + b, 0);
                          return (
                            <tr key={rv}>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{rv}</td>
                              {crosstab.cols.map((c) => (
                                <td key={c} style={tdStyle}>
                                  {rm.get(c) || 0}
                                </td>
                              ))}
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{rowTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: theme.textMuted, fontSize: 12.5 }}>
                    Pilih pembobot & pertanyaan untuk melihat tabulasi silang.
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: `2px solid ${theme.border}`,
  color: theme.textMuted,
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const tdStyle = { padding: "7px 12px", borderBottom: `1px solid ${theme.border}`, color: theme.text };

function QuestionBreakdown({ q, values, total }) {
  if (q.type === "rating" || q.type === "number") {
    const nums = values.map(Number).filter((n) => Number.isFinite(n));
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    const dist = tally(values);
    return (
      <div>
        <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
          <Stat label="Rata-rata" value={avg.toFixed(2)} />
          <Stat label="Min" value={min} />
          <Stat label="Maks" value={max} />
        </div>
        <div style={{ maxWidth: 560 }}>
          {dist
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([v, c], i) => (
              <BarRow key={v} label={v} count={c} total={total} color={PALETTE[i % PALETTE.length]} />
            ))}
        </div>
      </div>
    );
  }
  if (q.type === "choice" || q.type === "boolean") {
    const dist = tally(values);
    return (
      <div style={{ maxWidth: 560 }}>
        {dist.map(([v, c], i) => (
          <BarRow key={v} label={v} count={c} total={total} color={PALETTE[i % PALETTE.length]} />
        ))}
      </div>
    );
  }
  // text / image: tampilkan beberapa contoh
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {values.slice(0, 8).map((v, i) => (
        <div
          key={i}
          style={{
            background: theme.surfaceAlt,
            borderRadius: 8,
            padding: "7px 11px",
            fontSize: 12.5,
            color: theme.text,
          }}
        >
          {v}
        </div>
      ))}
      {values.length > 8 ? (
        <div style={{ color: theme.textMuted, fontSize: 12 }}>
          …dan {values.length - 8} jawaban lain (lihat export untuk lengkap).
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>{value}</div>
    </div>
  );
}
