// ===== Fakta pengirim untuk Agen AI =====
//
// Tanpa ini, AI tidak tahu apa pun tentang orang yang sedang diajaknya bicara, lalu
// MENGARANG. Kejadian nyata di produksi: responden yang sudah menyelesaikan survei
// bertanya "kenapa tidak ada formnya", dan AI menjawab bahwa ada "tautan yang kami
// kirimkan bila Anda terpilih sebagai responden" — proses yang tidak pernah ada.
// Lebih buruk lagi, ia menyuruh membalas "isi survei" lagi, padahal balasan itu hanya
// menghasilkan penolakan yang sama: lingkaran tanpa ujung.
//
// Fakta di bawah disisipkan ke system prompt setiap kali AI dipanggil, sehingga
// jawabannya berpijak pada keadaan sebenarnya.

export type SurveyFact = {
  title: string;
  triggers: string[];
  oncePerContact: boolean;
  completedByContact: boolean;
  // Pernah mencoba ikut, tetapi ditolak karena kuotanya sudah penuh — dan belum pernah
  // diterima. Dipisah dari completedByContact: tanpa fakta ini AI memberi tahu orang yang
  // baru saja ditolak bahwa "jawaban Anda sudah tercatat", tepat setelah mesin survei
  // mengatakan jawabannya tidak diikutsertakan.
  ditolakKuota?: boolean;
};

export function buildContactFacts(surveys: SurveyFact[]): string {
  if (!surveys.length) {
    return [
      "FAKTA TENTANG PENGIRIM PESAN INI — pakai ini, jangan mengarang:",
      "- Saat ini TIDAK ADA survei yang sedang berjalan.",
      "- Jangan menjanjikan tautan, formulir, atau undangan apa pun.",
    ].join("\n");
  }

  const baris = surveys.map((s) => {
    if (s.completedByContact) {
      const kunci = s.oncePerContact
        ? " Survei ini hanya boleh diisi SEKALI per nomor, jadi dia TIDAK bisa mengisinya lagi."
        : "";
      return `- Survei "${s.title}": pengirim SUDAH menyelesaikannya.${kunci}`;
    }
    if (s.ditolakKuota) {
      return `- Survei "${s.title}": pengirim pernah mencoba ikut, tetapi saat itu kuota responden sudah terpenuhi, sehingga jawabannya TIDAK diikutsertakan.`;
    }
    const pemicu = s.triggers[0];
    return pemicu
      ? `- Survei "${s.title}": pengirim BELUM mengisi. Bisa dimulai dengan membalas "${pemicu}".`
      : `- Survei "${s.title}": pengirim BELUM mengisi, dan survei ini tidak dibuka lewat kata kunci.`;
  });

  // Aturan penutup mencegah dua kesalahan yang sudah benar-benar terjadi.
  const sudahSemua = surveys.every((s) => s.completedByContact || s.ditolakKuota);
  const penutup = sudahSemua
    ? [
        "- JANGAN menyuruh dia membalas kata pemicu lagi — jawabannya akan sama saja dan dia terjebak berputar.",
        // "Sudah tercatat" hanya benar bila SEMUANYA diterima; yang ditolak kuota diatur di bawah.
        ...(surveys.every((s) => s.completedByContact)
          ? [
              "- Bila dia kecewa atau bertanya kenapa tidak dapat formulir: jelaskan bahwa jawabannya SUDAH tercatat,",
              "  ucapkan terima kasih, dan tawarkan untuk diteruskan ke tim bila masih ada yang ingin disampaikan.",
            ]
          : []),
      ]
    : ["- Jangan menjanjikan tautan atau undangan terpisah; survei dibuka lewat kata pemicu di atas."];

  // Kuota yang penuh dijelaskan UMUM, sama seperti pesan penolakan mesin survei. Menyebut
  // wilayah atau angka membocorkan rancangan sampel: responden jadi tahu wilayah mana yang
  // masih dicari dan bisa mengaku tinggal di sana.
  const kuota = surveys.some((s) => s.ditolakKuota && !s.completedByContact)
    ? [
        "- Untuk survei yang kuotanya sudah terpenuhi: JANGAN katakan jawabannya sudah tercatat — jawabannya tidak dipakai.",
        "  Jelaskan dengan sopan bahwa kuota responden sudah terpenuhi dan ucapkan terima kasih atas kesediaannya.",
        "  JANGAN menyebut nama wilayah, provinsi, maupun angka kuota apa pun.",
      ]
    : [];

  return ["FAKTA TENTANG PENGIRIM PESAN INI — pakai ini, jangan mengarang:", ...baris, ...penutup, ...kuota].join("\n");
}

// ===== Penyamaran nomor sebelum riwayat dikirim ke penyedia AI =====
//
// Kebijakan privasi menjanjikan bahwa nomor telepon TIDAK ikut dikirim ke penyedia AI. Janji
// itu dulu benar dengan sendirinya — riwayat hanya berisi isi pesan, bukan nomor pengirim.
// Sejak survei bisa menanyakan nomor HP / e-wallet untuk imbalan (pertanyaan tipe "phone"),
// nomornya ikut tertulis di ISI pesan, dan riwayat percakapan yang dikirim ke AI akan
// membawanya. Deret 8 digit atau lebih — boleh berselang spasi, titik, strip, atau kurung,
// seperti orang biasa menulis nomor HP — diganti "[nomor]".
//
// Tanggal (17-08-2026) dan nominal berpemisah ribuan (15.000.000) juga 8 digit, tetapi
// bukan nomor dan berguna bagi AI untuk memahami percakapan — jawaban soal pengeluaran
// misalnya — jadi dibiarkan. Kecuali bila bentuknya nomor HP Indonesia (diawali 08 / 628 /
// +628): "081.234.567.890" lolos sebagai ribuan, padahal validator nomor HP menerimanya.
// Pemisahnya boleh sampai empat karakter, supaya "0812 - 3456 - 7890" tetap satu deret.
const DERET_NOMOR = /\+?\d(?:[\s.\-()–—/]{0,4}\d){7,}/g;
const TANGGAL = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$|^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/;
const RIBUAN = /^\d{1,3}(?:\.\d{3})+$/;
const AWALAN_HP = /^(?:0|\+?62)8/;

export function samarkanNomor(teks: string): string {
  return teks.replace(DERET_NOMOR, (m) => {
    const t = m.trim();
    if (AWALAN_HP.test(t.replace(/[\s.\-()–—/]/g, ""))) return "[nomor]";
    return TANGGAL.test(t) || RIBUAN.test(t) ? m : "[nomor]";
  });
}
