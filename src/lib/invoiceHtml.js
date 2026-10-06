// Dokumen invoice dibuat sebagai HTML mandiri di jendela baru, bukan dengan CSS cetak di
// aplikasi: dialog cetak browser akan membawa seluruh tata letak dashboard kalau dicetak
// dari halaman ini, dan melawannya dengan @media print jauh lebih rapuh.
//
// Tata letaknya mengikuti invoice Meta agar bisa disandingkan langsung dengan aslinya,
// dengan dua perbedaan yang disengaja:
//   • Logo WhatsApp dipasang sebagai penanda PRODUK yang ditagihkan, bukan penanda
//     penerbit. Dokumen ini diterbitkan oleh pemakai aplikasi kepada kliennya, dan yang
//     menjaga itu tetap jelas adalah blok alamat di kaki halaman: penerbitnya ada di sana,
//     bukan Meta. Kalau blok itu dikosongkan, dokumen jadi sulit dibedakan dari invoice
//     Meta yang asli — jangan biarkan kosong.
//   • ADA tabel rincian di bawah. Invoice Meta hanya menampilkan satu angka; klien yang
//     ditagih berhak melihat dari mana angka itu berasal.
// Logo digambar inline sebagai VEKTOR, bukan ditarik dari URL dan bukan PNG yang
// ditempelkan sebagai data URI. Dua alasannya:
//   • dokumen dibuka di jendela terpisah dan sering disimpan jadi PDF, di mana gambar dari
//     jaringan bisa gagal muat tanpa jejak dan menyisakan kotak kosong di dokumen yang
//     sudah terkirim ke klien;
//   • vektor tetap tajam saat dokumennya dicetak, sementara bitmap 54px akan pecah — dan
//     invoice justru lebih sering dicetak daripada dibaca di layar.
const LOGO_WA = `<svg width="54" height="54" viewBox="0 0 24 24" aria-label="WhatsApp" role="img">
  <defs>
    <linearGradient id="wa" x1="12" y1="1.5" x2="12" y2="22.5" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5BF07A"/>
      <stop offset="1" stop-color="#20B954"/>
    </linearGradient>
  </defs>
  <path fill="url(#wa)" d="M12.04 1.5C6.23 1.5 1.51 6.22 1.51 12.03c0 1.86.49 3.68 1.42 5.28L1.42 22.5l5.33-1.4a10.5 10.5 0 0 0 5.29 1.42h.01c5.8 0 10.53-4.72 10.53-10.53 0-2.81-1.1-5.46-3.09-7.45a10.46 10.46 0 0 0-7.45-3.04z"/>
  <path fill="#fff" transform="translate(12 12) scale(1.12) translate(-12 -12)" d="M17.3 14.33c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.14-.65.15-.2.29-.75.94-.92 1.14-.17.19-.34.22-.63.07-.29-.14-1.23-.45-2.34-1.44-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.44-.51.14-.17.19-.29.29-.48.1-.2.05-.37-.02-.51-.07-.15-.65-1.58-.9-2.16-.24-.57-.48-.49-.65-.5h-.56c-.19 0-.51.07-.77.36-.27.29-1.02.99-1.02 2.42s1.04 2.81 1.19 3.01c.15.19 2.05 3.13 4.97 4.39.69.3 1.23.48 1.66.61.7.22 1.33.19 1.83.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.56-.34z"/>
</svg>`;

// Nama komponen dalam bahasa Inggris, dipetakan dari KODE-nya. Label Indonesia dari
// backend dipakai di layar Biaya; invoice yang keluar ke klien memakai nama di bawah,
// dan pemetaan lewat kode membuat redaksi label di backend bebas berubah tanpa
// diam-diam merusak dokumen tagihan.
const NAMA_KOMPONEN = {
  marketing: "Template message — Marketing",
  utility: "Template message — Utility",
  authentication: "Template message — Authentication",
  service: "Service message",
};

// `rincian` memilih model dokumen:
//   true  — ada tabel pemakaian di bawah, supaya klien bisa melihat dari mana angkanya.
//   false — hanya ringkasan seperti invoice Meta apa adanya.
// Keduanya disediakan karena keduanya sah: sebagian klien menagih balik dan butuh
// rinciannya, sebagian lain hanya mengarsipkan satu angka.
export function invoiceHtml({ hasil, inv, dari, sampai, rincian = true }) {
  const mu = hasil.mataUang;
  const fmt = (v, d) =>
    `${mu}${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const n = (v) => fmt(v, mu === "IDR" ? 0 : 2);
  // Tarif satuan selalu 2 desimal: tarif Meta ditulis 586,33 per pesan, dan membulatkannya
  // membuat jumlah × tarif tidak sama dengan subtotal yang tertera.
  const nt = (v) =>
    `${mu}${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const tglTransaksi = (() => {
    const d = new Date(`${inv.tanggal}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? esc(inv.tanggal)
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  })();

  // Alamat ditulis bebas baris per baris oleh pemakai, jadi tiap barisnya di-escape
  // sendiri lalu digabung — bukan diserahkan mentah ke HTML.
  const barisAlamat = (teks) =>
    String(teks ?? "")
      .split(/\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => `<div>${esc(b)}</div>`)
      .join("");

  const blok = (label, isi) =>
    isi ? `<div class="blk"><div class="lbl">${esc(label)}</div><div class="val">${esc(isi)}</div></div>` : "";

  // Margin TIDAK pernah muncul di invoice. Ia perhitungan internal — berapa imbalan jasa
  // yang diambil di atas biaya Meta — dan mencetaknya ke dokumen tagihan sama saja dengan
  // memberitahukan markup kepada klien yang ditagih.
  //
  // Menghapus barisnya saja tidak cukup: tanpa margin, Subtotal + Tax tidak lagi sama
  // dengan Total, dan angka yang tidak menjumlah akan dipertanyakan — justru menarik
  // perhatian ke hal yang ingin disembunyikan. Jadi margin DILEBURKAN ke harga: tarif dan
  // subtotal tiap komponen dinaikkan sebesar margin, sehingga yang tercetak adalah harga
  // JUAL per pesan, dan seluruh kolom menjumlah dengan benar.
  const f = 1 + (hasil.marginPersen > 0 ? hasil.marginPersen / 100 : 0);
  const subtotalTagih = hasil.subtotal + (hasil.margin || 0);

  const baris = hasil.baris
    .map(
      (b) => `<tr><td>${esc(NAMA_KOMPONEN[b.kode] || b.label)}</td><td class="r">${b.jumlah.toLocaleString("en-US")}</td>
        <td class="r">${nt(b.tarif * f)}</td><td class="r">${n(b.subtotal * f)}</td></tr>`,
    )
    .join("");

  // Tanda bintang hanya muncul bila yang ditulis berbeda dari yang dikalikan — sama seperti
  // invoice Meta, yang menandai PPN 12% atas dasar pengenaan pajak 11/12 (efektif 11%).
  const pajakBeda = hasil.pajakEfektifPersen !== hasil.pajakPersen;
  const bintang = pajakBeda ? "*" : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Tax Invoice — ${esc(inv.nama)}</title>
<style>
  *{box-sizing:border-box}
  /* Dokumen tagihan SELALU putih. Tanpa menyatakannya, latar belakang mengikuti
     color-scheme peramban: pada perangkat bermode gelap, teks #1c1e21 berakhir di atas
     latar gelap dan invoicenya nyaris tak terbaca di layar sebelum dicetak. */
  html{color-scheme:light}
  body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#1c1e21;background:#fff;margin:0;padding:48px 56px;max-width:900px}
  h1{font-size:21px;font-weight:400;margin:0 0 3px}
  .sub{color:#65676b;font-size:13px}
  hr{border:none;border-top:1px solid #dadde1;margin:26px 0}
  .cols{display:flex;justify-content:space-between;gap:48px;flex-wrap:wrap}
  .left{min-width:260px}
  .right{text-align:right;min-width:240px}
  .blk{margin:0 0 20px}
  .lbl{color:#65676b;font-size:13px}
  .val{font-weight:700;font-size:14px;margin-top:1px}
  .status{font-size:20px;color:#1c1e21;margin:0 0 6px}
  .total{font-size:38px;font-weight:400;letter-spacing:-.5px;margin:0 0 12px}
  .sum{color:#65676b;font-size:13px;line-height:1.75}
  .note{color:#65676b;font-size:13px;margin-top:20px}
  table{width:100%;border-collapse:collapse;margin:8px 0 0}
  th,td{padding:9px 8px;border-bottom:1px solid #dadde1;text-align:left;font-size:13px}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#65676b;font-weight:700}
  .r{text-align:right;white-space:nowrap}
  tr.tot td{font-weight:700;border-top:2px solid #1c1e21;border-bottom:none}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#65676b;margin:0 0 4px}
  .alamat{display:flex;justify-content:space-between;gap:48px;margin-top:64px;padding-bottom:6px;border-bottom:1px solid #dadde1;color:#8d949e;font-size:13.5px;line-height:1.72}
  .alamat .kanan{text-align:right}
  .vat{color:#8d949e;font-size:13.5px;margin-top:18px}
  .kepala{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
  .kepala svg{flex-shrink:0}
  @media print{body{padding:0}}
</style></head><body>

<div class="kepala">
  <div>
    <h1>Tax Invoice for ${esc(inv.nama)}</h1>
    ${inv.accountId ? `<div class="sub">Account ID: ${esc(inv.accountId)}</div>` : ""}
  </div>
  ${LOGO_WA}
</div>
<hr>

<div class="cols">
  <div class="left">
    ${blok("Transaction Date", tglTransaksi)}
    ${
      inv.metode
        ? `<div class="blk"><div class="lbl">Payment method</div><div class="val">${esc(inv.metode)}</div>${
            inv.referensi ? `<div class="lbl">Reference Number: ${esc(inv.referensi)}</div>` : ""
          }</div>`
        : ""
    }
    ${blok("Transaction ID", inv.transaksi)}
    ${blok("Product Type", inv.produk)}
  </div>
  <div class="right">
    ${inv.status ? `<div class="status">${esc(inv.status)}</div>` : ""}
    <div class="total">${n(hasil.total)}</div>
    <div class="sum">
      Subtotal: ${n(subtotalTagih)}<br>
      ${hasil.pajakPersen > 0 ? `Tax (${hasil.pajakPersen}%): ${n(hasil.pajak)}${bintang}` : ""}
    </div>
    ${inv.catatan ? `<div class="note">${esc(inv.catatan)}</div>` : ""}
  </div>
</div>

${
  rincian
    ? `<hr>

<h2>Usage details ${esc(dari)} to ${esc(sampai)}</h2>
<table>
  <thead><tr><th>Component</th><th class="r">Quantity</th><th class="r">Rate</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${baris || `<tr><td colspan="4">No billable components in this period.</td></tr>`}
    <tr><td colspan="3" class="r">Subtotal</td><td class="r">${n(subtotalTagih)}</td></tr>
    ${hasil.pajakPersen > 0 ? `<tr><td colspan="3" class="r">Tax (${hasil.pajakPersen}%)${bintang}</td><td class="r">${n(hasil.pajak)}</td></tr>` : ""}
    <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${n(hasil.total)}</td></tr>
  </tbody>
</table>`
    : ""
}

<div class="alamat">
  <div class="kiri">${barisAlamat(inv.penerbit)}</div>
  <div class="kanan">${barisAlamat(inv.alamatKlien)}</div>
</div>
${pajakBeda ? `<div class="vat">* VAT amount will be computed at ${hasil.pajakEfektifPersen}/${hasil.pajakPersen} of the sale price as the tax base.</div>` : ""}
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}
