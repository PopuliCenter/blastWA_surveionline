import { describe, it, expect } from "vitest";
import {
  JALUR_TAK_TERCATAT,
  JENDELA_IKLAN_MS,
  iklanDariReferral,
  labelAsal,
  tentukanJalur,
} from "../src/lib/jalurRespons.js";
import { MetaCloudAdapter } from "../src/providers/meta.js";

describe("iklanDariReferral", () => {
  it("membaca ID dan judul iklan", () => {
    expect(
      iklanDariReferral({
        source_type: "ad",
        source_id: "2381",
        headline: " Ikut survei ",
        source_url: "https://fb.me/x",
      }),
    ).toEqual({ id: "2381", judul: "Ikut survei" });
    expect(iklanDariReferral({ source_type: "ad", source_id: "2381" })).toEqual({ id: "2381", judul: null });
  });

  it("yang bukan iklan, atau tanpa ID, tidak dihitung iklan", () => {
    expect(iklanDariReferral({ source_type: "post", source_id: "1" })).toBeNull();
    expect(iklanDariReferral({ source_type: "ad" })).toBeNull();
    expect(iklanDariReferral(undefined)).toBeNull();
    expect(iklanDariReferral("ad")).toBeNull();
  });

  it("isi dari luar dibatasi panjangnya", () => {
    const hasil = iklanDariReferral({ source_type: "ad", source_id: "9".repeat(500), headline: "x".repeat(900) });
    expect(hasil?.id).toHaveLength(64);
    expect(hasil?.judul).toHaveLength(200);
  });
});

describe("tentukanJalur", () => {
  const sekarang = new Date("2026-11-03T10:00:00Z");
  const lalu = (jam: number) => new Date(sekarang.getTime() - jam * 3600_000);
  const kontak = (jam: number) => ({ iklanId: "A1", iklanJudul: "Ikut survei", iklanPada: lalu(jam) });

  it("tanpa iklan dan tanpa blast → kata pemicu", () => {
    expect(tentukanJalur({ kontak: null, sekarang })).toEqual({
      jalurMasuk: "kata-pemicu",
      iklanId: null,
      iklanJudul: null,
    });
  });

  it("balasan atas blast → broadcast", () => {
    expect(tentukanJalur({ kontak: {}, blastPada: lalu(1), sekarang }).jalurMasuk).toBe("broadcast");
  });

  it("formulir yang dikirim ulang mewarisi asalnya, kecuali ada ketukan iklan yang baru", () => {
    const warisan = { jalurMasuk: "iklan", iklanId: "LAMA", iklanJudul: "Iklan lama" };
    expect(tentukanJalur({ kontak: {}, warisan, sekarang })).toEqual(warisan);
    expect(tentukanJalur({ kontak: kontak(1), warisan, sekarang }).iklanId).toBe("A1");
    // Ketukan yang sudah kedaluwarsa tidak mengalahkan warisan.
    expect(tentukanJalur({ kontak: kontak(73), warisan, sekarang }).iklanId).toBe("LAMA");
  });

  it("iklan yang diketuk dalam 72 jam → iklan, walau surveinya baru dimulai belakangan", () => {
    expect(tentukanJalur({ kontak: kontak(71), sekarang })).toEqual({
      jalurMasuk: "iklan",
      iklanId: "A1",
      iklanJudul: "Ikut survei",
    });
  });

  it("iklan yang sudah lewat 72 jam tidak lagi dihitung", () => {
    expect(
      tentukanJalur({
        kontak: { ...kontak(0), iklanPada: new Date(sekarang.getTime() - JENDELA_IKLAN_MS - 1) },
        sekarang,
      }).jalurMasuk,
    ).toBe("kata-pemicu");
  });

  it("iklan vs blast: yang lebih baru yang menjelaskan kenapa ia datang", () => {
    expect(tentukanJalur({ kontak: kontak(1), blastPada: lalu(5), sekarang }).jalurMasuk).toBe("iklan");
    const blastLebihBaru = tentukanJalur({ kontak: kontak(5), blastPada: lalu(1), sekarang });
    expect(blastLebihBaru).toEqual({ jalurMasuk: "broadcast", iklanId: null, iklanJudul: null });
  });
});

describe("labelAsal", () => {
  const dasar = { saluran: "whatsapp", jalurMasuk: null, metode: null, blastId: null, iklanId: null };

  it("respons baru memakai yang tercatat", () => {
    expect(labelAsal({ ...dasar, jalurMasuk: "iklan", metode: "form", iklanId: "A1" }, "chat")).toEqual({
      saluran: "WhatsApp",
      jalurMasuk: "Iklan",
      metode: "Form",
      iklanId: "A1",
    });
    expect(labelAsal({ ...dasar, jalurMasuk: "kata-pemicu", metode: "chatbot" }, "flow").jalurMasuk).toBe(
      "Kata pemicu",
    );
  });

  it("respons lama: blastId tetap berarti broadcast, selebihnya tidak ditebak", () => {
    expect(labelAsal({ ...dasar, blastId: "b1" }, "flow")).toMatchObject({ jalurMasuk: "Broadcast", metode: "Form" });
    expect(labelAsal(dasar, "chat")).toMatchObject({ jalurMasuk: JALUR_TAK_TERCATAT, metode: "Chatbot" });
  });
});

describe("webhook Meta membawa data iklan", () => {
  const meta = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });
  const parse = (msg: object) =>
    meta.parseInbound({
      rawBody: "",
      headers: {},
      body: { entry: [{ changes: [{ value: { messages: [{ from: "6281", id: "m1", timestamp: "1", ...msg }] } }] }] },
    } as never);

  it("pesan dari iklan", () => {
    const [ev] = parse({
      type: "text",
      text: { body: "survei" },
      referral: { source_type: "ad", source_id: "2381", headline: "Ikut survei" },
    });
    expect(ev?.iklan).toEqual({ id: "2381", judul: "Ikut survei" });
    expect(ev?.text).toBe("survei");
  });

  it("pesan biasa tanpa data iklan", () => {
    const [ev] = parse({ type: "text", text: { body: "halo" } });
    expect(ev?.iklan).toBeUndefined();
  });
});
