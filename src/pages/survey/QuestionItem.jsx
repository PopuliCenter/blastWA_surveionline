import { useState } from "react";
import { Button, Badge, Input, Textarea, Select, Toggle, theme } from "../../lib/ui";
import { TYPE_LABEL, QTYPE_OPTIONS, HAS_CHOICES, qSummary } from "./constants";

// Satu pertanyaan: mode lihat (bisa naik/turun, edit, hapus) & mode edit inline.
export function QuestionItem({
  q,
  index,
  total,
  onChange,
  onDelete,
  onMove,
  qtypeOptions = QTYPE_OPTIONS,
  allQuestions = [],
  flowMode = false,
}) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(null);
  const setDk = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const startEdit = () => {
    const branchMap = {};
    (q.options?.branches || []).forEach((b) => {
      branchMap[b.value] = String(b.goto);
    });
    setD({
      text: q.text || "",
      type: q.type || "text",
      required: q.required ?? true,
      min: q.options?.min ?? 1,
      max: q.options?.max ?? 5,
      minLabel: q.options?.minLabel ?? "",
      maxLabel: q.options?.maxLabel ?? "",
      choices: (q.options?.choices || []).join("\n"),
      branches: branchMap,
      newScreen: q.options?.newScreen === true,
      screenTitle: q.options?.screenTitle ?? "",
    });
    setEditing(true);
  };
  const saveEdit = () => {
    let options;
    if (d.type === "rating") {
      options = { min: Number(d.min) || 1, max: Number(d.max) || 5 };
      if (d.minLabel.trim() || d.maxLabel.trim())
        options = { ...options, minLabel: d.minLabel.trim(), maxLabel: d.maxLabel.trim() };
    }
    if (HAS_CHOICES(d.type))
      options = {
        choices: d.choices
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    // Skip logic: kumpulkan aturan percabangan dari jawaban → target.
    if (d.type === "choice" || d.type === "boolean") {
      const vals = d.type === "boolean" ? ["Ya", "Tidak"] : options?.choices || [];
      const branches = [];
      for (const v of vals) {
        const g = d.branches?.[v];
        if (g && g !== "") branches.push({ value: v, goto: g === "end" ? "end" : Number(g) });
      }
      if (branches.length) options = { ...(options || {}), branches };
    }
    // Penanda seksi (mode Flow) — dipertahankan lintas edit, jangan sampai ikut terhapus.
    if (d.newScreen) options = { ...(options || {}), newScreen: true };
    if (d.screenTitle?.trim()) options = { ...(options || {}), screenTitle: d.screenTitle.trim() };
    onChange({ ...q, text: d.text.trim(), type: d.type, required: d.required, options });
    setEditing(false);
  };

  // Nilai jawaban yang bisa dicabangkan + daftar target (pertanyaan setelahnya / Selesai).
  const branchValues = d
    ? d.type === "boolean"
      ? ["Ya", "Tidak"]
      : d.choices
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
    : [];
  const targetOptions = [
    { value: "", label: "→ lanjut normal" },
    { value: "end", label: "→ Selesai survei" },
    ...allQuestions
      .map((qq, i) =>
        i > index
          ? {
              value: String(i),
              label: `→ ${i + 1}. ${(qq.text || "").slice(0, 28)}${(qq.text || "").length > 28 ? "…" : ""}`,
            }
          : null,
      )
      .filter(Boolean),
  ];

  if (editing) {
    return (
      <div style={{ background: theme.surface, border: `1.5px solid ${theme.primary}`, borderRadius: 9, padding: 12 }}>
        <Input
          label={`Pertanyaan ${index + 1}`}
          value={d.text}
          onChange={(e) => setDk("text", e.target.value)}
          placeholder="Teks pertanyaan"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <Select
            label="Tipe jawaban"
            value={d.type}
            onChange={(e) => setDk("type", e.target.value)}
            options={qtypeOptions}
          />
          <div style={{ marginBottom: 14 }}>
            <Toggle checked={d.required} onChange={(v) => setDk("required", v)} label="Wajib" />
          </div>
        </div>
        {d.type === "rating" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Nilai minimum" type="number" value={d.min} onChange={(e) => setDk("min", e.target.value)} />
              <Input
                label="Nilai maksimum"
                type="number"
                value={d.max}
                onChange={(e) => setDk("max", e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Label minimum (opsional)"
                value={d.minLabel}
                onChange={(e) => setDk("minLabel", e.target.value)}
                placeholder="cth: Sangat tidak puas"
              />
              <Input
                label="Label maksimum (opsional)"
                value={d.maxLabel}
                onChange={(e) => setDk("maxLabel", e.target.value)}
                placeholder="cth: Sangat puas"
              />
            </div>
          </>
        ) : null}
        {HAS_CHOICES(d.type) ? (
          <Textarea
            label={
              d.type === "multichoice"
                ? "Pilihan (boleh dipilih >1; satu per baris atau pisah koma)"
                : "Pilihan (satu per baris atau pisah koma)"
            }
            value={d.choices}
            onChange={(e) => setDk("choices", e.target.value)}
            placeholder={"Sangat puas\nPuas\nBiasa\nTidak puas"}
          />
        ) : null}
        {(d.type === "choice" || d.type === "boolean") && branchValues.length ? (
          <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: 11, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>Skip logic (opsional)</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, margin: "3px 0 9px", lineHeight: 1.5 }}>
              Berdasarkan jawaban, lompat ke pertanyaan lain atau akhiri survei. Hanya lompat <strong>maju</strong>. Cek
              ulang bila urutan pertanyaan diubah.
              {flowMode ? (
                <>
                  {" "}
                  <strong style={{ color: theme.yellow }}>
                    Di Flow, pertanyaan yang dilewati disembunyikan — tapi LAYAR tidak bisa dilompati.
                  </strong>{" "}
                  Agar mulus, taruh pertanyaan pemicu dan pertanyaan yang dilewatinya di{" "}
                  <strong>layar/seksi yang sama</strong>.
                </>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 7 }}>
              {branchValues.map((v) => (
                <div
                  key={v}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(70px,110px) 1fr",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: theme.text,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={v}
                  >
                    Jika “{v}”
                  </span>
                  <Select
                    value={d.branches?.[v] || ""}
                    onChange={(e) => setDk("branches", { ...(d.branches || {}), [v]: e.target.value })}
                    options={targetOptions}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {flowMode ? (
          <div style={{ background: theme.surfaceAlt, borderRadius: 9, padding: 11, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>Penanda seksi (mode Flow)</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, margin: "3px 0 9px", lineHeight: 1.5 }}>
              Mulai <strong>layar baru</strong> dari pertanyaan ini. Bila tidak ditandai, Flow tetap dipecah otomatis
              sesuai &quot;Pertanyaan per layar&quot;.
            </div>
            <Toggle
              checked={d.newScreen}
              onChange={(v) => setDk("newScreen", v)}
              label="Mulai layar baru di sini"
            />
            {d.newScreen ? (
              <div style={{ marginTop: 10 }}>
                <Input
                  label="Judul seksi (opsional)"
                  value={d.screenTitle}
                  onChange={(e) => setDk("screenTitle", e.target.value)}
                  placeholder="cth: Data Demografi"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Batal
          </Button>
          <Button size="sm" icon="check" onClick={saveEdit} disabled={!d.text.trim()}>
            Simpan Pertanyaan
          </Button>
        </div>
      </div>
    );
  }

  const startsScreen = flowMode && q.options?.newScreen === true;

  return (
    <div
      style={{
        background: theme.surfaceAlt,
        borderRadius: 9,
        padding: "10px 12px",
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        // Garis atas = batas layar baru di Flow
        borderTop: startsScreen ? `2px solid ${theme.primary}` : undefined,
      }}
    >
      <div style={{ fontSize: 13, color: theme.text, minWidth: 0 }}>
        {startsScreen ? (
          <div style={{ marginBottom: 4 }}>
            <Badge tone="purple">
              ⤵ layar baru{q.options?.screenTitle ? ` — ${q.options.screenTitle}` : ""}
            </Badge>
          </div>
        ) : null}
        {index + 1}. {q.text}
        <span style={{ marginLeft: 8 }}>
          <Badge tone="blue">{TYPE_LABEL[q.type] || q.type}</Badge>
        </span>
        {qSummary(q) ? (
          <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>{qSummary(q)}</span>
        ) : null}
        {!q.required ? <span style={{ color: theme.textMuted, fontSize: 11.5, marginLeft: 6 }}>• opsional</span> : null}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <Button variant="ghost" size="sm" icon="up" onClick={() => onMove(-1)} disabled={index === 0} title="Naikkan" />
        <Button
          variant="ghost"
          size="sm"
          icon="down"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          title="Turunkan"
        />
        <Button variant="secondary" size="sm" icon="edit" onClick={startEdit} title="Edit" />
        <Button variant="danger" size="sm" icon="trash" onClick={onDelete} title="Hapus" />
      </div>
    </div>
  );
}
