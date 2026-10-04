import { prisma } from "../db.js";
import { periksaKuota, type HasilKuota } from "../lib/kuota.js";
import { kodeProvinsiDari, PROVINSI } from "../lib/wilayah.js";

// Pengambilan angka kuota dari database. Aturannya sendiri ada di lib/kuota.ts.

const NAMA_PROV = new Map(PROVINSI.map((p) => [p.kode, p.nama]));

// Provinsi dari atribut kontak hasil impor.
//
// Ini yang membuat kuota per provinsi benar-benar MENEKAN BIAYA: untuk kontak hasil impor,
// provinsinya sudah diketahui SEBELUM pesan dikirim, sehingga penerima dari provinsi yang
// kuotanya penuh bisa dilewati tanpa satu pesan pun terkirim. Untuk responden organik yang
// datang sendiri, provinsinya baru diketahui dari jawabannya — di situ kuota hanya bisa
// menjaga jumlah data, bukan mencegah biaya.
export function provinsiDariAtribut(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== "object") return null;
  const obj = attributes as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "provinsi" || key === "province" || key === "prov") {
      const kode = kodeProvinsiDari(v);
      if (kode) return kode;
    }
  }
  return null;
}

// Syarat sebuah respons DIHITUNG ke kuota: selesai, dan bukan penolakan consent.
// Dipakai di sini maupun di layar Kuota, supaya angka yang menutup survei dan angka yang
// dilihat pemakai tidak pernah berbeda.
export const DIHITUNG_KE_KUOTA = { completedAt: { not: null }, consentDitolak: false } as const;

export type KuotaSurvei = {
  targetGlobal: number | null;
  terisiGlobal: number;
  targetProvinsi: number | null;
  terisiProvinsi: number;
};

// Angka kuota saat ini. kodeProvinsi null = provinsi responden belum diketahui, sehingga
// batas per provinsi tidak bisa (dan tidak boleh) diterapkan.
export async function angkaKuota(surveyId: string, kodeProvinsi: string | null): Promise<KuotaSurvei> {
  const [survey, terisiGlobal, kuotaProv, terisiProvinsi] = await Promise.all([
    prisma.survey.findUnique({ where: { id: surveyId }, select: { targetResponden: true } }),
    // Yang dihitung HANYA responden selesai yang BUKAN penolak consent — lihat catatan
    // di lib/kuota.ts dan pada DIHITUNG_KE_KUOTA di atas.
    prisma.surveyResponse.count({ where: { surveyId, ...DIHITUNG_KE_KUOTA } }),
    kodeProvinsi
      ? prisma.kuotaProvinsi.findUnique({ where: { surveyId_kodeProvinsi: { surveyId, kodeProvinsi } } })
      : Promise.resolve(null),
    kodeProvinsi
      ? prisma.surveyResponse.count({ where: { surveyId, kodeProvinsi, ...DIHITUNG_KE_KUOTA } })
      : Promise.resolve(0),
  ]);
  return {
    targetGlobal: survey?.targetResponden ?? null,
    terisiGlobal,
    targetProvinsi: kuotaProv?.target ?? null,
    terisiProvinsi,
  };
}

export async function bolehMulaiSurvei(surveyId: string, kodeProvinsi: string | null): Promise<HasilKuota> {
  return periksaKuota(await angkaKuota(surveyId, kodeProvinsi));
}

// Pesan penolakan. Sengaja MENJAWAB, bukan mendiamkan: kebisuan terbaca seperti nomor mati
// dan merusak kepercayaan justru pada orang yang bersedia ikut. Satu pesan service jauh
// lebih murah daripada satu set jawaban yang tidak terpakai.
export function pesanKuotaPenuh(hasil: HasilKuota, kodeProvinsi: string | null): string {
  if (hasil.boleh) return "";
  if (hasil.alasan === "provinsi") {
    const nama = kodeProvinsi ? NAMA_PROV.get(kodeProvinsi) : null;
    return `Terima kasih atas kesediaan Anda. Kuota responden untuk wilayah ${nama ?? "Anda"} pada survei ini sudah terpenuhi, jadi kami tidak dapat menerima jawaban baru. 🙏`;
  }
  return "Terima kasih atas kesediaan Anda. Kuota responden survei ini sudah terpenuhi, jadi kami tidak dapat menerima jawaban baru. 🙏";
}

// Stempel provinsi pada respons. Dipanggil saat provinsi diketahui — dari atribut kontak
// ketika survei dimulai, atau dari jawaban wilayah ketika formulir masuk.
//
// Jawaban responden MENIMPA tebakan dari atribut impor: yang mengisi tahu domisilinya
// sendiri, sedangkan atribut impor bisa usang atau salah kolom.
export async function stempelProvinsi(responseId: string, kodeProvinsi: string | null): Promise<void> {
  if (!kodeProvinsi) return;
  await prisma.surveyResponse.update({ where: { id: responseId }, data: { kodeProvinsi } }).catch(() => {});
}
