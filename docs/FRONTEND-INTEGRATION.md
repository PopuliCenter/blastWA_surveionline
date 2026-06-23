# Menyambungkan Frontend ke Backend (Fase 2)

Frontend (`src/PopuliApp.jsx`) saat ini memakai `localStorage` + data dummy.
Ganti dengan klien API di `src/lib/api.js`. Pola umum: data dimuat dari server via `useEffect`,
aksi (buat/edit/hapus) memanggil `api.*` lalu refresh.

## 1. Login (ganti `LoginPage` + sesi)

```jsx
import { api, setToken, getToken } from "./lib/api";

// Di PopuliApp: ganti cek user localStorage dengan token + /me
const [currentUser, setCurrentUser] = useState(null);
const [authReady, setAuthReady] = useState(false);

useEffect(() => {
  if (!getToken()) { setAuthReady(true); return; }
  api.me().then((r) => setCurrentUser(r.user)).catch(() => setToken(null)).finally(() => setAuthReady(true));
}, []);

// handleLogin di LoginPage:
const { token, user } = await api.login(username, password);
setToken(token);
setCurrentUser(user);

// logout:
setToken(null); setCurrentUser(null);
```

Hapus `DEFAULT_USERS`, pengecekan password di browser, dan `STORAGE_KEYS.sessionUserId`.

## 2. Pemetaan per halaman

| Halaman | Sebelum (localStorage) | Sesudah (API) |
|---|---|---|
| Dashboard | hitung dari state lokal | `api.stats()` |
| Survei | `usePersistentState(surveys)` | `api.listSurveys()` / `createSurvey` / `updateSurvey` / `deleteSurvey` |
| Blast — segmen | `usePersistentState(segments)` | `api.listSegments()` / `createSegment` / `deleteSegment` |
| Blast — kampanye | data dummy | `api.listBlasts()` / `createBlast` / `deleteBlast` |
| Laporan | reduce state lokal | `api.stats()` + `api.webhookLogs()` |
| Webhook | simulator `fetch` | `api.webhookLogs()` (log nyata dari server) |
| Pengaturan | simpan token di browser ❌ | `api.listVendors()` + `api.setVendorCredentials(vendor, {...})` |

## 3. Contoh: halaman Survei

```jsx
function SurveysPage() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => api.listSurveys().then(setSurveys).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const saveSurvey = async (draft, id) => {
    if (id) await api.updateSurvey(id, draft);
    else await api.createSurvey(draft);
    await refresh();
  };
  const remove = async (id) => { await api.deleteSurvey(id); await refresh(); };
  // ...render seperti sebelumnya, tapi pakai state `surveys` dari server
}
```

## 4. Contoh: buat Blast (kirim nyata)

```jsx
await api.createBlast({
  surveyId,                 // opsional
  segmentId,
  vendor: "qontak",         // atau "meta"; kosong → DEFAULT_VENDOR
  templateName: "survei_undangan",  // nama template Meta / Template ID Qontak
  templateLang: "id",
  bodyParams: ["{nama}"],   // isi variabel template
  scheduledAt: schedule || undefined,
});
```
Backend membuat penerima + memasukkan ke antrian; worker yang mengirim. Status (sent/delivered/read)
diperbarui otomatis dari webhook.

## 5. Pengaturan vendor (ganti form token di browser)

```jsx
const vendors = await api.listVendors(); // [{name, configured, active, hasStoredCredentials}]

// simpan kredensial (dikirim ke server, disimpan terenkripsi — tidak pernah balik ke browser)
await api.setVendorCredentials("meta", {
  accessToken: "...", phoneNumberId: "...", appSecret: "...", verifyToken: "...",
});
await api.setVendorCredentials("qontak", {
  accessToken: "...", channelIntegrationId: "...", webhookSecret: "...",
});
```

> ⚠️ Hapus field `wapiKey`/token dari `DEFAULT_SETTINGS` & UI lama — token tidak boleh tinggal di browser.

## 6. Catatan
- Tampilan (komponen `Button`, `Modal`, dll) tetap dipakai — hanya sumber datanya yang berubah.
- Tambah indikator loading & error sederhana per halaman.
- File lama `src/wa_survey_app.jsx` dihapus (lihat `COMMANDS.md`).
