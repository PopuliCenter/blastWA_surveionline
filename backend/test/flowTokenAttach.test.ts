import { describe, it, expect } from "vitest";
import { shouldAttachFlowToken } from "../src/services/blastService.js";
import { buttonTypesOf } from "../src/providers/meta.js";

// Kasus nyata: blast survei mode Flow memakai template ber-QuickReply ("Mulai Survei").
// Sistem menyisipkan parameter tombol Flow di index 0 -> Meta menolak SEMUA penerima:
// #132018 "buttons: Button at index 0 must be of type QuickReply".

describe("shouldAttachFlowToken", () => {
  it("template ber-QuickReply → JANGAN kirim flow_token (blast tetap jalan)", () => {
    expect(
      shouldAttachFlowToken({ surveyIsFlow: true, synced: true, metaButtons: ["QUICK_REPLY", "QUICK_REPLY"] }),
    ).toBe(false);
  });

  it("template ber-tombol FLOW di index 0 → kirim flow_token", () => {
    expect(shouldAttachFlowToken({ surveyIsFlow: true, synced: true, metaButtons: ["FLOW"] })).toBe(true);
  });

  it("FLOW ada tapi BUKAN di index 0 → jangan kirim (Meta menilai per indeks)", () => {
    expect(shouldAttachFlowToken({ surveyIsFlow: true, synced: true, metaButtons: ["QUICK_REPLY", "FLOW"] })).toBe(
      false,
    );
  });

  it("template tanpa tombol sama sekali → jangan kirim", () => {
    expect(shouldAttachFlowToken({ surveyIsFlow: true, synced: true, metaButtons: [] })).toBe(false);
  });

  it("belum disinkron → pertahankan perilaku lama (kirim), agar template Flow sah tak kehilangan korelasi", () => {
    expect(shouldAttachFlowToken({ surveyIsFlow: true, synced: false, metaButtons: [] })).toBe(true);
  });

  it("survei bukan mode Flow → tak pernah kirim flow_token", () => {
    expect(shouldAttachFlowToken({ surveyIsFlow: false, synced: true, metaButtons: ["FLOW"] })).toBe(false);
    expect(shouldAttachFlowToken({ surveyIsFlow: false, synced: false, metaButtons: [] })).toBe(false);
  });
});

describe("buttonTypesOf (baca tipe tombol dari components Meta)", () => {
  it("ambil tipe tombol urut indeks", () => {
    const comps = [
      { type: "BODY", text: "Halo" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Mulai Survei" },
          { type: "QUICK_REPLY", text: "Tidak" },
        ],
      },
    ];
    expect(buttonTypesOf(comps)).toEqual(["QUICK_REPLY", "QUICK_REPLY"]);
  });

  it("tombol FLOW terdeteksi & dinormalkan ke huruf besar", () => {
    expect(buttonTypesOf([{ type: "BUTTONS", buttons: [{ type: "flow", text: "Isi Survei" }] }])).toEqual(["FLOW"]);
  });

  it("tanpa komponen BUTTONS / bentuk tak terduga → array kosong", () => {
    expect(buttonTypesOf([{ type: "BODY", text: "x" }])).toEqual([]);
    expect(buttonTypesOf(undefined)).toEqual([]);
    expect(buttonTypesOf([{ type: "BUTTONS" }])).toEqual([]);
  });
});
