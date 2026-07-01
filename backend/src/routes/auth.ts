import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Login dibatasi ketat: maks 10 percobaan / menit per IP (anti brute-force).
  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = z.object({ username: z.string(), password: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "input tidak valid" });

    const user = await prisma.user.findUnique({ where: { username: body.data.username } });
    if (!user || !user.active) return reply.code(401).send({ error: "Username atau password salah." });

    const ok = await verifyPassword(user.passwordHash, body.data.password);
    if (!ok) return reply.code(401).send({ error: "Username atau password salah." });

    const token = app.jwt.sign({ sub: user.id, role: user.role, name: user.name }, { expiresIn: "12h" });
    return { token, user: { id: user.id, name: user.name, role: user.role, email: user.email } };
  });

  app.get("/api/auth/me", { onRequest: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return { user: null };
    return { user: { id: user.id, name: user.name, role: user.role, email: user.email } };
  });

  // Ganti password sendiri — wajib password lama (aman untuk semua role).
  // Dibatasi agar tidak bisa di-brute-force menebak password lama.
  app.post(
    "/api/auth/change-password",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
        })
        .safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message || "input tidak valid" });
      if (body.data.newPassword === body.data.currentPassword)
        return reply.code(400).send({ error: "Password baru harus berbeda dari yang lama." });

      const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (!user) return reply.code(401).send({ error: "Sesi tidak valid." });

      const ok = await verifyPassword(user.passwordHash, body.data.currentPassword);
      if (!ok) return reply.code(400).send({ error: "Password lama salah." });

      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.data.newPassword) } });
      return { ok: true };
    },
  );
}
