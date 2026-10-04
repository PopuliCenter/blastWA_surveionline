// Nomor Reference & Transaction ID untuk invoice.
//
// DETERMINISTIK, bukan acak. Invoice tidak disimpan di aplikasi ini — ia disusun ulang
// tiap kali dibuka — sehingga nomor acak akan berbeda setiap kali dokumen yang sama
// dicetak. Klien yang menanyakan "invoice nomor berapa" lalu mendapat jawaban berbeda
// dari cetakan kedua adalah kegagalan yang tidak bisa diperbaiki setelah terkirim.
//
// Diturunkan dari isi invoice (klien + periode + total), jadi invoice yang sama selalu
// menghasilkan nomor yang sama, dan invoice yang berbeda hampir pasti berbeda nomor.
// Keduanya tetap bisa ditimpa manual — nomor dari sistem lain selalu menang.

// FNV-1a 32-bit. Dipilih karena pendek, tanpa dependensi, dan hasilnya sama di mana pun;
// ini bukan hash kriptografis dan tidak perlu — tugasnya menyebar, bukan mengamankan.
function fnv1a(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Aliran angka tak terbatas yang deterministik dari satu kunci.
function aliran(kunci) {
  let h = fnv1a(kunci);
  return () => {
    h = fnv1a(`${h}`, h);
    return h;
  };
}

const ABJAD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// 10 karakter huruf besar + angka, mengikuti bentuk nomor referensi pada invoice Meta
// supaya kedua dokumen bisa disandingkan tanpa terlihat ganjil.
export function nomorReferensi(kunci) {
  const next = aliran(`ref|${kunci}`);
  let out = "";
  while (out.length < 10) out += ABJAD[next() % ABJAD.length];
  return out;
}

// Dua blok 17 digit dipisah tanda hubung.
export function nomorTransaksi(kunci) {
  const next = aliran(`trx|${kunci}`);
  const blok = () => {
    let d = "";
    while (d.length < 17) d += String(next() % 10);
    // Digit pertama tidak pernah nol: nomor berawalan nol kerap hilang angkanya saat
    // ditempel ke spreadsheet, dan panjangnya jadi tidak seragam antar invoice.
    return (d[0] === "0" ? "7" : d[0]) + d.slice(1);
  };
  return `${blok()}-${blok()}`;
}

// Kunci penurunan. Total ikut masuk supaya periode yang sama dengan angka berbeda —
// mis. setelah margin diubah — tidak memakai nomor yang sama.
export function kunciInvoice({ nama, dari, sampai, total } = {}) {
  return [nama || "", dari || "", sampai || "", String(total ?? "")].join("|");
}
