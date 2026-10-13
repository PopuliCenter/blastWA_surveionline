import { useState } from "react";
import { Button, Badge, Input, Textarea, Select, Toggle, theme } from "../../lib/ui";
import { TYPE_LABEL, QTYPE_OPTIONS, HAS_CHOICES, qSummary } from "./constants";
import { cabangTakBerlaku, indeksTujuan } from "./daftarPertanyaan";

// Kunci tujuan percabangan selama formulir sunting terbuka: ID pertanyaan, bukan urutannya.
//
// Tersimpan, percabangan menunjuk lewat INDEKS. Tapi daftar bisa berubah susunan selagi
// formulir ini terbuka — pertanyaan lain digandakan, dihapus, atau digeser — dan indeks
// yang dipegang formulir sejak dibuka akan menunjuk pertanyaan yang salah begitu disimpan.
// ID tidak bergeser; diterjemahkan kembali ke indeks TERKINI saat Simpan Pertanyaan.
const kunciTujuan = (qq, i) => qq?.id ?? `#${i}`;

// Isian formulir sunting dari sebuah pertanyaan.
function draftDari(q, allQuestions) {
  const branchMap = {};
  (q.options?.branches || []).forEach((b) => {
    const g = indeksTujuan(b.goto);
    // "end" dan -1 sama-sama mengakhiri survei. -1 hanya bisa datang dari data lama atau
    // API — disimpan ulang sebagai "end" supaya aturan penyaringnya tidak hilang.
    if (g === null) {
      if (b.goto === "end" || Number(b.goto) === -1) branchMap[b.value] = "end";
    } else if (allQuestions[g]) branchMap[b.value] = kunciTujuan(allQuestions[g], g);
  });
  return {
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
    tingkat: q.options?.tingkat === "kabkota" ? "kabkota" : "provinsi",
  };
}

// Satu pertanyaan: mode lihat (bisa naik/turun, gandakan, edit, hapus) & mode edit inline.
export function QuestionItem({
  q,
  index,
  total,
  onChange,
  onDelete,
  onMove,
  onDuplicate,
  // Dipanggil saat formulir sunting dibuka/ditutup — builder menahan "Simpan Survei"
  // selama masih ada formulir yang terbuka, karena isinya belum masuk daftar pertanyaan.
  onSunting,
  // Langsung terbuka dalam mode sunting — dipakai salinan yang baru dibuat, karena
  // menggandakan hampir selalu diikuti mengubah sedikit isinya.
  mulaiEdit = false,
  qtypeOptions = QTYPE_OPTIONS,
  allQuestions = [],
  flowMode = false,
}) {
  const [editing, setEditing] = useState(mulaiEdit);
  const [d, setD] = useState(() => (mulaiEdit ? draftDari(q, allQuestions) : null));
  const setDk = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const tutupSunting = () => {
    setEditing(false);
    onSunting?.(false);
  };
  // Tujuan aturan untuk jawaban `v` menurut formulir — dengan satu koreksi. Bila pertanyaan
  // tujuannya DIHAPUS selagi formulir ini terbuka, daftar pertanyaan sudah mengalihkan
  // aturan tersimpannya ke pertanyaan penerus (hapusPertanyaan). Ikuti pengalihan itu;
  // kalau tidak, pilihan tampil "lanjut normal" dan aturannya hilang diam-diam saat disimpan.
  const tujuanFormulir = (v) => {
    const g = d?.branches?.[v];
    if (!g || g === "end") return g || "";
    if (allQuestions.some((qq, i) => kunciTujuan(qq, i) === g)) return g;
    const tersimpan = indeksTujuan((q.options?.branches || []).find((b) => b.value === v)?.goto);
    return tersimpan !== null && allQuestions[tersimpan] ? kunciTujuan(allQuestions[tersimpan], tersimpan) : "";
  };

  const startEdit = () => {
    onSunting?.(true);
    setD(draftDari(q, allQuestions));
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
        const g = tujuanFormulir(v);
        if (!g) continue;
        if (g === "end") {
          branches.push({ value: v, goto: "end" });
          continue;
        }
        // Indeks TERKINI dari pertanyaan tujuan. Yang kini ada di atas pertanyaan ini (atau
        // sudah dihapus) tidak disimpan: mesin hanya melompat maju, jadi aturan itu tidak
        // akan pernah berlaku.
        const idx = allQuestions.findIndex((qq, i) => kunciTujuan(qq, i) === g);
        if (idx > index) branches.push({ value: v, goto: idx });
      }
      if (branches.length) options = { ...(options || {}), branches };
    }
    // Tingkat wilayah. Hanya ditulis bila BUKAN bawaan: options yang hanya berisi nilai
    // bawaan menambah derau pada data tanpa mengubah perilaku apa pun.
    if (d.type === "wilayah" && d.tingkat === "kabkota") options = { ...(options || {}), tingkat: "kabkota" };
    // Penanda seksi (mode Flow) — dipertahankan lintas edit, jangan sampai ikut terhapus.
    if (d.newScreen) options = { ...(options || {}), newScreen: true };
    if (d.screenTitle?.trim()) options = { ...(options || {}), screenTitle: d.screenTitle.trim() };
    onChange({ ...q, text: d.text.trim(), type: d.type, required: d.required, options });
    tutupSunting();
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
              value: kunciTujuan(qq, i),
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
        {d.type === "wilayah" ? (
          <>
            <Select
              label="Tingkat wilayah"
              value={d.tingkat}
              onChange={(e) => setDk("tingkat", e.target.value)}
              options={[
                { value: "provinsi", label: "Provinsi saja" },
                { value: "kabkota", label: "Sampai kabupaten/kota" },
              ]}
              hint={
                d.tingkat === "kabkota"
                  ? "Responden memilih provinsi dulu, lalu kabupaten/kota. Satu langkah lebih panjang."
                  : "Cukup untuk kuota, pembobotan, dan pelaporan. Satu langkah bagi responden."
              }
            />
            <div
              style={{
                background: theme.primarySoft,
                color: theme.primary,
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              Pilihannya memakai daftar resmi Kepmendagri — 38 provinsi dan 514 kabupaten/kota — jadi tidak perlu diisi
              sendiri. Daftar ini <strong>sama persis</strong> dengan yang dipakai Kuota per provinsi, sehingga jawaban
              responden langsung terhitung ke kuota wilayahnya tanpa perlu dicocokkan manual.
              <div style={{ marginTop: 7 }}>
                Mode <strong>Chatbot</strong>: responden mengetik namanya, lalu dicocokkan ke daftar — termasuk sebutan
                sehari-hari seperti &quot;Jogja&quot; atau &quot;DKI&quot;. Mode <strong>Flow</strong>: dipilih dari
                dropdown.
              </div>
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
                    value={tujuanFormulir(v)}
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
            <Toggle checked={d.newScreen} onChange={(v) => setDk("newScreen", v)} label="Mulai layar baru di sini" />
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
          <Button variant="ghost" size="sm" onClick={tutupSunting}>
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
  // Aturan yang tujuannya kini ada di atas pertanyaan ini (biasanya setelah digeser).
  // Mesin hanya melompat maju, jadi aturan itu diabaikan — ditampilkan supaya tidak diam-diam.
  const tidakBerlaku = cabangTakBerlaku(q, index, total);

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
        // Lima tombol ikon memakan ~200px. Di layar sempit, menaruhnya sebaris dengan teks
        // memeras pertanyaan jadi satu-dua kata per baris — biarkan tombolnya turun ke bawah.
        flexWrap: "wrap",
        // Garis atas = batas layar baru di Flow. Kuncinya hanya ada bila dipakai: elemen ini
        // dipakai ulang React dari mode sunting yang memakai `border` penuh, dan kunci
        // borderTop yang hadir (walau undefined) memicu peringatan bentrok gaya saat beralih.
        ...(startsScreen ? { borderTop: `2px solid ${theme.primary}` } : {}),
      }}
    >
      <div style={{ fontSize: 13, color: theme.text, minWidth: 0, flex: "1 1 220px" }}>
        {startsScreen ? (
          <div style={{ marginBottom: 4 }}>
            <Badge tone="purple">⤵ layar baru{q.options?.screenTitle ? ` — ${q.options.screenTitle}` : ""}</Badge>
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
        {tidakBerlaku.length ? (
          <div style={{ color: theme.red, fontSize: 11.5, marginTop: 4 }}>
            Percabangan &ldquo;{tidakBerlaku[0].value}&rdquo; menuju pertanyaan di atasnya dan tidak akan berlaku — buka
            Edit untuk memilih tujuan lain.
          </div>
        ) : null}
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
        {onDuplicate ? (
          <Button variant="ghost" size="sm" icon="copy" onClick={onDuplicate} title="Gandakan pertanyaan" />
        ) : null}
        <Button variant="secondary" size="sm" icon="edit" onClick={startEdit} title="Edit" />
        <Button variant="danger" size="sm" icon="trash" onClick={onDelete} title="Hapus" />
      </div>
    </div>
  );
}
