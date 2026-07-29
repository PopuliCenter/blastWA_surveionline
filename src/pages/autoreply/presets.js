// Contoh aturan balas otomatis untuk operasi survei online Populi Center via WhatsApp.
//
// Cara kerja pencocokan (lihat backend/src/services/autoResponder.ts):
// aturan diurutkan priority MENURUN, lalu yang PERTAMA cocok yang dipakai.
// Karena itu aturan spesifik diberi prioritas lebih tinggi daripada sapaan umum.
//
// Kata kunci pemicu survei ("isi survei") sengaja TIDAK dipakai di sini — pemicu survei
// sudah dicek lebih dulu di surveyEngine, jadi tidak akan tercegat aturan ini.
//
// Teks di bawah adalah DRAF. Sesuaikan dengan kebijakan lembaga sebelum dipakai.

const MULAI = "Untuk mulai mengisi, balas dengan kata: *isi survei*";

export const PRESETS = [
  {
    key: "sapaan",
    icon: "chat",
    title: "Sapaan & pengenalan",
    desc: "Menyambut pesan pertama, memperkenalkan Populi Center, dan memberi tahu cara memulai survei.",
    rules: [
      {
        name: "Sapaan — halo",
        keyword: "halo",
        matchType: "starts",
        priority: 20,
        response:
          "Halo, terima kasih sudah menghubungi *Populi Center*. 🙏\n\n" +
          "Kami sedang mengadakan *survei online* singkat (±5 menit) melalui WhatsApp. " +
          "Pendapat Anda kami gunakan untuk keperluan riset dan dilaporkan secara gabungan, bukan per orang.\n\n" +
          MULAI +
          "\n\nBila sedang tidak berkenan, abaikan saja pesan ini.",
      },
      {
        name: "Sapaan — hai / hi",
        keyword: "hai",
        matchType: "starts",
        priority: 20,
        response:
          "Hai, terima kasih sudah menghubungi *Populi Center*. 🙏\n\n" +
          "Kami sedang mengadakan survei online singkat (±5 menit) lewat WhatsApp.\n\n" +
          MULAI,
      },
      {
        name: "Sapaan — assalamualaikum",
        keyword: "salam",
        matchType: "contains",
        priority: 20,
        response:
          "Waalaikumsalam warahmatullahi wabarakatuh. 🙏\n\n" +
          "Terima kasih sudah menghubungi *Populi Center*. Kami sedang mengadakan survei online singkat " +
          "(±5 menit) melalui WhatsApp.\n\n" +
          MULAI,
      },
      {
        name: "Sapaan — permisi",
        keyword: "permisi",
        matchType: "starts",
        priority: 20,
        response:
          "Selamat datang, dan terima kasih sudah menghubungi *Populi Center*. 🙏\n\n" +
          "Kami sedang mengadakan survei online singkat (±5 menit) melalui WhatsApp.\n\n" +
          MULAI,
      },
    ],
  },
  {
    key: "tanya-jawab",
    icon: "doc",
    title: "Tanya-jawab responden",
    desc: "Jawaban untuk pertanyaan yang paling sering muncul: ini nomor siapa, cara mengisi, berapa lama, dan bagaimana data diperlakukan.",
    rules: [
      {
        name: "Konfirmasi identitas pengirim",
        keyword: "siapa",
        matchType: "contains",
        priority: 80,
        response:
          "Ini nomor resmi *Populi Center*, lembaga riset dan survei opini publik.\n\n" +
          "Kami sedang mengumpulkan pendapat masyarakat lewat survei singkat di WhatsApp. " +
          "Kami *tidak pernah* meminta kode OTP, PIN, nomor rekening, atau data keuangan apa pun. " +
          "Bila ada pihak yang mengatasnamakan kami dan meminta hal tersebut, mohon abaikan.\n\n" +
          MULAI,
      },
      {
        name: "Kekhawatiran penipuan",
        keyword: "penipuan",
        matchType: "contains",
        priority: 78,
        response:
          "Kekhawatiran Anda sangat wajar, terima kasih sudah bertanya. 🙏\n\n" +
          "Ini nomor resmi *Populi Center*, lembaga riset dan survei opini publik. " +
          "Kami hanya menanyakan pendapat, dan *tidak pernah* meminta kode OTP, PIN, nomor rekening, " +
          "atau meminta Anda mengirim uang.\n\n" +
          "Anda bebas untuk tidak ikut. Bila tidak berkenan, cukup abaikan pesan kami.",
      },
      {
        name: "Cara mengisi survei",
        keyword: "cara",
        matchType: "contains",
        priority: 70,
        response:
          "Cara mengisi survei kami:\n\n" +
          "1. Balas pesan ini dengan kata *isi survei*\n" +
          "2. Ikuti pertanyaan yang muncul sampai selesai\n" +
          "3. Jawaban Anda otomatis tersimpan\n\n" +
          "Pengisian hanya butuh sekitar 5 menit dan bisa dilakukan kapan saja.",
      },
      {
        name: "Durasi pengisian",
        keyword: "berapa lama",
        matchType: "contains",
        priority: 68,
        response:
          "Pengisian survei ini hanya butuh sekitar *5 menit*, dan bisa Anda lakukan kapan saja.\n\n" + MULAI,
      },
      {
        name: "Kerahasiaan data",
        keyword: "data",
        matchType: "contains",
        priority: 60,
        response:
          "Jawaban Anda kami gunakan *hanya untuk keperluan riset* dan dilaporkan dalam bentuk gabungan " +
          "(agregat), bukan atas nama perorangan.\n\n" +
          "Kami tidak meminta kode OTP, PIN, maupun data rekening, dan tidak menggunakan nomor Anda " +
          "untuk keperluan pemasaran.",
      },
      {
        name: "Ucapan terima kasih",
        keyword: "terima kasih",
        matchType: "contains",
        priority: 10,
        response: "Terima kasih kembali. 🙏 Waktu dan pendapat Anda sangat berarti bagi kami di *Populi Center*.",
      },
    ],
  },
];

// Permintaan berhenti SENGAJA tidak dibuatkan aturan di sini. Sistem sudah menanganinya
// sendiri di surveyEngine: kata seperti "STOP" / "berhenti" langsung mencabut langganan
// kontak (subscribed = false) lalu membalas konfirmasi, dan blast berikutnya melewati
// nomor itu. Aturan Auto Reply untuk kata yang sama tidak akan pernah terpakai karena
// pemeriksaan opt-out berjalan lebih dulu — dan kalaupun terpakai, teksnya berisiko
// menjanjikan hal yang berbeda dari yang dikerjakan sistem.
export const OPT_OUT_INFO =
  "Permintaan berhenti tidak perlu dibuatkan aturan. Sistem sudah otomatis mencabut " +
  "langganan nomor yang membalas “STOP”, “berhenti”, atau “unsubscribe”, lalu mengirim " +
  "konfirmasinya sendiri. Nomor itu juga otomatis dilewati pada blast berikutnya.";
