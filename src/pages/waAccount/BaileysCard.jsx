import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, Button, Badge, Notice, theme } from "../../lib/ui";

// ── WhatsApp Langsung via scan QR (Baileys, TIDAK resmi) ─────────────────────
const BAILEYS_STATUS = {
  connected: ["green", "terhubung"],
  qr: ["yellow", "menunggu scan QR"],
  connecting: ["yellow", "menyambungkan…"],
  logged_out: ["red", "logout"],
  disconnected: ["default", "terputus"],
};

export function BaileysCard({ v, onToggle, reloadVendors }) {
  const [state, setState] = useState(null); // { status, qr, me, connected }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      setState(await api.baileysStatus());
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling saat belum terhubung (agar QR & status ter-update). Berhenti bila sudah connected.
  useEffect(() => {
    if (state?.status === "connected") return;
    const id = setInterval(() => {
      if (!document.hidden) refresh(); // jeda saat tab tak terlihat
    }, 2500);
    return () => clearInterval(id);
  }, [state?.status, refresh]);

  const connect = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.baileysConnect();
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.baileysLogout();
      await refresh();
      await reloadVendors?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const st = state?.status || "disconnected";
  const [tone, label] = BAILEYS_STATUS[st] || BAILEYS_STATUS.disconnected;
  const connected = st === "connected";

  return (
    <Card
      title="WhatsApp Langsung (Scan QR)"
      actions={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={tone}>{label}</Badge>
          {v?.active ? <Badge tone="green">aktif</Badge> : <Badge tone="default">nonaktif</Badge>}
        </div>
      }
    >
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.55 }}>
        Kirim/terima pakai nomor HP biasa via scan QR (seperti WhatsApp Web) — <strong>tanpa</strong> Meta API,
        template, atau biaya.
      </div>
      <div
        style={{
          fontSize: 12,
          color: theme.red,
          background: theme.redSoft,
          borderRadius: 9,
          padding: "9px 12px",
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        ⚠ <strong>Jalur tidak resmi</strong> (melanggar ToS WhatsApp). Ada <strong>risiko nomor diblokir</strong>,
        apalagi untuk blast massal. Pakai nomor uji/non-kritis, mulai volume kecil, dan patuhi Pengaman Pengiriman di
        bawah.
      </div>

      {err ? <Notice>{err}</Notice> : null}

      {connected ? (
        <div
          style={{
            background: theme.greenSoft,
            color: theme.green,
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          ✓ Terhubung{state?.me?.id ? ` — ${String(state.me.id).split(":")[0].split("@")[0]}` : ""}
          {state?.me?.name ? ` (${state.me.name})` : ""}
        </div>
      ) : st === "qr" && state?.qr ? (
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <img
            src={state.qr}
            alt="QR WhatsApp"
            style={{
              width: 240,
              height: 240,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "#fff",
              padding: 8,
            }}
          />
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.55 }}>
            Buka <strong>WhatsApp di HP</strong> → <strong>Perangkat Tertaut</strong> →{" "}
            <strong>Tautkan Perangkat</strong> → arahkan kamera ke QR ini. QR berganti otomatis bila kedaluwarsa.
          </div>
        </div>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 14 }}>
          {st === "connecting"
            ? "Sedang menyambungkan…"
            : "Klik “Hubungkan / Tampilkan QR” untuk mulai, lalu scan dengan WhatsApp di HP."}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!connected ? (
          <Button onClick={connect} icon="whatsapp" disabled={busy}>
            {busy ? "Memproses…" : "Hubungkan / Tampilkan QR"}
          </Button>
        ) : null}
        {connected || st === "qr" || st === "connecting" ? (
          <Button variant="secondary" onClick={logout} disabled={busy}>
            Putuskan / Logout
          </Button>
        ) : null}
        {v ? (
          <Button variant="secondary" onClick={() => onToggle("baileys", !v.active)}>
            {v.active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        ) : null}
        <Button variant="ghost" icon="refresh" onClick={refresh}>
          Refresh
        </Button>
      </div>
    </Card>
  );
}
