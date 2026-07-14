// Pembuat WhatsApp Flow JSON dari definisi survei.
// Hasilnya bisa ditempel di Meta Flow Builder untuk membuat & menerbitkan Flow.
// Pemetaan jawaban balik (response_json) memakai aturan yang sama → lihat parseFlowAnswers.

export type FlowQuestion = { id: string; text: string; type: string; required?: boolean; options?: any };
export type FlowSurvey = { title?: string; description?: string | null; questions: FlowQuestion[] };

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
  return ["text", "number", "rating", "choice", "boolean", "multichoice"].includes(q.type);
}

export function buildSurveyFlow(survey: FlowSurvey): object {
  const children: any[] = [];
  if (survey.description) children.push({ type: "TextBody", text: String(survey.description).slice(0, 4000) });

  const payload: Record<string, string> = {};
  const supported = survey.questions.filter(flowSupported);

  supported.forEach((q, i) => {
    const name = fieldName(q.id);
    const required = q.required ?? true;
    children.push({ type: "TextBody", text: `${i + 1}. ${q.text}`.slice(0, 4000) });

    if (q.type === "text") {
      children.push({ type: "TextArea", name, label: "Jawaban", required });
    } else if (q.type === "number") {
      children.push({ type: "TextInput", name, label: "Jawaban (angka)", "input-type": "number", required });
    } else if (q.type === "rating") {
      // Legend label jangkar (mis. "1 = Sangat tidak puas · 5 = Sangat puas").
      const mn = String(q.options?.minLabel ?? "").trim();
      const mx = String(q.options?.maxLabel ?? "").trim();
      const vals = ratingValues(q);
      if (mn || mx) {
        const lo = vals[0],
          hi = vals[vals.length - 1];
        children.push({ type: "TextCaption", text: `${lo} = ${mn || "…"} · ${hi} = ${mx || "…"}`.slice(0, 4000) });
      }
      const ds = vals.map((n) => ({ id: String(n), title: String(n) }));
      children.push({ type: "RadioButtonsGroup", name, label: "Pilih nilai", "data-source": ds, required });
    } else if (q.type === "multichoice") {
      const opts = choiceList(q);
      const ds = opts.map((c, idx) => ({ id: String(idx), title: c.slice(0, 80) }));
      children.push({
        type: "CheckboxGroup",
        name,
        label: "Pilih (boleh lebih dari satu)",
        "data-source": ds,
        required,
        ...(required ? { "min-selected-items": 1 } : {}),
      });
    } else if (q.type === "boolean") {
      children.push({
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
      // ≤ 3 pilihan → radio; lebih → dropdown
      const type = opts.length > 3 ? "Dropdown" : "RadioButtonsGroup";
      children.push({ type, name, label: "Pilih", "data-source": ds, required });
    }
    payload[name] = "${form." + name + "}";
  });

  children.push({
    type: "Footer",
    label: "Kirim Jawaban",
    "on-click-action": { name: "complete", payload },
  });

  return {
    version: "7.0",
    screens: [
      {
        id: "SURVEY",
        title: (survey.title || "Survei").slice(0, 30),
        terminal: true,
        success: true,
        data: {},
        layout: { type: "SingleColumnLayout", children: [{ type: "Form", name: "form", children }] },
      },
    ],
  };
}

// Ubah satu nilai mentah dari response_json menjadi jawaban (id pilihan → teks pilihan).
function toAnswer(q: FlowQuestion, raw: unknown): { questionId: string; value: string } | null {
  if (raw === undefined || raw === null || raw === "") return null;
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
