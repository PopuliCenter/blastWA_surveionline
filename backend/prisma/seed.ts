import { prisma } from "../src/db.js";
import { env } from "../src/env.js";
import { hashPassword } from "../src/lib/auth.js";

// Membuat user admin awal. Jalankan: npm run seed
async function main() {
  // Tolak password kosong/lemah agar tak pernah membuat admin dengan kredensial default/tebakan.
  if (!env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD.length < 8) {
    console.error("✗ Set SEED_ADMIN_PASSWORD (min. 8 karakter) di .env sebelum menjalankan seed.");
    process.exit(1);
  }
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
