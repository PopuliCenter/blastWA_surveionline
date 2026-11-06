import { prisma } from "../db.js";
import { getProvider } from "../providers/registry.js";
import { idInstagram } from "../lib/saluranKontak.js";

// ===== Profil Instagram (nama & username) dari User Profile API Meta =====
//
// Webhook Instagram tidak membawa nama pengirim, jadi nama dan username diambil dari API
// profil resmi (BUKAN scraping). Dipakai dari dua tempat: pesan masuk (mesin survei; sekali untuk kontak
// baru, lalu paling sering sehari sekali) dan skrip pelengkap kontak lama
// (scripts/lengkapi-profil-instagram.ts) — logikanya satu agar ketiganya tidak bergeser.
//
// Best-effort: dibatasi waktu dan galatnya ditelan. Username hanya untuk tampilan (identitas
// tetap IGSID), dan survei tidak boleh tertahan karena API profil lambat atau izinnya belum
// disetujui.

export const BATAS_WAKTU_PROFIL_MS = 3000;
// Username bisa diganti pemiliknya kapan saja. Sehari sekali cukup untuk tampilan, dan tidak
// menambah satu panggilan API pada setiap survei yang dimulai.
export const UMUR_PROFIL_MS = 24 * 3600_000;

export type HasilProfil = "berhasil" | "tanpa-username" | "gagal";

// Bentuk nama yang dulu diisi otomatis dari username ("@siti.ig"). Username Instagram hanya
// huruf, angka, titik, dan garis bawah, paling panjang 30 karakter.
const POLA_NAMA_USERNAME = /^@[A-Za-z0-9._]{1,30}$/;

// Profil perlu dicek ulang? Belum pernah dicek dianggap kedaluwarsa.
export function profilKedaluwarsa(igProfilPada: Date | null | undefined, kini = Date.now()): boolean {
  return !igProfilPada || kini - igProfilPada.getTime() > UMUR_PROFIL_MS;
}

async function ambilProfilDibatasi(
  vendor: string,
  igsid: string,
): Promise<{ name?: string; username?: string } | null> {
  try {
    const prov = getProvider(vendor);
    if (typeof prov.ambilProfil !== "function") return null;
    let batas: ReturnType<typeof setTimeout> | undefined;
    return await Promise.race([
      prov.ambilProfil(igsid),
      new Promise<null>((r) => (batas = setTimeout(() => r(null), BATAS_WAKTU_PROFIL_MS))),
    ]).finally(() => clearTimeout(batas));
  } catch {
    return null;
  }
}

// Perbarui profil satu kontak Instagram. `kontakKini` = nilai yang dipegang pemanggil, dan
// dipakai sebagai predikat penulisan nama: nama yang berubah di antara pembacaan dan
// penulisan (disunting operator, atau diisi pesan lain yang datang bersamaan) tidak ditimpa.
export async function perbaruiProfilInstagram(
  contactId: string,
  vendor: string,
  igsid: string,
  kontakKini: { name: string | null; igUsername: string | null },
  opsi: { catatSaatGagal?: boolean } = {},
): Promise<HasilProfil> {
  const profil = await ambilProfilDibatasi(vendor, igsid);
  // Waktu cek dicatat juga saat gagal: izin yang belum disetujui akan gagal lagi di pesan
  // berikutnya, dan tanpa catatan ini setiap DM menunggu API sampai 3 detik. Skrip pelengkap
  // mematikannya: kegagalannya (batas laju) tidak boleh menghapus kesempatan kontak itu
  // dilengkapi otomatis saat ia DM lagi.
  if (!profil && opsi.catatSaatGagal === false) return "gagal";
  const dataProfil: { igProfilPada: Date; igUsername?: string } = { igProfilPada: new Date() };
  const usernameBaru = profil?.username || null;
  // Respons tanpa username tidak menghapus username lama — lebih mungkin izinnya yang
  // berkurang daripada akunnya yang tak lagi ber-username.
  if (usernameBaru) dataProfil.igUsername = usernameBaru;

  const namaProfil = profil?.name || (usernameBaru ? `@${usernameBaru}` : null);
  let namaBaru: string | null = null;
  if (namaProfil && !kontakKini.name) namaBaru = namaProfil;
  // Nama "@lama" adalah nama yang dulu diisi otomatis dari username, jadi ikut berganti saat
  // username berganti. Nama lain — dari profil sebelumnya atau suntingan operator — dibiarkan.
  // Kontak dari sebelum username disimpan (igUsername kosong) dikenali dari bentuk namanya.
  else if (namaProfil && usernameBaru && kontakKini.name !== `@${usernameBaru}`) {
    const namaOtomatis = kontakKini.igUsername
      ? kontakKini.name === `@${kontakKini.igUsername}`
      : POLA_NAMA_USERNAME.test(kontakKini.name ?? "");
    if (namaOtomatis) namaBaru = namaProfil;
  }

  try {
    let tertulis = 0;
    if (namaBaru)
      tertulis = (
        await prisma.contact.updateMany({
          where: { id: contactId, name: kontakKini.name },
          data: { ...dataProfil, name: namaBaru },
        })
      ).count;
    // Namanya keburu berubah (atau memang tak perlu diganti) → profilnya tetap dicatat.
    if (!tertulis) await prisma.contact.updateMany({ where: { id: contactId }, data: dataProfil });
  } catch {
    /* abaikan — lihat catatan di atas */
  }
  if (!profil) return "gagal";
  return usernameBaru ? "berhasil" : "tanpa-username";
}

// ===== Pelengkap kontak lama (scripts/lengkapi-profil-instagram.ts) =====
//
// Kontak Instagram dari sebelum username disimpan, atau yang profilnya dulu gagal terbaca.
// Mereka juga terlengkapi sendiri saat DM lagi; ini untuk yang tidak pernah kembali.
// Meta hanya memberi profil orang yang pernah DM ke akun bisnis — selalu benar untuk "ig:".

export type RingkasanPelengkap = {
  tanpaUsername: number; // kontak ig: yang igUsername-nya kosong
  belumDicek: number; // di antaranya, yang profilnya belum pernah dicek sama sekali
  diproses: number;
  berhasil: number;
  gagal: number;
  tanpaUsernameDariApi: number; // profil terbaca, tetapi tanpa username
  berhentiDini: boolean; // terlalu banyak gagal beruntun — kemungkinan batas laju Meta
};

// Sekian kegagalan beruntun = kemungkinan besar batas laju (atau izin) Meta, bukan kontak
// yang bermasalah. Terus memanggil hanya memperpanjang pembatasannya.
const BATAS_GAGAL_BERUNTUN = 15;

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function lengkapiProfilKontakLama(opsi: {
  apply: boolean;
  // Jeda antarpanggilan agar tidak menabrak batas laju API Meta.
  jedaMs?: number;
  vendor?: string;
}): Promise<RingkasanPelengkap> {
  const vendor = opsi.vendor ?? "instagram";
  const jedaMs = opsi.jedaMs ?? 300;
  const dasar = { phone: { startsWith: "ig:" }, igUsername: null };
  const [tanpaUsername, belumDicek] = await Promise.all([
    prisma.contact.count({ where: dasar }),
    prisma.contact.count({ where: { ...dasar, igProfilPada: null } }),
  ]);
  const hasil: RingkasanPelengkap = {
    tanpaUsername,
    belumDicek,
    diproses: 0,
    berhasil: 0,
    gagal: 0,
    tanpaUsernameDariApi: 0,
    berhentiDini: false,
  };
  let gagalBeruntun = 0;
  if (!opsi.apply) return hasil;

  // Diurutkan menurut id dan dibaca per kelompok: kontak yang berhasil keluar dari himpunan
  // "tanpa username" selagi berjalan, dan kursor id tetap menjamin tiap kontak dilewati sekali.
  let setelah: string | undefined;
  for (;;) {
    const kelompok = await prisma.contact.findMany({
      where: { ...dasar, ...(setelah ? { id: { gt: setelah } } : {}) },
      orderBy: { id: "asc" },
      take: 200,
      select: { id: true, phone: true, name: true, igUsername: true },
    });
    if (!kelompok.length) break;
    for (const k of kelompok) {
      if (hasil.diproses > 0 && jedaMs > 0) await tidur(jedaMs);
      const r = await perbaruiProfilInstagram(
        k.id,
        vendor,
        idInstagram(k.phone),
        { name: k.name, igUsername: k.igUsername },
        { catatSaatGagal: false },
      );
      hasil.diproses++;
      if (r === "gagal") {
        hasil.gagal++;
        if (++gagalBeruntun >= BATAS_GAGAL_BERUNTUN) {
          hasil.berhentiDini = true;
          return hasil;
        }
        continue;
      }
      gagalBeruntun = 0;
      if (r === "berhasil") hasil.berhasil++;
      else hasil.tanpaUsernameDariApi++;
    }
    setelah = kelompok.at(-1)!.id;
  }
  return hasil;
}
