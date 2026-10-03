// Dokumen invoice dibuat sebagai HTML mandiri di jendela baru, bukan dengan CSS cetak di
// aplikasi: dialog cetak browser akan membawa seluruh tata letak dashboard kalau dicetak
// dari halaman ini, dan melawannya dengan @media print jauh lebih rapuh.
//
// Tata letaknya mengikuti invoice Meta agar bisa disandingkan langsung dengan aslinya,
// dengan dua perbedaan yang disengaja:
//   • TANPA logo WhatsApp. Dokumen ini diterbitkan oleh pemakai aplikasi kepada kliennya,
//     bukan oleh Meta; memasang logo Meta di atasnya akan menyesatkan soal siapa penerbitnya.
//   • ADA tabel rincian di bawah. Invoice Meta hanya menampilkan satu angka; klien yang
//     ditagih berhak melihat dari mana angka itu berasal.
export function invoiceHtml({ hasil, inv, dari, sampai }) {
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
      (b) => `<tr><td>${esc(b.label)}</td><td class="r">${b.jumlah.toLocaleString("en-US")}</td>
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
  @media print{body{padding:0}}
</style></head><body>

<h1>Tax Invoice for ${esc(inv.nama)}</h1>
${inv.accountId ? `<div class="sub">Account ID: ${esc(inv.accountId)}</div>` : ""}
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

<hr>

<h2>Rincian pemakaian ${esc(dari)} s.d. ${esc(sampai)}</h2>
<table>
  <thead><tr><th>Komponen</th><th class="r">Jumlah</th><th class="r">Tarif</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${baris || `<tr><td colspan="4">Tidak ada komponen berbayar pada periode ini.</td></tr>`}
    <tr><td colspan="3" class="r">Subtotal</td><td class="r">${n(hasil.subtotal)}</td></tr>
    ${hasil.marginPersen > 0 ? `<tr><td colspan="3" class="r">Margin ${hasil.marginPersen}%</td><td class="r">${n(hasil.margin)}</td></tr>` : ""}
    ${hasil.pajakPersen > 0 ? `<tr><td colspan="3" class="r">Tax (${hasil.pajakPersen}%)${bintang}</td><td class="r">${n(hasil.pajak)}</td></tr>` : ""}
    <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${n(hasil.total)}</td></tr>
  </tbody>
</table>

<div class="alamat">
  <div class="kiri">${barisAlamat(inv.penerbit)}</div>
  <div class="kanan">${barisAlamat(inv.alamatKlien)}</div>
</div>
${pajakBeda ? `<div class="vat">* VAT amount will be computed at ${hasil.pajakEfektifPersen}/${hasil.pajakPersen} of the sale price as the tax base.</div>` : ""}
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}
