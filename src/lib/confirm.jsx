import { useEffect, useState } from "react";
import { theme, card, Button, Icon, useIsMobile } from "./ui";

// ===== Dialog konfirmasi in-app (pengganti window.confirm) =====
// Pemakaian imperatif dari mana saja:
//   import { confirmDialog } from "../lib/confirm";
//   if (!(await confirmDialog({ message: "Hapus?", tone: "danger" }))) return;
//
// confirmDialog menerima string atau objek opsi:
//   { title, message, confirmText, cancelText, tone: "danger"|"primary", icon }
// Mengembalikan Promise<boolean> (true = konfirmasi, false = batal).

let openRef = null; // opener yang didaftarkan oleh <ConfirmHost/> (host tunggal)

export function confirmDialog(opts) {
  const options = typeof opts === "string" ? { message: opts } : opts || {};
  return new Promise((resolve) => {
    // Fallback aman bila host belum termuat → jangan sampai aksi terblokir.
    if (!openRef) {
      resolve(window.confirm(options.message || "Lanjutkan?"));
      return;
    }
    openRef({ options, resolve });
  });
}

// Host tunggal — dipasang sekali di root aplikasi. Render null sampai dipanggil.
export function ConfirmHost() {
  const [state, setState] = useState(null); // { options, resolve }
  const isMobile = useIsMobile();

  useEffect(() => {
    openRef = (payload) => setState(payload);
    return () => {
      openRef = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        state.resolve(false);
        setState(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        state.resolve(true);
        setState(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;
  const o = state.options;
  const danger = (o.tone || "primary") === "danger";
  const iconName = o.icon || (danger ? "trash" : "check");
  const [iconBg, iconFg] = danger ? [theme.redSoft, theme.red] : [theme.primarySoft, theme.primary];
  const done = (result) => {
    state.resolve(result);
    setState(null);
  };

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
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 22,
            flexDirection: isMobile ? "column-reverse" : "row",
          }}
        >
          <Button variant="secondary" onClick={() => done(false)} style={isMobile ? { width: "100%" } : undefined}>
            {o.cancelText || "Batal"}
          </Button>
          <Button
            autoFocus
            variant={danger ? "danger" : "primary"}
            icon={danger ? "trash" : undefined}
            onClick={() => done(true)}
            style={{
              ...(danger ? { background: theme.red, color: "#fff", border: "none" } : {}),
              ...(isMobile ? { width: "100%" } : {}),
            }}
          >
            {o.confirmText || (danger ? "Hapus" : "Lanjutkan")}
          </Button>
        </div>
      </div>
    </div>
  );
}
