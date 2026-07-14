// Pembuat WhatsApp Flow JSON dari definisi survei.
// Hasilnya bisa ditempel di Meta Flow Builder untuk membuat & menerbitkan Flow.
// Pemetaan jawaban balik (response_json) memakai aturan yang sama → lihat parseFlowAnswers.
//
// MULTI-LAYAR (statis, tanpa Flow Endpoint):
// Pertanyaan dibagi ke beberapa layar — dipotong di penanda manual (options.newScreen)
// lalu dipecah lagi tiap `flowPerScreen` pertanyaan. Antar layar memakai aksi "navigate";
// layar terakhir memakai "complete". Data layar sebelumnya diteruskan lewat payload dan
// dideklarasikan di `data` layar berikutnya, sehingga payload complete memuat SEMUA jawaban.
// Layar pertama tetap ber-id "SURVEY" (dipakai provider.sendFlow → flow_action_payload).

export type FlowQuestion = { id: string; text: string; type: string; required?: boolean; options?: any };
export type FlowSurvey = {
  title?: string;
  description?: string | null;
  questions: FlowQuestion[];
  flowPerScreen?: number | null;
  privacyUrl?: string | null;
};

export const DEFAULT_PER_SCREEN = 4;

// Nama field di flow untuk satu pertanyaan (charset aman: huruf/angka/underscore).
export function fieldName(qid: string): string {
  return "q_" + String(qid).replace(/[^a-zA-Z0-9_]/g, "");
}

function ratingValues(q: FlowQuestion): number[] {
  const min = Number(q.options?.min ?? 1);
  const max = Number(q.options?.max ?? 5);
  const lo = Number.isFinite(min) ? min : 1;
  const hi = Number.isFinite(max) ? max : 5;
  const out: number[] = [];
  for (let n = lo; n <= hi && out.length < 50; n++) out.push(n);
  return out;
}
function choiceList(q: FlowQuestion): string[] {
  const c = q.options?.choices;
  return Array.isArray(c) ? c.map((x: any) => String(x)) : [];
}

// Pertanyaan yang punya kontrol input di flow (image tidak didukung di flow → dilewati).
export function flowSupported(q: FlowQuestion): boolean {
  return ["text", "number", "rating", "choice", "boolean", "multichoice", "date", "consent"].includes(q.type);
}

// Tipe data field saat diteruskan antar layar (dideklarasikan di `data` tiap layar).
function fieldDataType(q: FlowQuestion): Record<string, unknown> {
  if (q.type === "multichoice") return { type: "array", items: { type: "string" }, __example__: [] };
  if (q.type === "consent") return { type: "boolean", __example__: false };
  return { type: "string", __example__: "" };
}

// Bagi pertanyaan ke layar: potong di penanda manual (options.newScreen), lalu pecah
// tiap `perScreen`. Selalu mengembalikan minimal 1 layar (bila ada pertanyaan).
export function splitScreens(questions: FlowQuestion[], perScreen?: number | null): FlowQuestion[][] {
  const n = Math.max(1, Math.min(20, Number(perScreen) || DEFAULT_PER_SCREEN));
  const supported = questions.filter(flowSupported);

  // 1) Potong di penanda seksi manual.
  const sections: FlowQuestion[][] = [];
  for (const q of supported) {
    if (!sections.length || q.options?.newScreen === true) sections.push([]);
    sections[sections.length - 1]!.push(q);
  }
  // 2) Pecah tiap seksi yang lebih panjang dari n.
  const screens: FlowQuestion[][] = [];
  for (const sec of sections) {
    for (let i = 0; i < sec.length; i += n) screens.push(sec.slice(i, i + n));
  }
  return screens;
}

// Sufiks huruf bijektif: 1→A, 2→B, … 26→Z, 27→AA. TANPA angka.
function alphaSuffix(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// ID layar. Meta mewajibkan id HANYA huruf & underscore — ANGKA DITOLAK
// ("Property 'id' should only consist of alphabets and underscores"), jadi jangan pakai SURVEY_2.
// Layar pertama wajib tetap "SURVEY" (dirujuk provider.sendFlow → flow_action_payload).
function screenId(i: number): string {
  return i === 0 ? "SURVEY" : `SURVEY_${alphaSuffix(i + 1)}`; // SURVEY, SURVEY_B, SURVEY_C, …
}

// ===== Skip logic di Flow (komponen If — dievaluasi di sisi klien, tanpa Flow Endpoint) =====

type Branch = { value: string; goto: string | number };

function branchesOf(q: FlowQuestion): Branch[] {
  const b = q.options?.branches;
  return Array.isArray(b) ? b : [];
}

// Nilai FIELD di Flow untuk satu nilai percabangan.
// PENTING: aturan branches menyimpan TEKS jawaban, tapi field Flow mengirim ID:
//   choice  → id = indeks pilihan ("0","1",…)  ·  boolean → id = "Ya"/"Tidak"
// Tanpa terjemahan ini kondisi tidak akan pernah cocok.
function flowBranchValue(q: FlowQuestion, value: string): string | null {
  const v = String(value).trim();
  if (q.type === "boolean") return v === "Ya" || v === "Tidak" ? v : null;
  if (q.type === "choice") {
    const idx = choiceList(q).indexOf(v);
    return idx >= 0 ? String(idx) : null;
  }
  return null; // hanya choice & boolean yang bisa dicabangkan
}

// Apakah percabangan pada pertanyaan indeks `i` (nilai b) MELEWATI pertanyaan indeks `j`?
// goto "end" → semua sesudah i dilewati. goto = G → yang dilewati adalah i < j < G.
// Indeks mengacu ke daftar pertanyaan LENGKAP (sama seperti mesin chat), bukan hasil filter.
function branchSkips(i: number, b: Branch, j: number): boolean {
  if (j <= i) return false;
  if (b.goto === "end" || b.goto === -1) return true;
  const g = Number(b.goto);
  return Number.isInteger(g) && j < g;
}

// Kondisi "tampilkan pertanyaan ini" = AND dari semua `!=` (De Morgan atas OR dari `==`).
// Memakai != menghindari negasi bertingkat, jadi ekspresinya sederhana & aman.
// refOf: bagaimana merujuk field pertanyaan pemicu (${form.x} bila selayar, ${data.x} bila layar sebelumnya).
function visibilityCondition(
  target: { q: FlowQuestion; index: number },
  all: { q: FlowQuestion; index: number }[],
  refOf: (qid: string) => string,
): string | null {
  const terms: string[] = [];
  for (const src of all) {
    if (src.index >= target.index) continue;
    if (!flowSupported(src.q)) continue;
    for (const b of branchesOf(src.q)) {
      if (!branchSkips(src.index, b, target.index)) continue;
      const val = flowBranchValue(src.q, b.value);
      if (val === null) continue; // nilai tak bisa dipetakan → abaikan (jangan tebak)
      terms.push(`${refOf(src.q.id)} != '${val.replace(/'/g, "")}'`);
    }
  }
  if (!terms.length) return null;
  return [...new Set(terms)].join(" && ");
}

// Komponen input untuk satu pertanyaan.
function questionChildren(q: FlowQuestion, number: number): any[] {
  const name = fieldName(q.id);
  const required = q.required ?? true;
  const out: any[] = [{ type: "TextBody", text: `${number}. ${q.text}`.slice(0, 4000) }];

  if (q.type === "text") {
    out.push({ type: "TextArea", name, label: "Jawaban", required });
  } else if (q.type === "number") {
    out.push({ type: "TextInput", name, label: "Jawaban (angka)", "input-type": "number", required });
  } else if (q.type === "date") {
    out.push({ type: "DatePicker", name, label: "Pilih tanggal", required });
  } else if (q.type === "consent") {
    out.push({ type: "OptIn", name, label: "Saya setuju".slice(0, 120), required });
  } else if (q.type === "rating") {
    const mn = String(q.options?.minLabel ?? "").trim();
    const mx = String(q.options?.maxLabel ?? "").trim();
    const vals = ratingValues(q);
    if (mn || mx) {
      const lo = vals[0],
        hi = vals[vals.length - 1];
      out.push({ type: "TextCaption", text: `${lo} = ${mn || "…"} · ${hi} = ${mx || "…"}`.slice(0, 4000) });
    }
    out.push({
      type: "RadioButtonsGroup",
      name,
      label: "Pilih nilai",
      "data-source": vals.map((n) => ({ id: String(n), title: String(n) })),
      required,
    });
  } else if (q.type === "multichoice") {
    const ds = choiceList(q).map((c, idx) => ({ id: String(idx), title: c.slice(0, 80) }));
    out.push({
      type: "CheckboxGroup",
      name,
      label: "Pilih (boleh lebih dari satu)",
      "data-source": ds,
      required,
      ...(required ? { "min-selected-items": 1 } : {}),
    });
  } else if (q.type === "boolean") {
    out.push({
      type: "RadioButtonsGroup",
      name,
      label: "Pilih",
      "data-source": [
        { id: "Ya", title: "Ya" },
        { id: "Tidak", title: "Tidak" },
      ],
      required,
    });
  } else if (q.type === "choice") {
    const opts = choiceList(q);
    const ds = opts.map((c, idx) => ({ id: String(idx), title: c.slice(0, 80) }));
    out.push({ type: opts.length > 3 ? "Dropdown" : "RadioButtonsGroup", name, label: "Pilih", "data-source": ds, required });
  }
  return out;
}

export function buildSurveyFlow(survey: FlowSurvey): object {
  const screensQs = splitScreens(survey.questions, survey.flowPerScreen);
  const last = screensQs.length - 1;
  const multi = screensQs.length > 1;

  // Indeks ASLI tiap pertanyaan (daftar lengkap, termasuk tipe yang tak didukung Flow) —
  // aturan `goto` percabangan memakai indeks ini, sama seperti mesin chat.
  const all = survey.questions.map((q, index) => ({ q, index }));
  const indexOf = new Map(all.map((x) => [x.q.id, x.index]));

  // Nomor urut global tiap pertanyaan (lintas layar).
  let counter = 0;
  const numbers = screensQs.map((qs) => qs.map(() => ++counter));

  const screens = screensQs.map((qs, i) => {
    const children: any[] = [];
    // Field pemicu yang ada di layar ini dirujuk ${form.x}; dari layar sebelumnya ${data.x}.
    const onThisScreen = new Set(qs.map((q) => q.id));
    const refOf = (qid: string) =>
      onThisScreen.has(qid) ? "${form." + fieldName(qid) + "}" : "${data." + fieldName(qid) + "}";

    const secTitle = String(qs[0]?.options?.screenTitle ?? "").trim();
    if (secTitle) children.push({ type: "TextHeading", text: secTitle.slice(0, 80) });
    if (multi) children.push({ type: "TextCaption", text: `Bagian ${i + 1} dari ${screensQs.length}` });
    if (i === 0 && survey.description)
      children.push({ type: "TextBody", text: String(survey.description).slice(0, 4000) });
    if (i === 0 && survey.privacyUrl)
      children.push({
        type: "EmbeddedLink",
        text: "Kebijakan Privasi",
        "on-click-action": { name: "open_url", url: String(survey.privacyUrl) },
      });

    qs.forEach((q, j) => {
      const kids = questionChildren(q, numbers[i]![j]!);
      // Skip logic: bila ada percabangan yang melewati pertanyaan ini, bungkus dengan If
      // sehingga komponennya hanya dirender saat kondisinya benar (dan tak ikut divalidasi).
      const cond = visibilityCondition({ q, index: indexOf.get(q.id) ?? 0 }, all, refOf);
      if (cond) children.push({ type: "If", condition: cond, then: kids });
      else children.push(...kids);
    });

    // Jawaban layar-layar sebelumnya: dideklarasikan di `data` & diteruskan ke payload.
    const prev = screensQs.slice(0, i).flat();
    const data: Record<string, unknown> = {};
    for (const q of prev) data[fieldName(q.id)] = fieldDataType(q);

    const payload: Record<string, string> = {};
    for (const q of prev) payload[fieldName(q.id)] = "${data." + fieldName(q.id) + "}";
    for (const q of qs) payload[fieldName(q.id)] = "${form." + fieldName(q.id) + "}";

    children.push({
      type: "Footer",
      label: i === last ? "Kirim Jawaban" : "Lanjut",
      "on-click-action":
        i === last
          ? { name: "complete", payload }
          : { name: "navigate", next: { type: "screen", name: screenId(i + 1) }, payload },
    });

    return {
      id: screenId(i),
      title: (secTitle || survey.title || "Survei").slice(0, 30),
      ...(i === last ? { terminal: true, success: true } : {}),
      data,
      layout: { type: "SingleColumnLayout", children: [{ type: "Form", name: "form", children }] },
    };
  });

  return { version: "7.0", screens };
}

// ===== Pemetaan response_json balik ke jawaban =====

// Ubah satu nilai mentah dari response_json menjadi jawaban (id pilihan → teks pilihan).
function toAnswer(q: FlowQuestion, raw: unknown): { questionId: string; value: string } | null {
  if (raw === undefined || raw === null || raw === "") return null;

  // OptIn mengembalikan boolean.
  if (q.type === "consent") {
    const yes = raw === true || String(raw).toLowerCase() === "true";
    return { questionId: q.id, value: yes ? "Ya" : "Tidak" };
  }
  // DatePicker mengembalikan timestamp milidetik (string) → tanggal YYYY-MM-DD.
  if (q.type === "date") {
    const ms = Number(String(raw).trim());
    if (Number.isFinite(ms) && ms > 0) {
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return { questionId: q.id, value: d.toISOString().slice(0, 10) };
    }
    return { questionId: q.id, value: String(raw) };
  }
  // CheckboxGroup mengembalikan array id → petakan tiap id ke teks pilihan, gabung ", ".
  if (q.type === "multichoice") {
    const opts = choiceList(q);
    const arr = Array.isArray(raw) ? raw : String(raw).split(",");
    const mapped = arr
      .map((x) => {
        const idx = parseInt(String(x).trim(), 10);
        return Number.isInteger(idx) && idx >= 0 && idx < opts.length ? opts[idx]! : String(x).trim();
      })
      .filter(Boolean);
    return mapped.length ? { questionId: q.id, value: mapped.join(", ") } : null;
  }
  let value = String(raw);
  if (q.type === "choice") {
    const opts = choiceList(q);
    const idx = parseInt(value, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < opts.length) value = opts[idx]!;
  }
  return { questionId: q.id, value };
}

// Nama field jawaban di response_json (flow_token dsb. bukan jawaban).
function answerKeys(response: Record<string, unknown>): string[] {
  return Object.keys(response).filter((k) => k.startsWith("q_"));
}

// True bila Flow yang terbit di Meta memakai id pertanyaan LAIN (survei sudah berubah /
// Flow dibuat dari survei lain) → pencocokan by-id pasti gagal. Dipakai untuk memperingatkan
// operator; tanpa ini kegagalan bersifat senyap (responden "selesai" tapi 0 jawaban).
export function flowOutOfSync(response: Record<string, unknown>, questions: FlowQuestion[]): boolean {
  const keys = answerKeys(response);
  if (!keys.length) return false;
  const supported = questions.filter(flowSupported);
  return !supported.some((q) => Object.prototype.hasOwnProperty.call(response, fieldName(q.id)));
}

// Petakan response_json flow balik ke jawaban per pertanyaan.
export function parseFlowAnswers(
  response: Record<string, unknown>,
  questions: FlowQuestion[],
): { questionId: string; value: string }[] {
  const supported = questions.filter(flowSupported);

  // Jalur normal: cocokkan berdasarkan nama field (q_<id pertanyaan>).
  const byId: { questionId: string; value: string }[] = [];
  for (const q of supported) {
    const a = toAnswer(q, response[fieldName(q.id)]);
    if (a) byId.push(a);
  }
  if (byId.length) return byId;

  // Cadangan: tak satu pun field cocok → Flow di Meta dibuat dari versi/survei lain
  // (id pertanyaan berbeda). Jawaban masih bisa diselamatkan lewat URUTAN field, tapi hanya
  // bila AMAN: jumlah field sama persis DAN tiap nilai masuk akal untuk tipe pertanyaannya.
  // Kalau ragu → kembalikan kosong. Data salah-pasang jauh lebih berbahaya daripada data kosong.
  const keys = answerKeys(response);
  if (!keys.length || keys.length !== supported.length) return byId;
  if (!keys.every((k, i) => plausible(supported[i]!, response[k]))) return byId;

  const out: { questionId: string; value: string }[] = [];
  keys.forEach((k, i) => {
    const a = toAnswer(supported[i]!, response[k]);
    if (a) out.push(a);
  });
  return out;
}

// Apakah nilai mentah masuk akal untuk tipe pertanyaan ini? Dipakai HANYA di jalur cadangan
// (pemetaan by-urutan) sebagai pengaman: bila pertanyaan pernah diurut ulang, nilai akan
// "tidak cocok tipe" dan penyelamatan dibatalkan — mencegah jawaban terpasang ke soal salah.
function plausible(q: FlowQuestion, raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === "") return true; // kosong = tak dijawab, wajar
  const s = String(raw).trim();
  switch (q.type) {
    case "boolean":
      return s === "Ya" || s === "Tidak";
    case "consent":
      return raw === true || raw === false || s === "true" || s === "false";
    case "date": {
      const ms = Number(s);
      return Number.isFinite(ms) && ms > 0;
    }
    case "rating": {
      const vals = ratingValues(q);
      const n = Number(s);
      return Number.isInteger(n) && n >= vals[0]! && n <= vals[vals.length - 1]!;
    }
    case "number":
      return Number.isFinite(Number(s));
    case "choice": {
      const n = Number(s);
      return Number.isInteger(n) && n >= 0 && n < choiceList(q).length;
    }
    case "multichoice": {
      const arr = Array.isArray(raw) ? raw : s.split(",");
      const len = choiceList(q).length;
      return arr.every((x) => {
        const n = Number(String(x).trim());
        return Number.isInteger(n) && n >= 0 && n < len;
      });
    }
    default:
      return true; // text: apa pun sah
  }
}
