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
  return ["text", "number", "rating", "choice", "boolean"].includes(q.type);
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
      const ds = ratingValues(q).map((n) => ({ id: String(n), title: String(n) }));
      children.push({ type: "RadioButtonsGroup", name, label: "Pilih nilai", "data-source": ds, required });
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

// Petakan response_json flow balik ke jawaban per pertanyaan.
export function parseFlowAnswers(
  response: Record<string, unknown>,
  questions: FlowQuestion[],
): { questionId: string; value: string }[] {
  const out: { questionId: string; value: string }[] = [];
  for (const q of questions) {
    if (!flowSupported(q)) continue;
    const raw = response[fieldName(q.id)];
    if (raw === undefined || raw === null || raw === "") continue;
    let value = String(raw);
    if (q.type === "choice") {
      const opts = choiceList(q);
      const idx = parseInt(value, 10);
      if (Number.isInteger(idx) && idx >= 0 && idx < opts.length) value = opts[idx]!;
    }
    out.push({ questionId: q.id, value });
  }
  return out;
}
