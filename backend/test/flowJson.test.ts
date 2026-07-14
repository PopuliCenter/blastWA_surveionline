import { describe, it, expect } from "vitest";
import {
  buildSurveyFlow,
  parseFlowAnswers,
  flowOutOfSync,
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
