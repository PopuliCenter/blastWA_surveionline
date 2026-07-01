import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { logErrorSync } from "../src/lib/errorLog.js";

const LOG = "./logs/test-error.log"; // sama dengan ERROR_LOG_FILE di vitest.config.ts

describe("errorLog", () => {
  beforeEach(() => {
    if (existsSync(LOG)) rmSync(LOG);
  });

  it("menulis 1 baris JSON berisi source, message, dan stack untuk Error", () => {
    logErrorSync("backend", new Error("meledak"), { url: "/api/x" });
    const lines = readFileSync(LOG, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]);
    expect(rec.source).toBe("backend");
    expect(rec.message).toBe("meledak");
    expect(rec.stack).toContain("Error");
    expect(rec.context).toEqual({ url: "/api/x" });
    expect(typeof rec.ts).toBe("string");
  });

  it("menangani nilai non-Error (string) dan menambah baris (append)", () => {
    logErrorSync("worker", "gagal koneksi redis");
    logErrorSync("worker", "gagal lagi");
    const lines = readFileSync(LOG, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).message).toBe("gagal koneksi redis");
    expect(JSON.parse(lines[1]).message).toBe("gagal lagi");
  });
});
