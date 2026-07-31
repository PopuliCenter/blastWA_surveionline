import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  PageHeader,
  Card,
  Button,
  Input,
  Textarea,
  Toggle,
  Badge,
  Notice,
  Loading,
  StatStrip,
  useLoader,
  useIsMobile,
  theme,
} from "../lib/ui";

// Integrasi Google Sheets: tiap respons survei selesai otomatis jadi satu baris di
// spreadsheet tim (satu tab per survei) — pemantauan tanpa ekspor manual.
// Ekspor Excel tetap jadi jalur analisis lengkap (kolom atribut pembobot ada di sana).

export default function Sheets() {
  const isMobile = useIsMobile();
  const { data, loading, error, reload } = useLoader(useCallback(() => api.getSheets(), []));
  const [f, setF] = useState(null);
  // Kunci JSON tidak pernah dikirim balik oleh server; kolom ini hanya menampung
  // tempelan baru. Kosong = pertahankan kunci tersimpan (pola kredensial vendor).
  const [keyJson, setKeyJson] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    if (data) setF({ enabled: data.enabled, spreadsheetId: data.spreadsheetId || "" });
  }, [data]);

  const save = async () => {
    setSaving(true);
    setErr("");
    setNote("");
    try {
      const payload = { enabled: f.enabled, spreadsheetId: f.spreadsheetId };
      if (keyJson.trim()) payload.serviceAccountJson = keyJson.trim();
      await api.updateSheets(payload);
      setKeyJson("");
      setNote("Pengaturan Google Sheets tersimpan.");
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErr("");
    try {
      setTestResult(await api.testSheets());
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setErr("");
    setNote("");
    try {
      const r = await api.backfillSheets();
      setNote(
        r.queued > 0
          ? `${r.queued} respons diantrekan — baris akan muncul di spreadsheet dalam beberapa saat.`
          : "Semua respons sudah terdorong; tidak ada yang tertunda.",
      );
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBackfilling(false);
    }
  };

  if (loading || !f)
    return (
      <div>
        <PageHeader title="Google Sheets" />
        <Loading />
      </div>
    );
  const set = (k, v) => setF({ ...f, [k]: v });

  return (
    <div>
      <PageHeader
        title="Google Sheets"
        subtitle="Tiap respons survei selesai otomatis jadi satu baris di spreadsheet tim — tanpa ekspor manual."
        actions={<Badge tone={data.enabled ? "green" : "default"}>{data.enabled ? "aktif" : "nonaktif"}</Badge>}
      />
      <Notice>{error || err}</Notice>
      <Notice kind="success">{note}</Notice>

      {/* minmax(0,…): item grid ber-min-width auto — tanpa ini kartu kanan (StatStrip +
          email panjang) melebarkan tracknya dan memunculkan scroll horizontal. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.4fr) minmax(0,1fr)",
          gap: 16,
        }}
      >
        <Card title="Konfigurasi">
          <div style={{ marginBottom: 16 }}>
            <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktifkan dorong otomatis" />
          </div>
          <Input
            label="Spreadsheet"
            value={f.spreadsheetId}
            onChange={(e) => set("spreadsheetId", e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            hint="Tempel URL spreadsheet dari address bar — ID-nya diambil otomatis. Boleh juga ID-nya saja."
          />
          {/* Kunci service account itu JSON banyak baris, jadi PasswordInput (satu baris)
              tidak bisa dipakai. Perlindungannya setara: nilai tersimpan tidak pernah
              dikirim balik ke browser, kolom ini selalu mulai kosong. */}
          <Textarea
            label="Kunci service account (JSON)"
            value={keyJson}
            onChange={(e) => setKeyJson(e.target.value)}
            rows={5}
            placeholder={
              data.hasKey ? "Tersimpan terenkripsi — tempel untuk mengganti" : '{ "type": "service_account", … }'
            }
            hint="Tempel seluruh isi file kunci .json dari Google Cloud. Disimpan terenkripsi."
          />
          {data.serviceAccountEmail ? (
            <div
              style={{
                background: theme.surfaceAlt,
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                fontSize: 12.5,
                color: theme.textMuted,
              }}
            >
              Share spreadsheet ke email ini sebagai <strong>Editor</strong> — tanpa itu Google menolak menulis:
              <div style={{ marginTop: 6, fontSize: 13, color: theme.text, wordBreak: "break-all", userSelect: "all" }}>
                {data.serviceAccountEmail}
              </div>
            </div>
          ) : null}

          {testResult ? (
            <Notice kind={!testResult.ok ? "error" : testResult.enabled === false ? "warning" : "success"}>
              {testResult.ok ? (
                <>
                  {/* Tes koneksi lolos ≠ integrasi jalan: saklar di atas bisa saja mati.
                      Keadaan itu dinyatakan, bukan dibiarkan terbaca sebagai lampu hijau. */}
                  {testResult.enabled === false ? (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Spreadsheet terjangkau, tetapi dorong otomatis NONAKTIF.</strong> Nyalakan saklar di atas
                      lalu simpan agar respons baru benar-benar terdorong.
                    </div>
                  ) : null}
                  <strong>Berhasil</strong> ({testResult.ms} ms): terhubung ke “{testResult.title}”
                  {testResult.tabs?.length ? ` — tab: ${testResult.tabs.join(", ")}` : ""}
                </>
              ) : (
                <>
                  <strong>Gagal:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {testResult.error}
                  </div>
                  {testResult.email ? (
                    <div style={{ marginTop: 6 }}>
                      Bila galatnya 403: share spreadsheet ke {testResult.email} sebagai Editor. Bila 404: periksa
                      URL/ID spreadsheet-nya.
                    </div>
                  ) : null}
                </>
              )}
            </Notice>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={save} disabled={saving || testing || backfilling}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
            <Button variant="secondary" onClick={runTest} disabled={saving || testing || backfilling}>
              {testing ? "Menguji..." : "Tes Koneksi"}
            </Button>
            <Button
              variant="secondary"
              onClick={runBackfill}
              disabled={saving || testing || backfilling || !data.enabled}
            >
              {backfilling ? "Mengantrekan..." : "Dorong yang Tertunda"}
            </Button>
          </div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8 }}>
            Tes memakai pengaturan yang <strong>sudah tersimpan</strong> — simpan dulu bila baru diubah.
          </div>
        </Card>

        <Card title="Status & cara menyiapkan">
          <StatStrip
            items={[
              { label: "Terdorong", value: data.synced, tone: "green" },
              { label: "Tertunda", value: data.pending, tone: data.pending > 0 ? "yellow" : "default" },
            ]}
          />
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 4, marginBottom: 14 }}>
            Tertunda = respons selesai yang belum tertulis ke spreadsheet. Tombol “Dorong yang Tertunda” menyusulkannya
            — aman dipencet berulang, tidak akan menggandakan baris.
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.text, lineHeight: 1.75 }}>
            <li>
              Buka <strong>console.cloud.google.com</strong>, buat project (gratis, tanpa kartu), aktifkan{" "}
              <strong>Google Sheets API</strong>.
            </li>
            <li>
              Buat <strong>Service Account</strong> (IAM &amp; Admin → Service Accounts) → tab Keys → Add key → JSON —
              file kuncinya terunduh.
            </li>
            <li>Tempel seluruh isi file itu ke kolom kunci di kiri, lalu simpan.</li>
            <li>
              Di spreadsheet tim: <strong>Share</strong> → tempel email service account → jadikan{" "}
              <strong>Editor</strong>.
            </li>
            <li>Tes koneksi, nyalakan saklarnya, lalu dorong respons lama sekali.</li>
          </ol>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 12 }}>
            Satu tab per survei; baris baru muncul begitu responden menyelesaikan survei. Kolom atribut pembobot tidak
            ikut ke sheet — untuk analisis lengkap tetap pakai ekspor Excel di halaman Respons.
          </div>
        </Card>
      </div>
    </div>
  );
}
