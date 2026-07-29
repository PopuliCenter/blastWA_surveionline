import { useEffect, useState } from "react";
import { theme, card, Button, Icon, Input, useIsMobile } from "./ui";
import { registerConfirm } from "./confirmBus";

// ===== Dialog konfirmasi in-app (pengganti window.confirm) =====
// Pemakaian imperatif dari mana saja:
//   import { confirmDialog } from "../lib/confirm";
//   if (!(await confirmDialog({ message: "Hapus?", tone: "danger" }))) return;
//
// confirmDialog menerima string atau objek opsi:
//   { title, message, confirmText, cancelText, tone: "danger"|"primary", icon, confirmIcon }
// Mengembalikan Promise<boolean> (true = konfirmasi, false = batal).
//
// promptDialog meminta satu baris teks → Promise<string|null>:
//   const nama = await promptDialog({ title: "Ganti nama", label: "Nama baru", value: lama });
//
// Fungsinya sendiri tinggal di confirmBus.js (tanpa dependensi UI) agar ui.jsx bisa
// memakainya tanpa impor melingkar. Di-ekspor ulang di sini demi kompatibilitas pemanggil lama.
export { confirmDialog, promptDialog } from "./confirmBus";

// Host tunggal — dipasang sekali di root aplikasi. Render null sampai dipanggil.
export function ConfirmHost() {
  const [state, setState] = useState(null); // { options, resolve }
  const [text, setText] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => registerConfirm((payload) => setState(payload)), []);

  // Isi kotak teks dengan nilai awal setiap kali dialog prompt dibuka.
  useEffect(() => {
    if (state?.options?.prompt) setText(state.options.value || "");
  }, [state]);

  const isPrompt = Boolean(state?.options?.prompt);
  // Batal → false untuk konfirmasi, null untuk prompt (bedanya penting bagi pemanggil).
  const finish = (ok) => {
    if (!state) return;
    if (isPrompt && ok && !text.trim()) return; // jangan tutup kalau isian wajib masih kosong
    state.resolve(ok ? (isPrompt ? text.trim() : true) : isPrompt ? null : false);
    setState(null);
  };

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!state) return null;
  const o = state.options;
  const danger = (o.tone || "primary") === "danger";
  const iconName = o.icon || (isPrompt ? "edit" : danger ? "trash" : "check");
  const [iconBg, iconFg] = danger ? [theme.redSoft, theme.red] : [theme.primarySoft, theme.primary];
  const done = finish;

  return (
    <div
      onClick={() => done(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 80, // di atas Modal (z 60) — konfirmasi dari dalam modal tetap tampil di atas
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={o.title || "Konfirmasi"}
        style={{ ...card, width: "100%", maxWidth: 420, padding: 22, boxShadow: "0 12px 40px rgba(16,24,40,0.22)" }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              background: iconBg,
              color: iconFg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={iconName} size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "2px 0 0", fontSize: 16, color: theme.text }}>{o.title || "Konfirmasi"}</h3>
            {o.message ? (
              <p style={{ margin: "8px 0 0", fontSize: 13.5, color: theme.textMuted, lineHeight: 1.5 }}>{o.message}</p>
            ) : null}
          </div>
        </div>
        {isPrompt ? (
          <div style={{ marginTop: 16 }}>
            <Input
              label={o.label}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={o.placeholder}
              autoFocus
              style={{ marginBottom: 0 }}
            />
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: isPrompt ? 8 : 22,
            flexDirection: isMobile ? "column-reverse" : "row",
          }}
        >
          <Button variant="secondary" onClick={() => done(false)} style={isMobile ? { width: "100%" } : undefined}>
            {o.cancelText || "Batal"}
          </Button>
          <Button
            autoFocus={!isPrompt}
            disabled={isPrompt && !text.trim()}
            variant={danger ? "danger" : "primary"}
            icon={o.confirmIcon !== undefined ? o.confirmIcon || undefined : danger ? "trash" : undefined}
            onClick={() => done(true)}
            style={{
              ...(danger ? { background: theme.red, color: "#fff", border: "none" } : {}),
              ...(isMobile ? { width: "100%" } : {}),
            }}
          >
            {o.confirmText || (isPrompt ? "Simpan" : danger ? "Hapus" : "Lanjutkan")}
          </Button>
        </div>
      </div>
    </div>
  );
}
