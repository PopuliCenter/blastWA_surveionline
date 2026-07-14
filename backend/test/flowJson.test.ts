import { describe, it, expect } from "vitest";
import {
  buildSurveyFlow,
  parseFlowAnswers,
  flowOutOfSync,
  splitScreens,
  fieldName,
  flowSupported,
  type FlowQuestion,
} from "../src/lib/flowJson.js";

const q = (id: string, type: string, options: any = null, required = true): FlowQuestion => ({
  id,
  text: "T?",
  type,
  required,
  options,
});

// Cari semua komponen bertipe tertentu di seluruh pohon flow.
function findByType(node: any, type: string, acc: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((n) => findByType(n, type, acc));
  else if (node && typeof node === "object") {
    if (node.type === type) acc.push(node);
    Object.values(node).forEach((v) => findByType(v, type, acc));
  }
  return acc;
}

describe("buildSurveyFlow", () => {
  it("multichoice → CheckboxGroup dengan min-selected-items saat wajib", () => {
    const flow = buildSurveyFlow({ questions: [q("a", "multichoice", { choices: ["X", "Y", "Z"] }, true)] });
    const cbs = findByType(flow, "CheckboxGroup");
    expect(cbs).toHaveLength(1);
    expect(cbs[0]["data-source"].map((d: any) => d.title)).toEqual(["X", "Y", "Z"]);
    expect(cbs[0]["min-selected-items"]).toBe(1);
    expect(cbs[0].name).toBe(fieldName("a"));
  });

  it("rating berlabel → menyertakan TextCaption legend", () => {
    const flow = buildSurveyFlow({
      questions: [q("r", "rating", { min: 1, max: 5, minLabel: "Buruk", maxLabel: "Bagus" })],
    });
    const caps = findByType(flow, "TextCaption");
    expect(caps.some((c: any) => c.text.includes("Buruk") && c.text.includes("Bagus"))).toBe(true);
  });

  it("image tidak didukung di flow", () => {
    expect(flowSupported(q("i", "image"))).toBe(false);
    expect(flowSupported(q("m", "multichoice"))).toBe(true);
  });
});

describe("multi-layar", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => q(`q${i}`, "text"));

  it("splitScreens: potong otomatis tiap N pertanyaan", () => {
    expect(splitScreens(many(10), 4).map((s) => s.length)).toEqual([4, 4, 2]);
  });

  it("splitScreens: penanda manual newScreen memotong layar", () => {
    const qs = [q("a", "text"), q("b", "text"), q("c", "text")];
    qs[2]!.options = { newScreen: true };
    expect(splitScreens(qs, 10).map((s) => s.map((x) => x.id))).toEqual([["a", "b"], ["c"]]);
  });

  it("splitScreens: penanda manual + potong otomatis di dalam seksi panjang", () => {
    const qs = many(5);
    qs[2]!.options = { newScreen: true }; // seksi 1 = q0,q1 · seksi 2 = q2,q3,q4
    expect(splitScreens(qs, 2).map((s) => s.length)).toEqual([2, 2, 1]);
  });

  it("layar pertama tetap ber-id SURVEY; antar layar navigate, terakhir complete", () => {
    const flow: any = buildSurveyFlow({ title: "S", questions: many(5), flowPerScreen: 2 });
    expect(flow.screens).toHaveLength(3);
    expect(flow.screens[0].id).toBe("SURVEY"); // dipakai provider.sendFlow
    expect(flow.screens[0].terminal).toBeUndefined();
    expect(flow.screens[2].terminal).toBe(true);

    const footer = (s: any) => findByType(s, "Footer")[0]["on-click-action"];
    expect(footer(flow.screens[0]).name).toBe("navigate");
    expect(footer(flow.screens[0]).next).toEqual({ type: "screen", name: "SURVEY_B" });
    expect(footer(flow.screens[2]).name).toBe("complete");
  });

  // Meta menolak id layar yang mengandung ANGKA:
  // "Property 'id' should only consist of alphabets and underscores."
  it("id layar HANYA huruf & underscore (tanpa angka) dan target navigate cocok", () => {
    const flow: any = buildSurveyFlow({ title: "S", questions: many(60), flowPerScreen: 2 }); // 30 layar
    const ids = flow.screens.map((s: any) => s.id);
    expect(ids.every((id: string) => /^[A-Za-z_]+$/.test(id))).toBe(true);
    expect(ids.slice(0, 4)).toEqual(["SURVEY", "SURVEY_B", "SURVEY_C", "SURVEY_D"]);
    expect(new Set(ids).size).toBe(ids.length); // tidak ada id kembar

    // setiap navigate menunjuk ke id layar yang benar-benar ada
    const idSet = new Set(ids);
    flow.screens.forEach((s: any, i: number) => {
      const act = findByType(s, "Footer")[0]["on-click-action"];
      if (act.name === "navigate") {
        expect(idSet.has(act.next.name)).toBe(true);
        expect(act.next.name).toBe(ids[i + 1]);
      }
    });
  });

  it("payload complete memuat SEMUA jawaban lintas layar (data diteruskan)", () => {
    const flow: any = buildSurveyFlow({ title: "S", questions: many(4), flowPerScreen: 2 });
    const finalPayload = findByType(flow.screens[1], "Footer")[0]["on-click-action"].payload;
    expect(Object.keys(finalPayload).sort()).toEqual(["q_q0", "q_q1", "q_q2", "q_q3"]);
    // Layar sebelumnya diambil dari ${data.…}, layar ini dari ${form.…}
    expect(finalPayload.q_q0).toBe("${data.q_q0}");
    expect(finalPayload.q_q2).toBe("${form.q_q2}");
    // dan layar 2 mendeklarasikan data dari layar 1
    expect(Object.keys(flow.screens[1].data).sort()).toEqual(["q_q0", "q_q1"]);
  });

  it("judul seksi → TextHeading, dan ada penanda 'Bagian x dari y'", () => {
    const qs = many(3);
    qs[2]!.options = { newScreen: true, screenTitle: "Bagian Demografi" };
    const flow: any = buildSurveyFlow({ title: "S", questions: qs, flowPerScreen: 10 });
    expect(findByType(flow.screens[1], "TextHeading")[0].text).toBe("Bagian Demografi");
    expect(findByType(flow, "TextCaption").some((c: any) => c.text === "Bagian 2 dari 2")).toBe(true);
  });

  it("satu layar (pertanyaan sedikit) → tanpa penanda bagian, langsung complete", () => {
    const flow: any = buildSurveyFlow({ title: "S", questions: many(2), flowPerScreen: 4 });
    expect(flow.screens).toHaveLength(1);
    expect(flow.screens[0].id).toBe("SURVEY");
    expect(findByType(flow, "TextCaption").some((c: any) => /Bagian/.test(c.text))).toBe(false);
    expect(findByType(flow, "Footer")[0]["on-click-action"].name).toBe("complete");
  });
});

describe("skip logic di Flow (komponen If)", () => {
  const ifs = (flow: any) => findByType(flow, "If");

  it("boolean: 'Tidak' → lompat ke Selesai; soal sesudahnya dibungkus If", () => {
    const q0 = q("a", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q("b", "text"), q("c", "text")], flowPerScreen: 10 });
    const wrapped = ifs(flow);
    expect(wrapped).toHaveLength(2); // b & c bisa dilewati
    expect(wrapped[0].condition).toBe("${form.q_a} != 'Tidak'");
    // pemicu sendiri tidak dibungkus
    expect(findByType(wrapped[0].then, "RadioButtonsGroup")).toHaveLength(0);
  });

  it("choice: kondisi memakai INDEKS pilihan, bukan teks jawaban", () => {
    // branches menyimpan teks "Tidak tahu" → di Flow field-nya id "1"
    const q0 = q("a", "choice", { choices: ["Tahu", "Tidak tahu"], branches: [{ value: "Tidak tahu", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q("b", "text")], flowPerScreen: 10 });
    expect(ifs(flow)[0].condition).toBe("${form.q_a} != '1'");
  });

  it("goto indeks: hanya soal DI ANTARA yang dilewati, soal target tetap tampil", () => {
    // a(0) jika "Ya" → lompat ke indeks 3 (soal d). Berarti b(1) & c(2) dilewati, d(3) tidak.
    const q0 = q("a", "boolean", { branches: [{ value: "Ya", goto: 3 }] });
    const flow: any = buildSurveyFlow({
      questions: [q0, q("b", "text"), q("c", "text"), q("d", "text")],
      flowPerScreen: 10,
    });
    const wrapped = ifs(flow);
    expect(wrapped).toHaveLength(2); // hanya b & c
    expect(wrapped.every((w: any) => w.condition === "${form.q_a} != 'Ya'")).toBe(true);
    // d tidak dibungkus → TextArea-nya ada di luar If
    const dField = findByType(flow, "TextArea").map((t: any) => t.name);
    expect(dField).toContain(fieldName("d"));
  });

  // eslint-disable-next-line no-template-curly-in-string
  it("pemicu di layar sebelumnya → kondisi memakai data.…, bukan form.…", () => {
    const q0 = q("a", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q("b", "text"), q("c", "text")], flowPerScreen: 1 });
    // layar 1 = a, layar 2 = b, layar 3 = c
    expect(ifs(flow.screens[1])[0].condition).toBe("${data.q_a} != 'Tidak'");
    expect(ifs(flow.screens[2])[0].condition).toBe("${data.q_a} != 'Tidak'");
    // field pemicu memang dideklarasikan di data layar tsb (kalau tidak, kondisi invalid)
    expect(flow.screens[1].data.q_a).toBeDefined();
  });

  it("indeks goto mengacu daftar LENGKAP (tipe image ikut dihitung walau dilewati Flow)", () => {
    // a(0) jika "Ya" → goto 2. img(1) tak didukung Flow. b(2) adalah TARGET → harus tampil.
    const q0 = q("a", "boolean", { branches: [{ value: "Ya", goto: 2 }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q("img", "image"), q("b", "text")], flowPerScreen: 10 });
    expect(ifs(flow)).toHaveLength(0); // tak ada yang dilewati di antara a dan target
  });

  // Grammar Flow menolak perbandingan yang langsung disambung && tanpa kurung:
  // "Wrong positioning of operator '&&'. It cannot be used in concatenation with '!='"
  it("dua pemicu → tiap perbandingan DIKURUNG saat digabung dengan &&", () => {
    const q0 = q("a", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const q1 = q("b", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q1, q("c", "text")], flowPerScreen: 10 });
    const cWrap = ifs(flow).find((w: any) => findByType(w.then, "TextArea").length);
    expect(cWrap.condition).toBe("(${form.q_a} != 'Tidak') && (${form.q_b} != 'Tidak')");
  });

  it("kondisi tunggal TIDAK dikurung (layar 1 yang diterima Meta)", () => {
    const q0 = q("a", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q("b", "text")], flowPerScreen: 10 });
    expect(ifs(flow)[0].condition).toBe("${form.q_a} != 'Tidak'");
  });

  it("setiap kondisi ber-&& selalu punya perbandingan yang dikurung", () => {
    const q0 = q("a", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const q1 = q("b", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const q2 = q("c", "boolean", { branches: [{ value: "Tidak", goto: "end" }] });
    const flow: any = buildSurveyFlow({ questions: [q0, q1, q2, q("d", "text")], flowPerScreen: 2 });
    for (const w of ifs(flow)) {
      if (!w.condition.includes("&&")) continue;
      // tiap bagian yang dipisah && harus berbentuk (…)
      for (const part of w.condition.split("&&")) expect(part.trim()).toMatch(/^\(.*\)$/);
    }
  });

  it("tanpa percabangan → tidak ada If sama sekali", () => {
    const flow: any = buildSurveyFlow({ questions: [q("a", "text"), q("b", "text")] });
    expect(ifs(flow)).toHaveLength(0);
  });
});

describe("tipe baru: date & consent", () => {
  it("date → DatePicker, consent → OptIn", () => {
    const flow: any = buildSurveyFlow({ questions: [q("d", "date"), q("c", "consent")] });
    expect(findByType(flow, "DatePicker")[0].name).toBe(fieldName("d"));
    expect(findByType(flow, "OptIn")[0].name).toBe(fieldName("c"));
  });

  it("parse: DatePicker (timestamp ms) → YYYY-MM-DD; OptIn (boolean) → Ya/Tidak", () => {
    const qs = [q("d", "date"), q("c", "consent")];
    const ms = Date.UTC(2026, 7, 17); // 17 Agustus 2026
    const out = parseFlowAnswers({ [fieldName("d")]: String(ms), [fieldName("c")]: true }, qs);
    expect(out).toEqual([
      { questionId: "d", value: "2026-08-17" },
      { questionId: "c", value: "Ya" },
    ]);
  });

  it("consent false → Tidak (bukan dianggap kosong)", () => {
    const qs = [q("c", "consent")];
    expect(parseFlowAnswers({ [fieldName("c")]: false }, qs)).toEqual([{ questionId: "c", value: "Tidak" }]);
  });
});

describe("parseFlowAnswers", () => {
  it("multichoice: array id → teks pilihan digabung", () => {
    const qs = [q("a", "multichoice", { choices: ["X", "Y", "Z"] })];
    const out = parseFlowAnswers({ [fieldName("a")]: ["0", "2"] }, qs);
    expect(out).toEqual([{ questionId: "a", value: "X, Z" }]);
  });
  it("choice: id tunggal → teks pilihan", () => {
    const qs = [q("c", "choice", { choices: ["X", "Y"] })];
    expect(parseFlowAnswers({ [fieldName("c")]: "1" }, qs)).toEqual([{ questionId: "c", value: "Y" }]);
  });

  // Kasus nyata: Flow terbit di Meta memakai id pertanyaan dari survei LAIN/lama →
  // tak satu pun nama field cocok. Jawaban harus tetap terselamatkan lewat urutan field.
  it("flow tidak sinkron (id lama) + jumlah sama → diselamatkan lewat urutan", () => {
    const qs = [q("baru1", "boolean"), q("baru2", "rating", { min: 1, max: 10 })];
    const resp = { q_lama1: "Ya", q_lama2: "5", flow_token: "resp_x" };
    expect(flowOutOfSync(resp, qs)).toBe(true);
    expect(parseFlowAnswers(resp, qs)).toEqual([
      { questionId: "baru1", value: "Ya" },
      { questionId: "baru2", value: "5" },
    ]);
  });

  it("flow tidak sinkron TAPI jumlah beda → kosong (jangan salah pasang jawaban)", () => {
    const qs = [q("baru1", "boolean"), q("baru2", "rating")];
    const resp = { q_lama1: "Ya", flow_token: "resp_x" }; // 1 field vs 2 pertanyaan
    expect(flowOutOfSync(resp, qs)).toBe(true);
    expect(parseFlowAnswers(resp, qs)).toEqual([]);
  });

  it("flow tidak sinkron & urutan tertukar → dibatalkan (jangan salah pasang)", () => {
    // Pertanyaan sekarang: [boolean, rating 1-10]. Flow lama mengirim urutan terbalik
    // (rating dulu, baru boolean) → nilai "7" tak masuk akal untuk boolean → batal.
    const qs = [q("baru1", "boolean"), q("baru2", "rating", { min: 1, max: 10 })];
    const resp = { q_lama1: "7", q_lama2: "Ya", flow_token: "resp_x" };
    expect(flowOutOfSync(resp, qs)).toBe(true);
    expect(parseFlowAnswers(resp, qs)).toEqual([]);
  });

  it("flow sinkron → flowOutOfSync false, tidak memakai jalur cadangan", () => {
    const qs = [q("a", "boolean")];
    const resp = { [fieldName("a")]: "Ya", flow_token: "resp_x" };
    expect(flowOutOfSync(resp, qs)).toBe(false);
    expect(parseFlowAnswers(resp, qs)).toEqual([{ questionId: "a", value: "Ya" }]);
  });
});
