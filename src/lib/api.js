// Klien API backend Populi WA. Ganti pemakaian localStorage di PopuliApp.jsx
// dengan fungsi-fungsi ini (lihat docs/FRONTEND-INTEGRATION.md).

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOKEN_KEY = "populi.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    throw new Error("Sesi berakhir, silakan login ulang.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", auth: false, body: { username, password } }),
  me: () => request("/api/auth/me"),

  // Surveys
  listSurveys: () => request("/api/surveys"),
  createSurvey: (data) => request("/api/surveys", { method: "POST", body: data }),
  updateSurvey: (id, data) => request(`/api/surveys/${id}`, { method: "PUT", body: data }),
  deleteSurvey: (id) => request(`/api/surveys/${id}`, { method: "DELETE" }),

  // Segments
  listSegments: () => request("/api/segments"),
  createSegment: (data) => request("/api/segments", { method: "POST", body: data }),
  deleteSegment: (id) => request(`/api/segments/${id}`, { method: "DELETE" }),

  // Blasts
  listBlasts: () => request("/api/blasts"),
  createBlast: (data) => request("/api/blasts", { method: "POST", body: data }),
  deleteBlast: (id) => request(`/api/blasts/${id}`, { method: "DELETE" }),

  // Vendors
  listVendors: () => request("/api/vendors"),
  setVendorCredentials: (vendor, credentials) =>
    request(`/api/vendors/${vendor}/credentials`, { method: "PUT", body: credentials }),
  setVendorActive: (vendor, active) =>
    request(`/api/vendors/${vendor}/active`, { method: "PUT", body: { active } }),

  // Reports
  stats: () => request("/api/stats"),
  webhookLogs: (limit = 100) => request(`/api/webhook-logs?limit=${limit}`),
};
