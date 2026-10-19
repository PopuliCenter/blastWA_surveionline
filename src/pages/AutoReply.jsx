import { useCallback, useState } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  Modal,
  Notice,
  Loading,
  Empty,
  Toggle,
  useLoader,
  useIsMobile,
  useDirty,
  theme,
} from "../lib/ui";
import { AutoReplyPresetPicker } from "./autoreply/PresetPicker";

const MATCH_LABEL = { contains: "mengandung", exact: "sama persis", starts: "diawali" };

// Bot diam saat tidak ada survei berjalan (lihat backend services/modeBot.ts). Tempatnya di
// sini karena yang dibungkamnya justru balasan otomatis: aturan di halaman ini, Agen AI, dan
// pesan survei berakhir.
function KartuModeBot() {
  const mode = useLoader(useCallback(() => api.modeBot(), []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const d = mode.data;
  const ubah = async (diam) => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      mode.setData(await api.simpanModeBot({ diamTanpaSurveiAktif: diam }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const sedangDiam = Boolean(d?.diamTanpaSurveiAktif && !d.adaSurveiBerjalan);
  return (
    <Card style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ color: theme.text }}>Bot diam saat tidak ada survei berjalan</strong>
            {d ? <Badge tone={sedangDiam ? "yellow" : "green"}>{sedangDiam ? "sedang diam" : "membalas"}</Badge> : null}
          </div>
          <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6, lineHeight: 1.55 }}>
            Bila dinyalakan dan tidak ada satu pun survei berstatus Berjalan, bot tidak mengirim balasan otomatis apa
            pun — pesan survei berakhir, aturan di bawah, Agen AI, maupun konfirmasi berlangganan. Satu-satunya
            pengecualian: konfirmasi permintaan berhenti (STOP), sekali saat nomornya baru berhenti. Pesan masuk tetap
            tercatat di Chat dan tetap bisa dibalas manual. Begitu ada survei berjalan, bot membalas lagi dengan
            sendirinya.
          </div>
          {d?.diamTanpaSurveiAktif ? (
            <div style={{ fontSize: 12.5, marginTop: 8, color: theme.text }}>
              {d.adaSurveiBerjalan
                ? "Ada survei yang sedang berjalan, jadi bot tetap membalas. Bot diam lagi begitu semua survei ditutup."
                : "Tidak ada survei yang berjalan — bot sedang diam."}
            </div>
          ) : null}
        </div>
        {d ? (
          // Lebar tetap: label berganti "Mati" → "Menyimpan…" → "Menyala", dan tanpa ini
          // paragraf di sebelahnya ikut melebar-menyempit tiap kali sakelar ditekan.
          <div style={{ minWidth: 136, display: "flex", justifyContent: "flex-end" }}>
            <Toggle
              checked={d.diamTanpaSurveiAktif}
              onChange={ubah}
              label={busy ? "Menyimpan…" : d.diamTanpaSurveiAktif ? "Menyala" : "Mati"}
            />
          </div>
        ) : null}
      </div>
      {mode.error || err ? (
        <div style={{ marginTop: 12 }}>
          <Notice>{mode.error || err}</Notice>
        </div>
      ) : null}
    </Card>
  );
}

export default function AutoReply() {
  const { data, loading, error, reload } = useLoader(useCallback(() => api.listAutoReplies(), []));
  const [modal, setModal] = useState(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const rules = data || [];
  const run = async (fn) => {
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Buat satu paket contoh sekaligus. Aturan dibuat berurutan agar galat pada salah
  // satunya tidak menyembunyikan yang lain — yang terlanjur dibuat tetap tersimpan.
  const pakaiPreset = async (preset) => {
    setPresetBusy(true);
    setErr("");
    setNote("");
    let dibuat = 0;
    try {
      for (const r of preset.rules) {
        await api.createAutoReply({
          name: r.name,
          keyword: r.keyword,
          matchType: r.matchType,
          response: r.response,
          priority: r.priority,
          enabled: true,
        });
        dibuat += 1;
      }
      setNote(`${dibuat} aturan "${preset.title}" dibuat. Tinjau teksnya lalu sesuaikan bila perlu.`);
      setPresetOpen(false);
    } catch (e) {
      setErr(`Gagal pada aturan ke-${dibuat + 1}: ${e.message}`);
    } finally {
      setPresetBusy(false);
      await reload();
    }
  };

  return (
    <div>
      <PageHeader
        title="Auto Reply"
        subtitle="Balas otomatis pesan masuk berdasarkan kata kunci."
        actions={[
          <Button key="r" variant="ghost" icon="refresh" onClick={reload}>
            Refresh
          </Button>,
          <Button key="c" variant="secondary" icon="sparkle" onClick={() => setPresetOpen(true)}>
            Pakai Contoh
          </Button>,
          <Button key="n" icon="plus" onClick={() => setModal({})}>
            Tambah Aturan
          </Button>,
        ]}
      />
      <KartuModeBot />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>
      <Notice kind="info">
        Aturan dicek saat pesan masuk yang TIDAK sedang dalam alur survei. Prioritas lebih tinggi dicek dulu. Jika tak
        ada yang cocok dan Agen AI aktif, AI yang menjawab.
      </Notice>
      {loading ? (
        <Loading />
      ) : rules.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rules.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: theme.text }}>{r.name}</strong>
                    <Badge tone={r.enabled ? "green" : "default"}>{r.enabled ? "aktif" : "nonaktif"}</Badge>
                    <Badge tone="blue">prioritas {r.priority}</Badge>
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 6 }}>
                    Jika pesan <b>{MATCH_LABEL[r.matchType]}</b> "<span style={{ color: theme.text }}>{r.keyword}</span>
                    "
                  </div>
                  <div
                    style={{
                      background: theme.surfaceAlt,
                      borderRadius: 9,
                      padding: "9px 12px",
                      marginTop: 8,
                      fontSize: 13,
                      color: theme.text,
                    }}
                  >
                    ↪ {r.response}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setModal(r)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={() => run(() => api.deleteAutoReply(r.id))}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon="autoreply"
            title="Belum ada aturan"
            note='Mulai cepat lewat "Pakai Contoh" — ada paket sapaan & tanya-jawab untuk survei online.'
          />
        </Card>
      )}
      {presetOpen ? (
        <AutoReplyPresetPicker
          existingKeywords={rules.map((r) => r.keyword)}
          busy={presetBusy}
          onClose={() => setPresetOpen(false)}
          onPick={pakaiPreset}
        />
      ) : null}
      {modal !== null ? (
        <RuleModal
          rule={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(d) =>
            run(async () => {
              if (modal.id) await api.updateAutoReply(modal.id, d);
              else await api.createAutoReply(d);
              setModal(null);
            })
          }
        />
      ) : null}
    </div>
  );
}

function RuleModal({ rule, onClose, onSave }) {
  const isMobile = useIsMobile();
  const [f, setF] = useState({
    name: rule?.name || "",
    keyword: rule?.keyword || "",
    matchType: rule?.matchType || "contains",
    response: rule?.response || "",
    priority: rule?.priority ?? 0,
    enabled: rule?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const dirty = useDirty(f);
  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ ...f, priority: Number(f.priority) || 0 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={rule ? "Edit Aturan" : "Tambah Aturan"} onClose={onClose} width={520} dirty={dirty}>
      <Input label="Nama aturan" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Select
          label="Tipe cocok"
          value={f.matchType}
          onChange={(e) => set("matchType", e.target.value)}
          options={[
            { value: "contains", label: "Mengandung" },
            { value: "exact", label: "Sama persis" },
            { value: "starts", label: "Diawali" },
          ]}
        />
        <Input
          label="Kata kunci"
          value={f.keyword}
          onChange={(e) => set("keyword", e.target.value)}
          placeholder="cth: harga"
        />
      </div>
      <Textarea
        label="Balasan"
        value={f.response}
        onChange={(e) => set("response", e.target.value)}
        placeholder="Pesan balasan otomatis"
      />
      <Input
        label="Prioritas (angka lebih besar = dicek lebih dulu)"
        type="number"
        value={f.priority}
        onChange={(e) => set("priority", e.target.value)}
      />
      <div style={{ marginBottom: 16 }}>
        <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan aturan" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={submit} disabled={!f.name.trim() || !f.keyword.trim() || !f.response.trim() || saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </Modal>
  );
}
