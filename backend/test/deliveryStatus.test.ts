import { describe, it, expect } from "vitest";
import { canTransition, counterField, ALLOWED_FROM } from "../src/lib/deliveryStatus.js";

describe("canTransition", () => {
  it("menolak callback duplikat — status yang sama tidak boleh diproses dua kali", () => {
    // Ini akar masalah "Sampai (12) melebihi Terkirim (10)": Meta mengirim webhook
    // at-least-once, jadi 'delivered' yang sama bisa datang berkali-kali.
    expect(canTransition("delivered", "delivered")).toBe(false);
    expect(canTransition("read", "read")).toBe(false);
    expect(canTransition("sent", "sent")).toBe(false);
    expect(canTransition("failed", "failed")).toBe(false);
  });

  it("mengizinkan alur maju yang wajar", () => {
    expect(canTransition("queued", "sent")).toBe(true);
    expect(canTransition("sent", "delivered")).toBe(true);
    expect(canTransition("delivered", "read")).toBe(true);
  });

  it("mengizinkan lompatan maju bila callback antaranya tidak pernah sampai", () => {
    expect(canTransition("queued", "delivered")).toBe(true);
    expect(canTransition("queued", "read")).toBe(true);
    expect(canTransition("sent", "read")).toBe(true);
  });

  it("menolak status mundur — webhook bisa datang tidak berurutan", () => {
    expect(canTransition("read", "delivered")).toBe(false);
    expect(canTransition("read", "sent")).toBe(false);
    expect(canTransition("delivered", "sent")).toBe(false);
  });

  it("membolehkan pesan terkirim berubah jadi gagal", () => {
    expect(canTransition("queued", "failed")).toBe(true);
    expect(canTransition("sent", "failed")).toBe(true);
  });

  it("menolak pesan gagal berubah jadi terkirim/sampai/dibaca", () => {
    // 'failed' dan 'sent' dulu berperingkat sama, sehingga pemeriksaan berbasis angka
    // meloloskan transisi ini. Daftar eksplisit menutupnya.
    expect(canTransition("failed", "sent")).toBe(false);
    expect(canTransition("failed", "delivered")).toBe(false);
    expect(canTransition("failed", "read")).toBe(false);
  });

  it("menolak status awal yang tidak dikenal", () => {
    expect(canTransition("entahlah", "delivered")).toBe(false);
  });

  it("tidak pernah mengizinkan sebuah status berpindah ke dirinya sendiri", () => {
    for (const [to, froms] of Object.entries(ALLOWED_FROM)) {
      expect(froms).not.toContain(to);
    }
  });
});

describe("counterField", () => {
  it("memetakan status ke kolom penghitung yang benar", () => {
    expect(counterField("delivered")).toBe("deliveredCount");
    expect(counterField("read")).toBe("readCount");
    expect(counterField("failed")).toBe("failedCount");
  });

  it("tidak menaikkan apa pun untuk 'sent' — sentCount sudah diisi saat pengiriman", () => {
    expect(counterField("sent")).toBeNull();
  });
});

describe("skenario burst dari Meta", () => {
  // Simulasi penghitung memakai aturan transisi yang sama dengan handleStatus.
  function replay(events: string[]) {
    let status = "queued";
    const counts = { deliveredCount: 0, readCount: 0, failedCount: 0 };
    for (const ev of events) {
      const next = ev as Parameters<typeof canTransition>[1];
      if (!canTransition(status, next)) continue;
      status = next;
      const f = counterField(next);
      if (f) counts[f] += 1;
    }
    return { status, ...counts };
  }

  it("callback delivered kembar hanya dihitung sekali", () => {
    expect(replay(["sent", "delivered", "delivered", "delivered"])).toEqual({
      status: "delivered",
      deliveredCount: 1,
      readCount: 0,
      failedCount: 0,
    });
  });

  it("satu penerima tidak pernah menyumbang lebih dari satu ke tiap penghitung", () => {
    const r = replay(["sent", "delivered", "read", "delivered", "read", "sent"]);
    expect(r).toEqual({ status: "read", deliveredCount: 1, readCount: 1, failedCount: 0 });
  });

  it("sepuluh penerima menghasilkan paling banyak sepuluh 'delivered' walau webhook berulang", () => {
    const total = Array.from({ length: 10 }, () =>
      replay(["sent", "delivered", "delivered", "read", "read"]),
    ).reduce((a, r) => a + r.deliveredCount, 0);
    expect(total).toBe(10); // sebelum perbaikan: 20
  });
});
