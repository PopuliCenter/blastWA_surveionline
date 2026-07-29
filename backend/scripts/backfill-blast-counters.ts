/**
 * Hitung ulang penghitung blast (deliveredCount / readCount / failedCount) dari baris
 * BlastRecipient, yang merupakan sumber kebenaran.
 *
 * Kenapa perlu: sebelum commit ini, satu callback webhook yang datang berulang
 * (Meta & Qontak menjamin "at least once") menaikkan deliveredCount berkali-kali,
 * dan setiap percobaan ulang pengiriman menaikkan failedCount berkali-kali. Akibatnya
 * angka "Sampai" bisa melampaui "Terkirim". Penyebabnya sudah diperbaiki di kode;
 * skrip ini membereskan data lama yang terlanjur membengkak.
 *
 * sentCount TIDAK disentuh — lihat catatan di src/lib/deliveryStatus.ts.
 *
 * Pemakaian (dari folder backend/):
 *   npm run backfill:blast-counters            # hanya menampilkan rencana, tidak menulis
 *   npm run backfill:blast-counters -- --apply # benar-benar menyimpan perubahan
 *
 * Aman diulang: menjalankannya dua kali tidak mengubah apa pun pada kali kedua.
 */
import { prisma } from "../src/db.js";
import { countersFromStatuses } from "../src/lib/deliveryStatus.js";

type Row = {
  id: string;
  judul: string;
  sent: number;
  dari: { deliveredCount: number; readCount: number; failedCount: number };
  ke: { deliveredCount: number; readCount: number; failedCount: number };
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const blasts = await prisma.blast.findMany({
    select: {
      id: true,
      sentCount: true,
      deliveredCount: true,
      readCount: true,
      failedCount: true,
      survey: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Satu query untuk semua blast sekaligus.
  const grouped = await prisma.blastRecipient.groupBy({ by: ["blastId", "status"], _count: true });
  const perBlast = new Map<string, Record<string, number>>();
  for (const g of grouped) {
    const m = perBlast.get(g.blastId) ?? {};
    m[g.status] = g._count;
    perBlast.set(g.blastId, m);
  }

  const changes: Row[] = [];
  for (const b of blasts) {
    const byStatus = perBlast.get(b.id);
    // Blast tanpa baris penerima sama sekali (mis. data lama sebelum tabel ini terisi)
    // dilewati — menulis nol ke situ justru menghapus riwayat yang masih berarti.
    if (!byStatus) continue;

    const ke = countersFromStatuses(byStatus);
    const dari = { deliveredCount: b.deliveredCount, readCount: b.readCount, failedCount: b.failedCount };
    const berubah = (Object.keys(ke) as (keyof typeof ke)[]).some((k) => ke[k] !== dari[k]);
    if (berubah) changes.push({ id: b.id, judul: b.survey?.title ?? "(tanpa survei)", sent: b.sentCount, dari, ke });
  }

  console.log(`Blast diperiksa : ${blasts.length}`);
  console.log(`Perlu diperbaiki: ${changes.length}\n`);

  for (const c of changes) {
    const f = (k: keyof Row["ke"]): string => (c.dari[k] === c.ke[k] ? `${c.ke[k]}` : `${c.dari[k]} → ${c.ke[k]}`);
    console.log(`  ${c.judul}  [${c.id}]`);
    console.log(`    terkirim ${c.sent} (tidak diubah) · sampai ${f("deliveredCount")} · dibaca ${f("readCount")} · gagal ${f("failedCount")}`);
  }

  if (!changes.length) {
    console.log("Semua penghitung sudah cocok. Tidak ada yang perlu diubah.");
    return;
  }

  if (!apply) {
    console.log("\nIni baru simulasi — belum ada yang disimpan.");
    console.log("Jalankan ulang dengan --apply untuk benar-benar menyimpan.");
    return;
  }

  await prisma.$transaction(changes.map((c) => prisma.blast.update({ where: { id: c.id }, data: c.ke })));
  console.log(`\n${changes.length} blast diperbarui.`);
}

main()
  .catch((err) => {
    console.error("Backfill gagal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
