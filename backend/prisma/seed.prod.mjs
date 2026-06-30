// Seed admin untuk PRODUKSI (image hasil build hanya punya dist/, bukan src/).
// Jalankan di dalam kontainer backend produksi:
//   docker compose -f deploy/docker-compose.prod.yml run --rm backend node prisma/seed.prod.mjs
import { prisma } from "../dist/db.js";
import { env } from "../dist/env.js";
import { hashPassword } from "../dist/lib/auth.js";

async function main() {
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const user = await prisma.user.upsert({
    where: { username: env.SEED_ADMIN_USERNAME },
    update: {},
    create: {
      name: "Populi Admin",
      username: env.SEED_ADMIN_USERNAME,
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "superadmin",
      active: true,
    },
  });
  console.log(`✅ Admin siap: ${user.username} (role ${user.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
