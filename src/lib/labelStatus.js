// Label status berbahasa Indonesia untuk lencana (Badge). Nilai mentahnya — enum dari
// backend — tetap dipakai di API dan saringan; yang berubah hanya yang tampil di layar.
// Dulu lencananya menampilkan nilai mentah itu apa adanya: "closed", "completed", "running".

const SURVEI = {
  active: ["green", "Berjalan"],
  draft: ["yellow", "Draf"],
  closed: ["default", "Ditutup"],
};

const BLAST = {
  pending: ["blue", "Menunggu"],
  scheduled: ["yellow", "Terjadwal"],
  running: ["blue", "Mengirim"],
  completed: ["green", "Selesai"],
  failed: ["red", "Gagal"],
};

// Status yang belum dikenal tetap tampil apa adanya, bukan hilang.
const baca = (peta, status) => {
  const [tone, label] = peta[status] ?? ["default", status || "—"];
  return { tone, label };
};

export const statusSurvei = (status) => baca(SURVEI, status);
export const statusBlast = (status) => baca(BLAST, status);
