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
// Logo digambar inline, bukan ditarik dari URL: dokumen dibuka di jendela terpisah dan
// sering disimpan jadi PDF, di mana gambar dari jaringan bisa gagal muat tanpa jejak dan
// menyisakan kotak kosong di dokumen yang sudah terkirim ke klien.
const LOGO_WA = `<svg width="54" height="54" viewBox="0 0 24 24" aria-label="WhatsApp">
  <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z" fill="#25D366"/>
  <path d="M8.9 8.6c.3-.6 1.2-.5 1.4 0l.5 1.2c.1.3 0 .6-.2.8l-.4.3c.5 1 1.2 1.7 2.2 2.2l.3-.4c.2-.2.5-.3.8-.2l1.2.5c.5.2.6 1.1 0 1.4-1.4.8-3.1.2-4.4-1.1-1.3-1.3-1.9-3-1.4-4.4Z" fill="#fff"/>
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

  const baris = hasil.baris
    .map(
      (b) => `<tr><td>${esc(NAMA_KOMPONEN[b.kode] || b.label)}</td><td class="r">${b.jumlah.toLocaleString("en-US")}</td>
        <td class="r">${nt(b.tarif)}</td><td class="r">${n(b.subtotal)}</td></tr>`,
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
  body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#1c1e21;margin:0;padding:48px 56px;max-width:900px}
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
      Subtotal: ${n(hasil.subtotal)}<br>
      ${hasil.marginPersen > 0 ? `Margin (${hasil.marginPersen}%): ${n(hasil.margin)}<br>` : ""}
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
    <tr><td colspan="3" class="r">Subtotal</td><td class="r">${n(hasil.subtotal)}</td></tr>
    ${hasil.marginPersen > 0 ? `<tr><td colspan="3" class="r">Margin ${hasil.marginPersen}%</td><td class="r">${n(hasil.margin)}</td></tr>` : ""}
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
