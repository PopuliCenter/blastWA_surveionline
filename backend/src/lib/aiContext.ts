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
    const pemicu = s.triggers[0];
    return pemicu
      ? `- Survei "${s.title}": pengirim BELUM mengisi. Bisa dimulai dengan membalas "${pemicu}".`
      : `- Survei "${s.title}": pengirim BELUM mengisi, dan survei ini tidak dibuka lewat kata kunci.`;
  });

  // Aturan penutup mencegah dua kesalahan yang sudah benar-benar terjadi.
  const sudahSemua = surveys.every((s) => s.completedByContact);
  const penutup = sudahSemua
    ? [
        "- JANGAN menyuruh dia membalas kata pemicu lagi — jawabannya akan sama saja dan dia terjebak berputar.",
        "- Bila dia kecewa atau bertanya kenapa tidak dapat formulir: jelaskan bahwa jawabannya SUDAH tercatat,",
        "  ucapkan terima kasih, dan tawarkan untuk diteruskan ke tim bila masih ada yang ingin disampaikan.",
      ]
    : ["- Jangan menjanjikan tautan atau undangan terpisah; survei dibuka lewat kata pemicu di atas."];

  return ["FAKTA TENTANG PENGIRIM PESAN INI — pakai ini, jangan mengarang:", ...baris, ...penutup].join("\n");
}
