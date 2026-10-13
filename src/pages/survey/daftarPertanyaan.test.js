import { describe, it, expect } from "vitest";
import {
  gandakanPertanyaan,
  hapusPertanyaan,
  geserPertanyaan,
  teksSalinan,
  cabangTakBerlaku,
  teksGanda,
  indeksTujuan,
} from "./daftarPertanyaan";

// Survei kecil dengan percabangan, ditulis supaya tujuan setiap aturan mudah dilacak:
//   0 Tahu program?   — "Tidak" → 3 (lompati penilaian)
//   1 Nilai program?
//   2 Alasan?
//   3 Usia?
//   4 Bersedia?       — "Tidak" → end
const survei = () => [
  { id: "a", text: "Tahu program?", type: "boolean", options: { branches: [{ value: "Tidak", goto: 3 }] } },
  { id: "b", text: "Nilai program?", type: "rating", options: { min: 1, max: 5 } },
  { id: "c", text: "Alasan?", type: "text" },
  { id: "d", text: "Usia?", type: "number" },
  { id: "e", text: "Bersedia?", type: "boolean", options: { branches: [{ value: "Tidak", goto: "end" }] } },
];
const tujuan = (qs, id) => qs.find((q) => q.id === id).options.branches[0].goto;
const teksDi = (qs, i) => qs[i].text;

describe("gandakanPertanyaan", () => {
  it("menyisipkan salinan tepat di bawah aslinya", () => {
    const { questions } = gandakanPertanyaan(survei(), 1, "baru");
    expect(questions.map((q) => q.id)).toEqual(["a", "b", "baru", "c", "d", "e"]);
  });

  it("aturan yang menunjuk ke belakang titik sisip tetap menuju pertanyaan yang SAMA", () => {
    // Tanpa pemetaan ulang, "Tidak" → 3 kini menunjuk "Alasan?" — responden yang tidak
    // tahu programnya malah ditanya alasannya.
    const { questions } = gandakanPertanyaan(survei(), 1, "baru");
    expect(teksDi(questions, tujuan(questions, "a"))).toBe("Usia?");
  });

  it("salinan membawa percabangan aslinya, dipetakan ke pertanyaan yang sama", () => {
    const { questions } = gandakanPertanyaan(survei(), 0, "baru");
    const salinan = questions[1];
    expect(salinan.id).toBe("baru");
    expect(teksDi(questions, salinan.options.branches[0].goto)).toBe("Usia?");
    expect(salinan.options.branches[0].goto).toBeGreaterThan(1); // tetap lompatan maju
  });

  it("'end' tidak disentuh", () => {
    const { questions } = gandakanPertanyaan(survei(), 4, "baru");
    expect(tujuan(questions, "e")).toBe("end");
    expect(questions[5].options.branches[0].goto).toBe("end");
  });

  it("teksnya dibedakan, supaya jawaban tidak bertumpuk di satu kolom ekspor", () => {
    const { questions } = gandakanPertanyaan(survei(), 2, "baru");
    expect(questions[3].text).toBe("Alasan? (salinan)");
    expect(teksGanda(questions)).toEqual([]);
  });

  it("menyunting pilihan salinan tidak mengubah aslinya", () => {
    const awal = [{ id: "a", text: "Pilih", type: "choice", options: { choices: ["X", "Y"] } }];
    const { questions } = gandakanPertanyaan(awal, 0, "baru");
    questions[1].options.choices.push("Z");
    expect(awal[0].options.choices).toEqual(["X", "Y"]);
    expect(questions[0].options.choices).toEqual(["X", "Y"]);
  });
});

describe("teksSalinan", () => {
  it("menomori salinan berikutnya, bukan menumpuk akhiran", () => {
    expect(teksSalinan("Usia?", ["Usia?"])).toBe("Usia? (salinan)");
    expect(teksSalinan("Usia?", ["Usia?", "Usia? (salinan)"])).toBe("Usia? (salinan 2)");
    expect(teksSalinan("Usia? (salinan)", ["Usia?", "Usia? (salinan)"])).toBe("Usia? (salinan 2)");
  });
});

describe("hapusPertanyaan", () => {
  it("aturan sesudah titik hapus tetap menuju pertanyaan yang sama", () => {
    const { questions, dilepas } = hapusPertanyaan(survei(), 1);
    expect(teksDi(questions, tujuan(questions, "a"))).toBe("Usia?");
    expect(dilepas).toBe(0);
  });

  it("tujuan yang terhapus dialihkan ke pertanyaan yang kini menempati posisinya", () => {
    const { questions } = hapusPertanyaan(survei(), 3); // hapus "Usia?"
    expect(teksDi(questions, tujuan(questions, "a"))).toBe("Bersedia?");
  });

  it("tujuan pertanyaan TERAKHIR yang terhapus dilepas — tidak pernah diubah jadi 'end'", () => {
    // "end" berarti tersaring keluar: tidak dihitung ke kuota. Mengubah lompatan biasa
    // menjadi "end" diam-diam membuang responden yang sah.
    const qs = [
      { id: "a", text: "A", type: "boolean", options: { branches: [{ value: "Ya", goto: 2 }] } },
      { id: "b", text: "B", type: "text" },
      { id: "c", text: "C", type: "text" },
    ];
    const { questions, dilepas } = hapusPertanyaan(qs, 2);
    expect(questions[0].options.branches).toBeUndefined();
    expect(dilepas).toBe(1);
  });
});

describe("geserPertanyaan", () => {
  it("aturan mengikuti pertanyaan tujuannya ke posisi barunya", () => {
    // Geser "Usia?" (3) naik ke 2 — "Tidak" harus tetap menuju "Usia?".
    const { questions } = geserPertanyaan(survei(), 3, -1);
    expect(teksDi(questions, tujuan(questions, "a"))).toBe("Usia?");
    expect(tujuan(questions, "a")).toBe(2);
  });

  it("menggeser di luar batas tidak mengubah apa pun", () => {
    const awal = survei();
    expect(geserPertanyaan(awal, 0, -1).questions).toBe(awal);
  });
});

describe("cabangTakBerlaku", () => {
  it("menandai aturan yang menunjuk ke atas — mesin hanya melompat maju", () => {
    const q = {
      options: {
        branches: [
          { value: "Ya", goto: 1 },
          { value: "Tidak", goto: "end" },
        ],
      },
    };
    expect(cabangTakBerlaku(q, 2, 5)).toHaveLength(1);
    expect(cabangTakBerlaku(q, 0, 5)).toHaveLength(0);
  });
});

describe("percabangan bentuk lama dan kasus tepi", () => {
  it("aturan pertanyaan ASLI yang menuju pertanyaan berikutnya kini menuju salinannya", () => {
    // Ya→1 berarti "lanjut ke pertanyaan berikutnya". Bila ikut digeser ke 2, salinan
    // dilompati — dan bila semua jawaban punya aturan, salinan tak pernah ditanyakan.
    const qs = [
      {
        id: "a",
        text: "Punya kendaraan?",
        type: "boolean",
        options: {
          branches: [
            { value: "Ya", goto: 1 },
            { value: "Tidak", goto: 2 },
          ],
        },
      },
      { id: "b", text: "Jenis kendaraan?", type: "text" },
      { id: "c", text: "Usia?", type: "number" },
    ];
    const { questions } = gandakanPertanyaan(qs, 0, "baru");
    const [ya, tidak] = questions[0].options.branches;
    expect(questions[ya.goto].id).toBe("baru");
    expect(questions[tidak.goto].text).toBe("Usia?");
  });

  it("goto -1 diperlakukan sebagai akhir survei, bukan lompatan ke atas", () => {
    // Mesin memperlakukan -1 sama dengan "end" (tersaring keluar). Menandainya "tidak
    // berlaku" akan membuat orang membuang aturan penyaring yang sebenarnya aktif.
    const q = { options: { branches: [{ value: "Tidak", goto: -1 }] } };
    expect(cabangTakBerlaku(q, 3, 5)).toEqual([]);
    const { questions } = hapusPertanyaan(
      [
        { id: "x", text: "X" },
        { id: "y", text: "Y", ...q },
      ],
      0,
    );
    expect(questions[0].options.branches[0].goto).toBe(-1);
  });

  it("goto berupa teks angka ikut dipetakan, sebab mesin membacanya sebagai angka", () => {
    const qs = survei();
    qs[0].options.branches[0].goto = "3";
    const { questions } = gandakanPertanyaan(qs, 1, "baru");
    expect(teksDi(questions, tujuan(questions, "a"))).toBe("Usia?");
  });
});

describe("indeksTujuan", () => {
  it("membaca tujuan seperti mesin membacanya", () => {
    expect(indeksTujuan(3)).toBe(3);
    expect(indeksTujuan("3")).toBe(3);
    expect(indeksTujuan("end")).toBeNull();
    expect(indeksTujuan(-1)).toBeNull();
    expect(indeksTujuan(undefined)).toBeNull();
  });
});
