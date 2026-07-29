import { useState } from "react";
import { Modal, Button, Badge, Icon, Notice, theme } from "../../lib/ui";
import { PRESETS, OPT_OUT_INFO } from "./presets";

const MATCH_LABEL = { contains: "mengandung", exact: "sama persis", starts: "diawali" };

// Pemilih contoh aturan balas otomatis. Satu paket berisi beberapa aturan sekaligus,
// karena pencocokan hanya satu kata kunci per aturan — sapaan yang berguna butuh
// beberapa varian ("halo", "hai", "assalamualaikum", …).
export function AutoReplyPresetPicker({ existingKeywords = [], onClose, onPick, busy }) {
  const [open, setOpen] = useState(PRESETS[0].key);
  const punya = new Set(existingKeywords.map((k) => k.toLowerCase()));

  return (
    <Modal title="Pakai Contoh Aturan" onClose={onClose} width={620}>
      <p style={{ marginTop: 0, color: theme.textMuted, fontSize: 13, lineHeight: 1.6 }}>
        Paket siap pakai untuk survei online Populi Center via WhatsApp. Semua aturan bisa Anda edit atau hapus setelah
        dibuat — <strong>tinjau dulu teksnya</strong> agar cocok dengan kebijakan lembaga Anda.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {PRESETS.map((p) => {
          const terbuka = open === p.key;
          const bentrok = p.rules.filter((r) => punya.has(r.keyword.toLowerCase()));
          return (
            <div key={p.key} style={{ border: `1px solid ${theme.border}`, borderRadius: 11, overflow: "hidden" }}>
              <button
                onClick={() => setOpen(terbuka ? "" : p.key)}
                aria-expanded={terbuka}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: 13,
                  border: "none",
                  background: terbuka ? theme.surfaceAlt : theme.surface,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: theme.primarySoft,
                    color: theme.primary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={p.icon} size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: theme.text }}>{p.title}</strong>
                    <Badge tone="blue">{p.rules.length} aturan</Badge>
                    {bentrok.length ? <Badge tone="yellow">{bentrok.length} kata kunci sudah ada</Badge> : null}
                  </span>
                  <span
                    style={{ display: "block", fontSize: 12, color: theme.textMuted, marginTop: 3, lineHeight: 1.5 }}
                  >
                    {p.desc}
                  </span>
                </span>
                <Icon name={terbuka ? "up" : "down"} size={16} />
              </button>

              {terbuka ? (
                <div style={{ padding: 13, borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gap: 9 }}>
                    {p.rules.map((r) => (
                      <div key={r.name} style={{ background: theme.surfaceAlt, borderRadius: 9, padding: 11 }}>
                        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 12.5, color: theme.text }}>{r.name}</strong>
                          <Badge tone="purple">
                            {MATCH_LABEL[r.matchType]} &ldquo;{r.keyword}&rdquo;
                          </Badge>
                          {punya.has(r.keyword.toLowerCase()) ? <Badge tone="yellow">sudah ada</Badge> : null}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: theme.textMuted,
                            marginTop: 7,
                            lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {r.response}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    icon="plus"
                    onClick={() => onPick(p)}
                    disabled={busy}
                    style={{ marginTop: 12, width: "100%" }}
                  >
                    {busy ? "Membuat…" : `Buat ${p.rules.length} aturan ini`}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <Notice kind="info">{OPT_OUT_INFO}</Notice>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  );
}
