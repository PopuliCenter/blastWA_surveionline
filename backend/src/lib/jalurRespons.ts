// ===== Asal responden: saluran, jalur masuk, dan metode — aturan MURNI =====
//
// Satu survei bisa terisi lewat beberapa jalur sekaligus (broadcast, kata pemicu yang disebar
// tim lapangan, iklan IG/FB). Supaya mutu dan biaya tiap jalur bisa dibandingkan, tiap respons
// mencatat asalnya pada saat DIMULAI — disimpan, bukan dihitung ulang, karena kontak yang sama
// bisa datang lewat jalur berbeda di survei berikutnya, dan mode survei bisa diubah kemudian.

export type JalurMasuk = "broadcast" | "kata-pemicu" | "iklan";
export type Metode = "form" | "chatbot";

const LABEL_SALURAN: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook" };
const LABEL_JALUR: Record<JalurMasuk, string> = {
  broadcast: "Broadcast",
  "kata-pemicu": "Kata pemicu",
  iklan: "Iklan",
};
const LABEL_METODE: Record<Metode, string> = { form: "Form", chatbot: "Chatbot" };
// Respons dari sebelum fitur ini ada, yang asalnya memang tidak diketahui. Ditulis apa adanya
// — menebak "kata pemicu" akan mencampur data lama yang tidak pernah tercatat dengan data nyata.
export const JALUR_TAK_TERCATAT = "(tidak tercatat)";

// Iklan yang diketuk tetap dihitung sebagai asal selama 72 jam: orang bisa menyapa dulu, lalu
// baru mengetik kata pemicunya — padahal data iklan hanya ikut pada pesan PERTAMA sesudah
// iklan diketuk. Sama dengan lama jendela gratis percakapan dari iklan di Meta.
export const JENDELA_IKLAN_MS = 72 * 60 * 60 * 1000;

export type Iklan = { id: string; judul: string | null };

const teksPendek = (v: unknown, maks: number): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, maks) : null;
};

// Data iklan dari webhook WhatsApp (message.referral). Yang bukan iklan — mis. tombol dari
// postingan biasa — bukan jalur berbayar, jadi tidak dihitung sebagai iklan.
//
// Webhook TIDAK menyebut iklannya tayang di Instagram atau Facebook. source_url pun bukan
// petunjuk yang aman: satu iklan bisa tayang di keduanya dengan satu URL. Untuk memisahkannya,
// buat iklan terpisah per platform lalu bedakan lewat ID iklannya.
export function iklanDariReferral(referral: unknown): Iklan | null {
  if (!referral || typeof referral !== "object") return null;
  const r = referral as Record<string, unknown>;
  if (r.source_type !== "ad") return null;
  const id = teksPendek(r.source_id, 64);
  return id ? { id, judul: teksPendek(r.headline, 200) } : null;
}

export type AsalTercatat = { jalurMasuk: string | null; iklanId: string | null; iklanJudul: string | null };

// Asal sebuah respons saat dimulai. Iklan didahulukan bila diketuk SETELAH broadcast terakhir
// orang itu: broadcast lama tidak menjelaskan kenapa ia datang sekarang.
//
// `warisan` = asal respons yang digantikannya, saat formulir yang sama dikirim ulang: orangnya
// masih dalam kedatangan yang sama, jadi asalnya tidak berubah — kecuali ia baru mengetuk iklan.
export function tentukanJalur(input: {
  kontak: { iklanId?: string | null; iklanJudul?: string | null; iklanPada?: Date | null } | null | undefined;
  blastPada?: Date | null;
  warisan?: AsalTercatat | undefined;
  sekarang?: Date;
}): AsalTercatat {
  const sekarang = (input.sekarang ?? new Date()).getTime();
  const k = input.kontak;
  const pada = k?.iklanPada?.getTime();
  const iklanBerlaku = Boolean(k?.iklanId) && pada !== undefined && sekarang - pada <= JENDELA_IKLAN_MS;
  if (iklanBerlaku && (!input.blastPada || pada! >= input.blastPada.getTime()))
    return { jalurMasuk: "iklan", iklanId: k!.iklanId!, iklanJudul: k!.iklanJudul ?? null };
  if (input.warisan) {
    const { jalurMasuk, iklanId, iklanJudul } = input.warisan;
    return { jalurMasuk, iklanId, iklanJudul };
  }
  return { jalurMasuk: input.blastPada ? "broadcast" : "kata-pemicu", iklanId: null, iklanJudul: null };
}

// Label untuk layar, ekspor, dan Google Sheets — satu sumber supaya ketiganya tidak berselisih.
//
// Respons lama: metodenya mengikuti mode survei, dan yang punya blastId pasti dari broadcast.
// Selain itu jalurnya tidak diketahui (lihat JALUR_TAK_TERCATAT).
export function labelAsal(
  r: {
    saluran: string;
    jalurMasuk: string | null;
    metode: string | null;
    blastId: string | null;
    iklanId: string | null;
  },
  modeSurvei: string,
): { saluran: string; jalurMasuk: string; metode: string; iklanId: string } {
  const jalur = r.jalurMasuk ?? (r.blastId ? "broadcast" : null);
  const metode = r.metode ?? (modeSurvei === "flow" ? "form" : "chatbot");
  return {
    saluran: LABEL_SALURAN[r.saluran] ?? r.saluran,
    jalurMasuk: jalur ? (LABEL_JALUR[jalur as JalurMasuk] ?? jalur) : JALUR_TAK_TERCATAT,
    metode: LABEL_METODE[metode as Metode] ?? metode,
    iklanId: r.iklanId ?? "",
  };
}
