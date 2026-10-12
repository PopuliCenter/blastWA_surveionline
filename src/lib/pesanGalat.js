// Mengubah badan respons galat jadi kalimat yang bisa dibaca orang.
//
// Sebelum ini klien menulis `new Error(data.error)`. Untuk galat validasi, data.error
// adalah objek hasil Zod flatten — dan Error(objek) menghasilkan pesan "[object Object]".
//
// Itu bukan sekadar jelek. Kejadian nyata: tipe pertanyaan "wilayah" belum terdaftar di
// skema server, jadi tiap survei yang memakainya ditolak — dan satu-satunya petunjuk yang
// sampai ke layar adalah "[object Object]". Sebabnya ada di badan respons sepanjang waktu;
// yang hilang cuma cara membacanya.
export function pesanGalatApi(data, status) {
  const e = data?.error;
  if (typeof e === "string" && e.trim()) return e.trim();

  if (e && typeof e === "object") {
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();

    // Bentuk Zod flatten: { formErrors: [...], fieldErrors: { nama: [...] } }
    const bagian = [];
    if (Array.isArray(e.formErrors)) bagian.push(...e.formErrors.filter(Boolean));
    if (e.fieldErrors && typeof e.fieldErrors === "object") {
      for (const [bidang, pesan] of Object.entries(e.fieldErrors)) {
        const isi = Array.isArray(pesan) ? pesan.filter(Boolean) : [];
        if (isi.length) bagian.push(`${bidang}: ${isi.join(", ")}`);
      }
    }
    if (bagian.length) return bagian.join(" · ");

    // Bentuk tak dikenal: tampilkan apa adanya sebagai JSON. Jelek dibaca, tapi masih jauh
    // lebih berguna daripada "[object Object]" — setidaknya isinya sampai ke mata orang.
    try {
      const j = JSON.stringify(e);
      if (j && j !== "{}") return j.slice(0, 300);
    } catch {
      /* objek bersiklus — jatuh ke kode status di bawah */
    }
  }
  return `HTTP ${status}`;
}
