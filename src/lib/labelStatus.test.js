import { describe, it, expect } from "vitest";
import { statusBlast, statusSurvei } from "./labelStatus";

describe("label status", () => {
  it("survei", () => {
    expect(statusSurvei("active")).toEqual({ tone: "green", label: "Berjalan" });
    expect(statusSurvei("draft")).toEqual({ tone: "yellow", label: "Draf" });
    expect(statusSurvei("closed")).toEqual({ tone: "default", label: "Ditutup" });
  });

  it("blast", () => {
    expect(statusBlast("completed")).toEqual({ tone: "green", label: "Selesai" });
    expect(statusBlast("failed")).toEqual({ tone: "red", label: "Gagal" });
    expect(statusBlast("scheduled")).toEqual({ tone: "yellow", label: "Terjadwal" });
    expect(statusBlast("running").label).toBe("Mengirim");
    expect(statusBlast("pending").label).toBe("Menunggu");
  });

  it("status yang belum dikenal tetap tampil apa adanya", () => {
    expect(statusSurvei("archived")).toEqual({ tone: "default", label: "archived" });
    expect(statusBlast(undefined).label).toBe("—");
  });
});
