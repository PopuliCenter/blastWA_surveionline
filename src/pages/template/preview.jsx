import { Badge, Icon, theme } from "../../lib/ui";
import { fillVars, normalizeName } from "./constants";

// ===== Preview gaya WhatsApp =====
function WaText({ text }) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/(\*[^*]+\*|_[^_]+_)/).map((p, pi) => {
        if (p.startsWith("*") && p.endsWith("*")) return <strong key={pi}>{p.slice(1, -1)}</strong>;
        if (p.startsWith("_") && p.endsWith("_"))
          return (
            <em key={pi} style={{ color: "#555" }}>
              {p.slice(1, -1)}
            </em>
          );
        return p;
      })}
    </span>
  ));
}

export function WaPreview({ tpl }) {
  const body = fillVars(tpl.bodyText || "", tpl.sampleParams);
  const header = tpl.headerType === "text" ? fillVars(tpl.headerText || "", tpl.sampleParams) : "";
  const mediaLabel = { image: "🖼️ Gambar / Foto", document: "📄 Dokumen (PDF)", video: "🎬 Video" }[tpl.headerType];
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>Pratinjau WhatsApp</div>
      <div style={{ background: "#ECE5DD", borderRadius: 12, padding: 14, minHeight: 120 }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "2px 12px 12px 12px",
            boxShadow: "0 1px 2px rgba(0,0,0,.15)",
            overflow: "hidden",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "#111",
          }}
        >
          {mediaLabel ? (
            <div
              style={{
                background: "#dfe7e2",
                color: "#4a5a52",
                padding: "22px 12px",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {mediaLabel}
            </div>
          ) : null}
          <div style={{ padding: "9px 12px 10px" }}>
            {header ? <div style={{ fontWeight: 700, marginBottom: 5 }}>{header}</div> : null}
            <div>
              <WaText text={body || "(isi pesan kosong)"} />
            </div>
            {tpl.footerText ? (
              <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 7 }}>{tpl.footerText}</div>
            ) : null}
          </div>
          {(tpl.buttons || []).length ? (
            <div style={{ borderTop: "1px solid #eee" }}>
              {tpl.buttons.map((b, i) => (
                <div
                  key={i}
                  style={{
                    borderTop: i ? "1px solid #eee" : "none",
                    color: "#1ca0e3",
                    textAlign: "center",
                    padding: "9px 6px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Icon
                    name={b.type === "URL" ? "link" : b.type === "PHONE_NUMBER" ? "phone" : "autoreply"}
                    size={14}
                  />
                  {b.text || "(tombol)"}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ===== Cek kesiapan untuk disetujui Meta (heuristik) =====
export function metaChecks(f, nVars) {
  const out = [];
  const body = f.bodyText || "";
  const add = (level, ok, text) => out.push({ level, ok, text });

  add("error", !!body.trim(), "Isi pesan tidak boleh kosong");
  add("error", normalizeName(f.name).length > 0, "Nama template wajib diisi");
  add("warn", body.length <= 1024, "Isi pesan ≤ 1024 karakter");
  add("warn", (f.headerText || "").length <= 60, "Header teks ≤ 60 karakter");
  add("warn", (f.footerText || "").length <= 60, "Footer ≤ 60 karakter");

  // variabel berurutan 1..n & ada contohnya
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10));
  const seqOk = nVars === 0 || (Math.max(...nums, 0) === nVars && new Set(nums).size === nVars && !nums.includes(0));
  add("error", seqOk, "Variabel berurutan mulai {{1}} tanpa lompatan");
  const filled = Array.from({ length: nVars }).every((_, i) => (f.sampleParams[i] || "").trim());
  if (nVars > 0) add("warn", filled, "Semua variabel punya contoh nilai");

  // variabel tidak di awal/akhir body
  const trimmed = body.trim();
  const edgeVar = /^\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}$/.test(trimmed);
  add("warn", !edgeVar, "Variabel tidak di paling awal/akhir pesan");

  // media header butuh contoh
  if (["image", "document", "video"].includes(f.headerType))
    add("warn", !!(f.headerMediaUrl || "").trim(), "Header media punya contoh URL");

  // footer tidak boleh ada variabel
  add("warn", !/\{\{\d+\}\}/.test(f.footerText || ""), "Footer tanpa variabel");

  // tombol URL/telepon valid
  for (const b of f.buttons || []) {
    if (b.type === "URL") add("warn", /^https?:\/\/.+/.test(b.url || ""), `Tombol "${b.text}" punya URL valid`);
    if (b.type === "PHONE_NUMBER")
      add("warn", /^\+?\d{6,}/.test(b.phone || ""), `Tombol "${b.text}" punya nomor valid`);
  }

  // kategori vs OTP
  if (f.category === "AUTHENTICATION")
    add("warn", /kode|otp|verif/i.test(body), "Kategori Authentication khusus kode/OTP");
  return out;
}

export function MetaChecklist({ checks }) {
  const errors = checks.filter((c) => c.level === "error" && !c.ok);
  const warns = checks.filter((c) => c.level === "warn" && !c.ok);
  const allOk = errors.length === 0 && warns.length === 0;
  return (
    <div style={{ marginTop: 14, border: `1px solid ${theme.border}`, borderRadius: 11, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <Icon name="check" size={16} />
        <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>Kesiapan lolos Meta</span>
        {allOk ? (
          <Badge tone="green">Siap</Badge>
        ) : errors.length ? (
          <Badge tone="red">{errors.length} wajib</Badge>
        ) : (
          <Badge tone="yellow">{warns.length} saran</Badge>
        )}
      </div>
      {allOk ? (
        <div style={{ fontSize: 12.5, color: theme.green }}>
          ✓ Semua syarat dasar terpenuhi. Tetap ikuti kebijakan Meta saat pengajuan.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 5 }}>
          {errors.map((c, i) => (
            <div key={`e${i}`} style={{ fontSize: 12.5, color: theme.red }}>
              ✕ {c.text}
            </div>
          ))}
          {warns.map((c, i) => (
            <div key={`w${i}`} style={{ fontSize: 12.5, color: theme.yellow }}>
              ⚠ {c.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
