import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptJson, decryptJson } from "../src/lib/crypto.js";

// Perpanjangan token Instagram: basis data dan registry vendor ditiru, fetch ditiru.
const db = vi.hoisted(() => ({
  baris: null as null | { vendor: string; active: boolean; credentials: string | null },
  // Disuntikkan di antara permintaan dan penulisan, untuk meniru operator yang menyimpan
  // token baru selagi perpanjangan berjalan.
  sebelumBacaUlang: null as null | (() => void),
  // Disuntikkan tepat sebelum penulisan: operator menyimpan di antara baca ulang dan tulis.
  sebelumTulis: null as null | (() => void),
  dibaca: 0,
}));
const muatUlang = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../src/db.js", () => ({
  prisma: {
    vendorConfig: {
      findUnique: async () => {
        if (++db.dibaca === 2) db.sebelumBacaUlang?.();
        return db.baris ? { ...db.baris } : null;
      },
      // Compare-and-swap: hanya menulis bila blobnya masih sama dengan yang dibaca.
      updateMany: async ({ where, data }: { where: { credentials: string }; data: { credentials: string } }) => {
        db.sebelumTulis?.();
        if (!db.baris || db.baris.credentials !== where.credentials) return { count: 0 };
        db.baris = { ...db.baris, credentials: data.credentials };
        return { count: 1 };
      },
    },
  },
}));
vi.mock("../src/providers/registry.js", () => ({ loadProviders: muatUlang }));
vi.mock("../src/lib/errorLog.js", () => ({ logError: vi.fn() }));

const { perpanjangTokenInstagram, JEDA_PERPANJANG_MS } = await import("../src/services/tokenInstagram.js");

const SEKARANG = new Date("2026-11-06T00:00:00Z");
const simpan = (creds: Record<string, string>) => {
  db.baris = { vendor: "instagram", active: true, credentials: encryptJson(creds) };
};
const kredensial = () => decryptJson<Record<string, string>>(db.baris!.credentials!);
const jawab = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("perpanjangTokenInstagram", () => {
  beforeEach(() => {
    db.baris = null;
    db.sebelumBacaUlang = null;
    db.sebelumTulis = null;
    db.dibaca = 0;
    muatUlang.mockClear();
  });

  it("tanpa kredensial → tidak memanggil apa pun", async () => {
    const f = jawab({});
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("tidak-ada-kredensial");
    expect(f).not.toHaveBeenCalled();
  });

  it("diperpanjang kurang dari 7 hari lalu → belum waktunya", async () => {
    simpan({ accessToken: "lama", tokenDiperpanjangPada: new Date(SEKARANG.getTime() - 86_400_000).toISOString() });
    const f = jawab({});
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("belum-waktunya");
    expect(f).not.toHaveBeenCalled();
  });

  it("lebih dari 7 hari → token baru disimpan terenkripsi, field lain dipertahankan, provider dimuat ulang", async () => {
    simpan({
      accessToken: "lama",
      appSecret: "rahasia",
      tokenDiperpanjangPada: new Date(SEKARANG.getTime() - JEDA_PERPANJANG_MS - 1).toISOString(),
    });
    const f = jawab({ access_token: "baru", token_type: "bearer", expires_in: 5_184_000 });
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("diperpanjang");
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe(
      "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=lama",
    );
    expect(db.baris!.credentials).not.toContain("baru");
    expect(kredensial()).toMatchObject({
      accessToken: "baru",
      appSecret: "rahasia",
      tokenDiperpanjangPada: SEKARANG.toISOString(),
      tokenBerlakuSampai: new Date(SEKARANG.getTime() + 5_184_000_000).toISOString(),
    });
    expect(muatUlang).toHaveBeenCalledOnce();
  });

  it("belum pernah tercatat → langsung diperpanjang", async () => {
    simpan({ accessToken: "lama" });
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: jawab({ access_token: "baru" }) })).toBe(
      "diperpanjang",
    );
    expect(kredensial().accessToken).toBe("baru");
  });

  it("lewat Halaman Facebook (token Halaman) → tidak diperpanjang", async () => {
    simpan({ accessToken: "lama", pageId: "1122" });
    const f = jawab({});
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("tidak-perlu");
    expect(f).not.toHaveBeenCalled();
  });

  it("Meta menolak → gagal, token lama tetap", async () => {
    simpan({ accessToken: "lama" });
    const f = jawab({ error: { message: "Session has expired", code: 190 } }, 400);
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("gagal");
    expect(kredensial().accessToken).toBe("lama");
    expect(muatUlang).not.toHaveBeenCalled();
  });

  it("galat jaringan → gagal, tidak dilempar", async () => {
    simpan({ accessToken: "lama" });
    const f = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: f })).toBe("gagal");
  });

  it("operator menyimpan token baru selama perpanjangan berjalan → token operator tidak ditimpa", async () => {
    simpan({ accessToken: "lama" });
    db.sebelumBacaUlang = () => simpan({ accessToken: "dari-operator" });
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: jawab({ access_token: "baru" }) })).toBe(
      "berubah",
    );
    expect(kredensial().accessToken).toBe("dari-operator");
  });

  it("operator menyimpan tepat di antara baca ulang dan tulis → tetap tidak ditimpa", async () => {
    simpan({ accessToken: "lama" });
    db.sebelumTulis = () => simpan({ accessToken: "dari-operator" });
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: jawab({ access_token: "baru" }) })).toBe(
      "berubah",
    );
    expect(kredensial().accessToken).toBe("dari-operator");
    expect(muatUlang).not.toHaveBeenCalled();
  });

  it("vendor dinonaktifkan pun tokennya tetap diperpanjang, supaya tidak kedaluwarsa selama jeda", async () => {
    simpan({ accessToken: "lama" });
    db.baris!.active = false;
    expect(await perpanjangTokenInstagram({ sekarang: SEKARANG, fetchFn: jawab({ access_token: "baru" }) })).toBe(
      "diperpanjang",
    );
  });
});
