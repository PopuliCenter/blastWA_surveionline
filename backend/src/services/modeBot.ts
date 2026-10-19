import { prisma } from "../db.js";

// "Bot diam saat tidak ada survei berjalan" — pengaturan tunggal (BotConfig "default").
//
// Setelah survei ditutup, pesan masuk masih terus berdatangan: penerima blast lama yang baru
// membuka pesan, orang yang bertanya kapan hasilnya keluar. Tiap balasan otomatis memakan
// biaya per pesan, padahal tidak ada lagi survei yang bisa ditawarkan. Saat pengaturan ini
// menyala DAN tidak ada satu pun survei yang berjalan, bot tidak mengirim apa pun — pesan
// survei berakhir, aturan Auto Reply, Agen AI, kata penutup, permintaan lokasi. Pesan masuk
// tetap tercatat di kotak masuk dan operator tetap bisa membalas manual.
//
// Pengecualiannya hanya konfirmasi STOP, sekali, saat nomornya BARU berhenti: orang yang
// meminta berhenti harus tahu permintaannya diterima — tanpa itu ia memblokir atau
// melaporkan nomor, dan itu menekan quality rating di Meta. Konfirmasi berlangganan kembali
// TIDAK dikirim (lihat doOptIn). Permintaan berhenti/berlangganan sendiri selalu dicatat.
//
// Sengaja bersyarat "tidak ada survei berjalan", bukan sakelar diam total: begitu survei
// berikutnya diaktifkan, bot membalas lagi dengan sendirinya. Sakelar total yang lupa
// dimatikan membuat balasan atas blast survei baru tak pernah memulai surveinya.
const ID = "default";

export type ModeBot = { diamTanpaSurveiAktif: boolean };

export async function bacaModeBot(): Promise<ModeBot> {
  const cfg = await prisma.botConfig.findUnique({ where: { id: ID }, select: { diamTanpaSurveiAktif: true } });
  return { diamTanpaSurveiAktif: cfg?.diamTanpaSurveiAktif ?? false };
}

export async function simpanModeBot(mode: ModeBot): Promise<ModeBot> {
  const cfg = await prisma.botConfig.upsert({
    where: { id: ID },
    create: { id: ID, diamTanpaSurveiAktif: mode.diamTanpaSurveiAktif },
    update: { diamTanpaSurveiAktif: mode.diamTanpaSurveiAktif },
    select: { diamTanpaSurveiAktif: true },
  });
  return cfg;
}

export async function adaSurveiBerjalan(): Promise<boolean> {
  return (await prisma.survey.count({ where: { status: "active" } })) > 0;
}

// Dibaca langsung tiap kali, tanpa cache: dua query ringan, dan operator yang baru saja
// menyalakan (atau mengaktifkan survei baru) harus langsung melihat akibatnya.
export async function botSedangDiam(): Promise<boolean> {
  if (!(await bacaModeBot()).diamTanpaSurveiAktif) return false;
  return !(await adaSurveiBerjalan());
}
