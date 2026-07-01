// Klien API backend Populi WA. Ganti pemakaian localStorage di PopuliApp.jsx
// dengan fungsi-fungsi ini (lihat docs/FRONTEND-INTEGRATION.md).

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOKEN_KEY = "populi.token";

export const apiBase = BASE;

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
    if (typeof window !== "undefined") window.dispatchEvent(new Event("populi:logout"));
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
  surveyResponses: (id) => request(`/api/surveys/${id}/responses`),
  bulkDeleteResponses: (ids) => request("/api/surveys/responses/bulk-delete", { method: "POST", body: { ids } }),
  surveyFlowJson: (id) => request(`/api/surveys/${id}/flow-json`),

  // Segments
  listSegments: () => request("/api/segments"),
  createSegment: (data) => request("/api/segments", { method: "POST", body: data }),
  renameSegment: (id, name) => request(`/api/segments/${id}`, { method: "PUT", body: { name } }),
  addSegmentContacts: (id, contacts) => request(`/api/segments/${id}/contacts`, { method: "POST", body: { contacts } }),
  segmentContacts: (id) => request(`/api/segments/${id}/contacts`),
  removeSegmentContact: (id, contactId) => request(`/api/segments/${id}/contacts/${contactId}`, { method: "DELETE" }),
  deleteSegment: (id) => request(`/api/segments/${id}`, { method: "DELETE" }),
  bulkDeleteSegments: (ids) => request("/api/segments/bulk-delete", { method: "POST", body: { ids } }),

  // Blasts
  listBlasts: () => request("/api/blasts"),
  createBlast: (data) => request("/api/blasts", { method: "POST", body: data }),
  blastReport: (id) => request(`/api/blasts/${id}/report`),
  deleteBlast: (id) => request(`/api/blasts/${id}`, { method: "DELETE" }),
  bulkDeleteBlasts: (ids) => request("/api/blasts/bulk-delete", { method: "POST", body: { ids } }),

  // Vendors
  listVendors: () => request("/api/vendors"),
  setVendorCredentials: (vendor, credentials) =>
    request(`/api/vendors/${vendor}/credentials`, { method: "PUT", body: credentials }),
  setVendorActive: (vendor, active) =>
    request(`/api/vendors/${vendor}/active`, { method: "PUT", body: { active } }),

  // WhatsApp Langsung (Baileys / scan QR)
  baileysStatus: () => request("/api/baileys/status"),
  baileysConnect: () => request("/api/baileys/connect", { method: "POST" }),
  baileysLogout: () => request("/api/baileys/logout", { method: "POST" }),
  checkNumbersWA: (phones) => request("/api/baileys/check-numbers", { method: "POST", body: { phones } }),
  baileysTyping: (phone) => request(`/api/baileys/typing/${encodeURIComponent(phone)}`),

  // Reports
  stats: () => request("/api/stats"),
  webhookLogs: (limit = 100) => request(`/api/webhook-logs?limit=${limit}`),

  // Users (superadmin)
  listUsers: () => request("/api/users"),
  createUser: (data) => request("/api/users", { method: "POST", body: data }),
  updateUser: (id, data) => request(`/api/users/${id}`, { method: "PUT", body: data }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),

  // Contacts
  listContacts: (search = "") => request(`/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createContact: (data) => request("/api/contacts", { method: "POST", body: data }),
  bulkContacts: (contacts) => request("/api/contacts/bulk", { method: "POST", body: { contacts } }),
  updateContact: (id, data) => request(`/api/contacts/${id}`, { method: "PUT", body: data }),
  deleteContact: (id) => request(`/api/contacts/${id}`, { method: "DELETE" }),
  bulkDeleteContacts: (ids) => request("/api/contacts/bulk-delete", { method: "POST", body: { ids } }),
  bulkDeleteConversations: (ids) => request("/api/conversations/bulk-delete", { method: "POST", body: { ids } }),

  // Chat
  conversations: () => request("/api/conversations"),
  contactMessages: (id) => request(`/api/contacts/${id}/messages`),
  sendMessage: (id, text) => request(`/api/contacts/${id}/messages`, { method: "POST", body: { text } }),
  resolveConversation: (id, resolved) => request(`/api/contacts/${id}/resolve`, { method: "POST", body: { resolved } }),
  listNotes: (id) => request(`/api/contacts/${id}/notes`),
  addNote: (id, text) => request(`/api/contacts/${id}/notes`, { method: "POST", body: { text } }),

  // Auto Reply
  listAutoReplies: () => request("/api/auto-replies"),
  createAutoReply: (data) => request("/api/auto-replies", { method: "POST", body: data }),
  updateAutoReply: (id, data) => request(`/api/auto-replies/${id}`, { method: "PUT", body: data }),
  deleteAutoReply: (id) => request(`/api/auto-replies/${id}`, { method: "DELETE" }),

  // AI Agent
  getAiAgent: () => request("/api/ai-agent"),
  updateAiAgent: (data) => request("/api/ai-agent", { method: "PUT", body: data }),

  // Template pesan WhatsApp
  listTemplates: () => request("/api/templates"),
  createTemplate: (data) => request("/api/templates", { method: "POST", body: data }),
  updateTemplate: (id, data) => request(`/api/templates/${id}`, { method: "PUT", body: data }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: "DELETE" }),

  // Pengaman pengiriman (anti-banned)
  getSendingPolicy: () => request("/api/sending-policy"),
  updateSendingPolicy: (data) => request("/api/sending-policy", { method: "PUT", body: data }),
  getWaQuality: () => request("/api/wa/quality"),
  checkQontak: () => request("/api/qontak/check"),
  getConsentSummary: () => request("/api/contacts-consent-summary"),
};
