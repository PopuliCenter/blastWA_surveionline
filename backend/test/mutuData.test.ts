import { describe, it, expect } from "vitest";
import {
  jawabanSeragam,
  rasioKelengkapan,
  namaJanggal,
  sidikJawaban,
  menolakMenjawab,
  periksaRespons,
  MIN_SKALA_SERAGAM,
  type RingkasRespons,
} from "../src/lib/mutuData.js";

const q = (id: string, type: string) => ({ id, text: id, type });
const a = (questionId: string, value: string) => ({ questionId, value });

describe("jawabanSeragam (straightlining)", () => {
  const skala = [q("s1", "rating"), q("s2", "rating"), q("s3", "choice"), q("s4", "choice"), q("s5", "rating")];

  it("menandai jawaban berskala yang semuanya bernilai sama", () => {
    expect(jawabanSeragam(skala, [a("s1", "5"), a("s2", "5"), a("s3", "5"), a("s4", "5"), a("s5", "5")])).toBe(true);
  });

  it("satu jawaban berbeda sudah cukup membatalkannya", () => {
    expect(jawabanSeragam(skala, [a("s1", "5"), a("s2", "5"), a("s3", "5"), a("s4", "4"), a("s5", "5")])).toBe(false);
  });

  it("tidak menuduh berdasarkan jawaban yang terlalu sedikit", () => {
    // Tiga jawaban yang kebetulan sama bukan pola. Ambang yang terlalu rendah akan
    // menghasilkan lebih banyak salah tuduh daripada temuan.
    expect(jawabanSeragam(skala, [a("s1", "5"), a("s2", "5"), a("s3", "5")])).toBe(false);
    expect(MIN_SKALA_SERAGAM).toBe(5);
  });

  it("pertanyaan teks tidak ikut dihitung", () => {
    // Dua orang yang sama-sama menulis "tidak ada" pada isian bebas bukan straightlining.
    const campur = [q("t1", "text"), q("t2", "text"), q("t3", "text"), q("t4", "text"), q("t5", "text")];
    expect(jawabanSeragam(campur, [a("t1", "x"), a("t2", "x"), a("t3", "x"), a("t4", "x"), a("t5", "x")])).toBe(false);
  });

  it("penolakan menjawab tidak dihitung sebagai jawaban seragam", () => {
    // Responden yang menolak di semua pertanyaan sudah tertangkap pemeriksaan lain; kalau
    // ikut dihitung di sini, ia tertuduh dua kali untuk satu perilaku yang sama.
    const jawab = [
      a("s1", "Menolak menjawab"),
      a("s2", "Menolak menjawab"),
      a("s3", "Menolak menjawab"),
      a("s4", "Menolak menjawab"),
      a("s5", "Menolak menjawab"),
    ];
    expect(jawabanSeragam(skala, jawab)).toBe(false);
  });
});

describe("rasioKelengkapan", () => {
  it("dihitung atas pertanyaan yang BERLAKU, bukan seluruh survei", () => {
    // Responden yang tersaring di urutan 0 hanya punya 1 pertanyaan berlaku; kalau
    // pembaginya 27, ia akan selalu tampak tidak lengkap padahal justru paling patuh.
    expect(rasioKelengkapan(1, 1)).toBe(1);
    expect(rasioKelengkapan(27, 27)).toBe(1);
    expect(rasioKelengkapan(20, 10)).toBe(0.5);
  });

  it("tidak pernah melebihi 1 atau membagi nol", () => {
    expect(rasioKelengkapan(0, 0)).toBe(1);
    expect(rasioKelengkapan(5, 9)).toBe(1);
  });
});

describe("namaJanggal", () => {
  it("menandai nama yang hampir pasti bukan nama", () => {
    // Contoh nyata dari data: "zy", "&y".
    expect(namaJanggal("zy")).toBe(true);
    expect(namaJanggal("&y")).toBe(true);
    expect(namaJanggal("😀")).toBe(true);
  });

  it("tidak menandai nama wajar, termasuk yang berhias emoji", () => {
    expect(namaJanggal("Budi")).toBe(false);
    expect(namaJanggal("Azlina Rafika 🌺")).toBe(false);
    expect(namaJanggal("MHD ZIKRI NG.S.H")).toBe(false);
  });

  it("nama kosong BUKAN janggal", () => {
    // Banyak kontak impor memang tanpa nama; menandainya akan membanjiri laporan dengan
    // temuan yang tidak berarti apa-apa.
    expect(namaJanggal("")).toBe(false);
    expect(namaJanggal(null)).toBe(false);
  });
});

describe("sidikJawaban", () => {
  it("tidak terpengaruh urutan penyimpanan", () => {
    expect(sidikJawaban([a("q1", "Ya"), a("q2", "Tidak")])).toBe(sidikJawaban([a("q2", "Tidak"), a("q1", "Ya")]));
  });

  it("membedakan isi yang berbeda", () => {
    expect(sidikJawaban([a("q1", "Ya")])).not.toBe(sidikJawaban([a("q1", "Tidak")]));
  });
});

describe("menolakMenjawab", () => {
  it("mengenali nilai penolakan yang dipakai instrumen", () => {
    expect(menolakMenjawab("Menolak menjawab")).toBe(true);
    expect(menolakMenjawab("  TIDAK TAHU ")).toBe(true);
    expect(menolakMenjawab("[dilewati]")).toBe(true);
    expect(menolakMenjawab("Jawa Barat")).toBe(false);
  });
});

describe("periksaRespons", () => {
  const dasar: RingkasRespons = {
    id: "r1",
    nama: "Budi",
    menit: 6,
    berlaku: 20,
    terjawab: 20,
    ditolakPenyaringan: 0,
    seragam: false,
    menolak: 0,
    sidik: null,
  };

  it("respons bersih tidak menghasilkan temuan apa pun", () => {
    expect(periksaRespons(dasar, new Map())).toEqual([]);
  });

  it("satu responden bisa kena beberapa pemeriksaan sekaligus", () => {
    const kode = periksaRespons(
      { ...dasar, menit: 1.2, seragam: true, nama: "zy", terjawab: 8, menolak: 6 },
      new Map(),
    ).map((t) => t.kode);
    expect(kode).toContain("cepat");
    expect(kode).toContain("seragam");
    expect(kode).toContain("namaJanggal");
    expect(kode).toContain("banyakMenolak");
    expect(kode).toContain("tidakLengkap");
  });

  it("kembar hanya saat sidiknya memang muncul lebih dari sekali", () => {
    const sidik = "x";
    expect(periksaRespons({ ...dasar, sidik }, new Map([[sidik, 1]])).map((t) => t.kode)).not.toContain("kembar");
    const t = periksaRespons({ ...dasar, sidik }, new Map([[sidik, 3]]));
    expect(t.map((x) => x.kode)).toContain("kembar");
    expect(t.find((x) => x.kode === "kembar")?.pesan).toContain("2 respons lain");
  });

  it("durasi tak terhitung tidak dianggap cepat", () => {
    expect(periksaRespons({ ...dasar, menit: null }, new Map()).map((t) => t.kode)).not.toContain("cepat");
  });
});
