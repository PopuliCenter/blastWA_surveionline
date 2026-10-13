// Operasi daftar pertanyaan di builder — MURNI, mudah diuji.
//
// Kenapa perlu: aturan percabangan menunjuk pertanyaan tujuan lewat URUTANNYA
// (options.branches[].goto = indeks 0-based), bukan lewat id. Begitu susunan daftar
// berubah — menggandakan, menghapus, atau menggeser satu pertanyaan — setiap aturan yang
// menunjuk ke belakang titik itu ikut bergeser ke pertanyaan yang SALAH, tanpa gejala apa
// pun sampai responden dilompatkan ke tempat yang keliru. Fungsi di sini memetakan ulang
// tujuannya supaya aturan tetap menunjuk pertanyaan yang SAMA.
//
// Satu hal sengaja TIDAK pernah dilakukan: mengubah tujuan menjadi "end". Bagi mesin
// survei, "end" berarti responden TERSARING KELUAR — dicatat sebagai penolak dan tidak
// dihitung ke kuota. Aturan yang tujuannya terhapus dikembalikan ke "lanjut normal".

// Indeks tujuan sebuah aturan, atau null bila aturannya tidak menunjuk pertanyaan.
//
// Dibaca SEPERTI MESIN membacanya (langkahBerikut di backend/src/lib/surveyLogic.ts):
//   • "end" dan -1 sama-sama MENGAKHIRI survei (tersaring keluar) — bukan indeks;
//   • angka dalam bentuk teks ("3") tetap lompatan ke indeks 3, karena mesin memakai
//     Number(goto). Builder selalu menulis angka, tapi data lama atau lewat API bisa teks.
export function indeksTujuan(goto) {
  if (goto === "end" || goto === -1 || goto === "-1" || goto === null || goto === undefined || goto === "") return null;
  const g = Number(goto);
  return Number.isInteger(g) && g >= 0 ? g : null;
}

// Terapkan pemetaan indeks lama → indeks baru pada percabangan satu pertanyaan.
// `peta` mengembalikan null bila pertanyaan tujuannya sudah tidak ada.
function petakanCabang(q, peta, hitungLepas) {
  const branches = q?.options?.branches;
  if (!Array.isArray(branches) || !branches.length) return q;
  const baru = [];
  for (const b of branches) {
    const asal = indeksTujuan(b.goto);
    if (asal === null) {
      baru.push(b); // "end" / -1 tidak bergantung pada urutan
      continue;
    }
    const g = peta(asal);
    if (g === null) hitungLepas.n++;
    else baru.push({ ...b, goto: g });
  }
  const options = { ...q.options };
  if (baru.length) options.branches = baru;
  else delete options.branches;
  return { ...q, options };
}

// Teks salinan yang belum dipakai pertanyaan lain: "X (salinan)", "X (salinan 2)", …
// Teks HARUS berbeda — ekspor dan Laporan mencocokkan jawaban lewat teks pertanyaan, jadi
// dua pertanyaan bertulisan sama membuat jawabannya bertumpuk di satu kolom.
export function teksSalinan(teks, teksLain) {
  const terpakai = new Set(teksLain.map((t) => (t || "").trim()));
  const dasar = (teks || "").trim().replace(/\s*\(salinan(?: \d+)?\)$/i, "");
  for (let n = 1; ; n++) {
    const kandidat = `${dasar} (${n === 1 ? "salinan" : `salinan ${n}`})`;
    if (!terpakai.has(kandidat)) return kandidat;
  }
}

// Sisipkan salinan pertanyaan ke-i tepat di bawahnya.
export function gandakanPertanyaan(questions, i, idBaru) {
  const asli = questions[i];
  if (!asli) return { questions, dilepas: 0 };
  const sisip = i + 1;
  const peta = (g) => (g >= sisip ? g + 1 : g);
  const lepas = { n: 0 };
  // Pengecualian untuk pertanyaan ASLI: aturannya yang menuju pertanyaan tepat sesudahnya
  // berarti "lanjut ke pertanyaan berikutnya" — dan pertanyaan berikutnya kini salinannya.
  // Bila ikut digeser, aturan itu melompati salinan; bila SEMUA jawaban punya aturan,
  // salinan tak pernah ditanyakan sama sekali dan kolomnya selalu kosong.
  const petaAsli = (g) => (g === sisip ? sisip : peta(g));
  const geser = questions.map((q, j) => petakanCabang(q, j === i ? petaAsli : peta, lepas));
  // Salinan memakai percabangan yang SAMA dengan aslinya, dan ikut dipetakan: ia berada
  // di posisi baru, tapi tujuannya tetap pertanyaan yang sama.
  const salinan = petakanCabang(
    {
      ...asli,
      id: idBaru,
      text: teksSalinan(
        asli.text,
        questions.map((q) => q.text),
      ),
      // Disalin dalam-dalam: menyunting pilihan salinan tidak boleh ikut mengubah aslinya.
      options: asli.options ? structuredClone(asli.options) : asli.options,
    },
    peta,
    lepas,
  );
  return { questions: [...geser.slice(0, sisip), salinan, ...geser.slice(sisip)], dilepas: lepas.n };
}

// Hapus pertanyaan ke-i. Aturan yang menuju pertanyaan itu dialihkan ke pertanyaan yang
// kini menempati posisinya; bila yang dihapus pertanyaan terakhir, aturannya dilepas.
export function hapusPertanyaan(questions, i) {
  const sisa = questions.length - 1;
  const peta = (g) => {
    if (g < i) return g;
    if (g > i) return g - 1;
    return i < sisa ? i : null;
  };
  const lepas = { n: 0 };
  const hasil = questions.filter((_, j) => j !== i).map((q) => petakanCabang(q, peta, lepas));
  return { questions: hasil, dilepas: lepas.n };
}

// Tukar pertanyaan ke-i dengan tetangganya (dir = -1 naik, +1 turun).
export function geserPertanyaan(questions, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= questions.length) return { questions, dilepas: 0 };
  const peta = (g) => (g === i ? j : g === j ? i : g);
  const lepas = { n: 0 };
  const arr = questions.map((q) => petakanCabang(q, peta, lepas));
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return { questions: arr, dilepas: lepas.n };
}

// Aturan percabangan yang TIDAK akan pernah berlaku: tujuannya pertanyaan sebelumnya atau
// dirinya sendiri (mesin hanya melompat MAJU), atau tujuannya sudah di luar daftar.
// Bisa terjadi setelah pertanyaan digeser — aturannya tetap menunjuk pertanyaan yang sama,
// tapi pertanyaan itu kini ada di atasnya. Ditampilkan supaya tidak diam-diam diabaikan.
export function cabangTakBerlaku(q, index, total) {
  const branches = q?.options?.branches;
  if (!Array.isArray(branches)) return [];
  return branches.filter((b) => {
    const g = indeksTujuan(b.goto);
    return g !== null && (g <= index || g >= total);
  });
}

// Teks pertanyaan yang muncul lebih dari sekali. Kembaran dari teksPertanyaanGanda di
// backend/src/lib/salinSurvei.ts — server menolak survei seperti ini; di sini supaya
// pemakai tahu sebelum menekan Simpan.
export function teksGanda(questions) {
  const hitung = new Map();
  for (const q of questions) {
    const t = (q.text || "").trim();
    if (t) hitung.set(t, (hitung.get(t) || 0) + 1);
  }
  return [...hitung].filter(([, n]) => n > 1).map(([t]) => t);
}
