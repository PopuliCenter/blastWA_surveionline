import { describe, it, expect } from "vitest";
import { canTransition, counterField, countersFromStatuses, ALLOWED_FROM } from "../src/lib/deliveryStatus.js";

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

describe("countersFromStatuses (dipakai skrip backfill)", () => {
  it("menghitung nomor yang sudah dibaca sebagai sudah sampai juga", () => {
    // Corong: 'read' pasti melewati 'delivered'.
    expect(countersFromStatuses({ sent: 2, delivered: 3, read: 5 })).toEqual({
      deliveredCount: 8,
      readCount: 5,
      failedCount: 0,
    });
  });

  it("menghasilkan nol untuk blast yang belum menghasilkan status apa pun", () => {
    expect(countersFromStatuses({ queued: 10 })).toEqual({ deliveredCount: 0, readCount: 0, failedCount: 0 });
  });

  it("menghitung gagal sekali per nomor, bukan sebanyak percobaan ulangnya", () => {
    expect(countersFromStatuses({ sent: 7, failed: 3 }).failedCount).toBe(3);
  });

  it("tidak pernah menghasilkan angka sampai melebihi jumlah penerima", () => {
    const byStatus = { queued: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const c = countersFromStatuses(byStatus);
    expect(c.deliveredCount).toBeLessThanOrEqual(total);
    expect(c.readCount).toBeLessThanOrEqual(c.deliveredCount); // dibaca <= sampai
  });

  it("memperbaiki kasus nyata: sampai 12 dari terkirim 10 menjadi konsisten", () => {
    // 10 penerima: 8 sampai (3 di antaranya dibaca), 1 masih 'sent', 1 gagal.
    const c = countersFromStatuses({ sent: 1, delivered: 5, read: 3, failed: 1 });
    expect(c).toEqual({ deliveredCount: 8, readCount: 3, failedCount: 1 });
    expect(c.deliveredCount).toBeLessThanOrEqual(10);
  });

  it("hasilnya stabil bila dijalankan berulang kali", () => {
    const byStatus = { sent: 2, delivered: 3, read: 5, failed: 1 };
    expect(countersFromStatuses(byStatus)).toEqual(countersFromStatuses(byStatus));
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
