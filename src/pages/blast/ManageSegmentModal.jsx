import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { Modal, Notice, Loading, Input, Button, Badge, Empty, useLoader, theme } from "../../lib/ui";

// Kelola anggota segmen: opt-out/opt-in, edit nama, keluarkan dari segmen, hapus kontak.
export function ManageSegmentModal({ segment, onClose }) {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.segmentContacts(segment.id), [segment.id]));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [waMap, setWaMap] = useState({}); // phone -> boolean (hasil cek WA, Baileys)
  const [fmtMap, setFmtMap] = useState({}); // phone -> boolean (validasi format, jalur apa pun)
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState("");

  // Validasi format nomor (bukan status WA): sudah dinormalisasi ke 62…, cek panjang wajar.
  const isPhoneFormatValid = (p) => {
    const d = String(p || "").replace(/\D/g, "");
    return d.length >= 9 && d.length <= 15 && !d.startsWith("0");
  };
  const checkFormat = () => {
    const map = {};
    (data?.contacts || []).forEach((c) => {
      map[c.phone] = isPhoneFormatValid(c.phone);
    });
    setFmtMap(map);
    const bad = Object.values(map).filter((v) => v === false).length;
    setCheckNote(`Format: ${Object.values(map).filter(Boolean).length} valid${bad ? `, ${bad} perlu dicek` : ""}.`);
  };

  const act = async (fn) => {
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const checkWA = async () => {
    const all = data?.contacts || [];
    if (!all.length) return;
    if (
      !window.confirm(
        `Cek ${all.length} nomor ke WhatsApp via jalur Baileys? Butuh WhatsApp Langsung terhubung. Untuk daftar besar prosesnya berjeda (anti-banned).`,
      )
    )
      return;
    setChecking(true);
    setErr("");
    setCheckNote("");
    try {
      const res = await api.checkNumbersWA(all.map((c) => c.phone));
      const map = {};
      (res || []).forEach((r) => {
        map[r.phone] = r.onWhatsApp;
      });
      setWaMap(map);
      const noWa = Object.values(map).filter((v) => v === false).length;
      setCheckNote(`Selesai: ${Object.values(map).filter(Boolean).length} ber-WA, ${noWa} tidak ber-WA.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setChecking(false);
    }
  };

  const optOutNonWA = async () => {
    const targets = (data?.contacts || []).filter((c) => waMap[c.phone] === false && c.subscribed);
    if (!targets.length) return;
    if (
      !window.confirm(
        `Tandai opt-out ${targets.length} nomor yang tidak ber-WA? (tetap tersimpan, dikecualikan dari blast)`,
      )
    )
      return;
    setErr("");
    try {
      for (const c of targets) await api.updateContact(c.id, { subscribed: false });
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  const toggleSub = (c) => {
    setBusy(c.id);
    act(() => api.updateContact(c.id, { subscribed: !c.subscribed }));
  };
  const editName = (c) => {
    const name = window.prompt("Nama kontak:", c.name || "");
    if (name !== null) {
      setBusy(c.id);
      act(() => api.updateContact(c.id, { name }));
    }
  };
  const removeFromSeg = (c) => {
    if (!window.confirm(`Keluarkan ${c.phone} dari segmen ini? (kontak tetap ada di sistem)`)) return;
    setBusy(c.id);
    act(() => api.removeSegmentContact(segment.id, c.id));
  };
  const deleteContact = (c) => {
    if (
      !window.confirm(
        `HAPUS kontak ${c.phone} permanen dari SEMUA segmen & riwayat? Tindakan ini tidak bisa dibatalkan.`,
      )
    )
      return;
    setBusy(c.id);
    act(() => api.deleteContact(c.id));
  };

  const list = (data?.contacts || []).filter(
    (c) => !q || c.phone.includes(q) || (c.name || "").toLowerCase().includes(q.toLowerCase()),
  );
  const optedOut = (data?.contacts || []).filter((c) => !c.subscribed).length;

  return (
    <Modal title={`Kelola — ${segment.name}`} onClose={onClose} width={640}>
      <Notice>{error || err}</Notice>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12.5, color: theme.textMuted }}>
              {data?.contacts.length || 0} kontak{optedOut ? ` • ${optedOut} opt-out (dikecualikan dari blast)` : ""}
            </div>
            <div style={{ minWidth: 200 }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor / nama…" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="whatsapp"
              onClick={checkWA}
              disabled={checking || !data?.contacts.length}
            >
              {checking ? "Mengecek…" : "Cek Nomor WA (Baileys)"}
            </Button>
            <Button variant="ghost" size="sm" icon="check" onClick={checkFormat} disabled={!data?.contacts.length}>
              Cek Format
            </Button>
            {Object.values(waMap).some((v) => v === false) ? (
              <Button variant="ghost" size="sm" onClick={optOutNonWA}>
                Opt-out yang tak ber-WA
              </Button>
            ) : null}
            {checkNote ? <span style={{ fontSize: 12, color: theme.green }}>{checkNote}</span> : null}
          </div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
            <strong>Cek Nomor WA</strong> (status ber-WA sungguhan) hanya via{" "}
            <strong>WhatsApp Langsung (Baileys)</strong> — Meta/Qontak resmi tak punya pengecekan ini.{" "}
            <strong>Cek Format</strong> berlaku untuk semua jalur, tapi hanya memeriksa <em>bentuk nomor</em>, bukan
            status WA.
          </div>
          {list.length ? (
            <div style={{ maxHeight: 380, overflow: "auto", border: `1px solid ${theme.border}`, borderRadius: 9 }}>
              {list.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "9px 11px",
                    borderTop: i ? `1px solid ${theme.border}` : "none",
                    opacity: busy === c.id ? 0.5 : 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>
                      {c.name || "(tanpa nama)"} {!c.subscribed ? <Badge tone="red">opt-out</Badge> : null}
                      {waMap[c.phone] === true ? (
                        <Badge tone="green">WA</Badge>
                      ) : waMap[c.phone] === false ? (
                        <Badge tone="red">tdk ber-WA</Badge>
                      ) : null}
                      {fmtMap[c.phone] === false ? <Badge tone="yellow">format?</Badge> : null}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: "monospace" }}>{c.phone}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSub(c)}
                      title={c.subscribed ? "Tandai tidak mau terima (opt-out)" : "Aktifkan kembali"}
                    >
                      {c.subscribed ? "Opt-out" : "Opt-in"}
                    </Button>
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => editName(c)} title="Ubah nama" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromSeg(c)}
                      title="Keluarkan dari segmen ini"
                    >
                      Keluarkan
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash"
                      onClick={() => deleteContact(c)}
                      title="Hapus kontak permanen"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="contacts" title={q ? "Tidak ada yang cocok" : "Segmen kosong"} />
          )}
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            <strong>Opt-out</strong> = kontak tetap tersimpan tapi otomatis dikecualikan dari blast.{" "}
            <strong>Keluarkan</strong> = lepas dari segmen ini saja. <strong>Hapus</strong> (🗑) = hapus kontak dari
            seluruh sistem.
          </div>
        </>
      )}
    </Modal>
  );
}
