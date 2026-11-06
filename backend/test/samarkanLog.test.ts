import { describe, it, expect } from "vitest";
import { pasangPenangan404, samarkanUrl, serializerReq } from "../src/lib/samarkanLog.js";

describe("samarkanUrl", () => {
  it("Verify Token dan token akses tidak pernah tercatat utuh", () => {
    expect(
      samarkanUrl(
        "/webhook/instagram?hub.mode=subscribe&hub.challenge=1&hub.verify_token=rahasia&hub_verify_token=rahasia",
      ),
    ).toBe("/webhook/instagram?hub.mode=subscribe&hub.challenge=1&hub.verify_token=***&hub_verify_token=***");
    expect(samarkanUrl("/x?access_token=EAAU123&y=2")).toBe("/x?access_token=***&y=2");
    expect(samarkanUrl("/api/surveys?page=2")).toBe("/api/surveys?page=2");
    expect(samarkanUrl("/tanpa-query")).toBe("/tanpa-query");
    expect(samarkanUrl(undefined)).toBe("");
  });

  it("nama parameter yang di-encode tetap dikenali, seperti oleh parser query Fastify", () => {
    for (const kunci of [
      "hub%2Everify_token",
      "hub.verify%5Ftoken",
      "%68ub.verify_token",
      "access%5Ftoken",
      "HUB.VERIFY_TOKEN",
    ])
      expect(samarkanUrl(`/w?${kunci}=RAHASIA#x`)).toBe(`/w?${kunci}=***#x`);
    expect(samarkanUrl("/w?hub.verify_token")).toBe("/w?hub.verify_token=***");
    expect(samarkanUrl("/w?%E0%A4%A=1")).toBe("/w?%E0%A4%A=1"); // encoding rusak tidak melempar
  });

  it("404 tidak mencatat atau membalas Verify Token", async () => {
    const Fastify = (await import("fastify")).default;
    const baris: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializerReq },
        stream: { write: (s: string) => void baris.push(s) },
      },
    });
    pasangPenangan404(app as never);
    const res = await app.inject({ url: "/webhook/instagram/?hub.verify_token=RAHASIA" });
    await app.close();
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("RAHASIA");
    expect(baris.join("").includes("not found")).toBe(true);
    expect(baris.join("").includes("RAHASIA")).toBe(false);
  });
});
