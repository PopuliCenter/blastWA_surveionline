import { describe, it, expect } from "vitest";
import { pesanGalatApi } from "./pesanGalat";

describe("pesanGalatApi", () => {
  it("meneruskan pesan string apa adanya", () => {
    expect(pesanGalatApi({ error: "Kuota sudah penuh." }, 400)).toBe("Kuota sudah penuh.");
  });

  it("membaca galat validasi Zod, bukan menampilkan [object Object]", () => {
    // Bentuk nyata yang membuat layar menampilkan "[object Object]" saat menyimpan survei
    // berpertanyaan wilayah.
    const data = {
      error: { formErrors: [], fieldErrors: { questions: ["Invalid enum value. Expected 'text' | ... "] } },
    };
    const p = pesanGalatApi(data, 400);
    expect(p).toContain("questions");
    expect(p).toContain("Invalid enum value");
    expect(p).not.toContain("[object Object]");
  });

  it("menggabungkan beberapa bidang yang bermasalah", () => {
    const data = { error: { formErrors: ["Badan permintaan kosong"], fieldErrors: { title: ["Wajib diisi"] } } };
    expect(pesanGalatApi(data, 400)).toBe("Badan permintaan kosong · title: Wajib diisi");
  });

  it("mendahulukan message bila ada", () => {
    expect(pesanGalatApi({ error: { message: "Terlalu banyak permintaan" } }, 429)).toBe("Terlalu banyak permintaan");
  });

  it("objek tak dikenal tetap ditampilkan isinya", () => {
    // Jelek dibaca, tapi jauh lebih berguna daripada "[object Object]".
    expect(pesanGalatApi({ error: { kode: 7, sebab: "entah" } }, 500)).toContain("sebab");
  });

  it("jatuh ke kode status bila tidak ada keterangan apa pun", () => {
    expect(pesanGalatApi({}, 503)).toBe("HTTP 503");
    expect(pesanGalatApi(null, 500)).toBe("HTTP 500");
    expect(pesanGalatApi({ error: "   " }, 500)).toBe("HTTP 500");
    expect(pesanGalatApi({ error: {} }, 500)).toBe("HTTP 500");
  });
});
