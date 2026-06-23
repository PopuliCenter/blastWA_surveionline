import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/auth.js";

// Manajemen user — hanya superadmin. Untuk halaman Admin di frontend.

const sanitize = (u: { id: string; name: string; username: string; email: string | null; role: string; active: boolean; createdAt: Date }) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  // Hanya superadmin
  app.addHook("preHandler", async (req, reply) => {
    if (req.user.role !== "superadmin") return reply.code(403).send({ error: "forbidden" });
  });

  app.get("/api/users", async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(sanitize);
  });

  app.post("/api/users", async (req, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(4),
        email: z.string().optional(),
        role: z.enum(["superadmin", "admin", "viewer"]).default("admin"),
        active: z.boolean().default(true),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const exists = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (exists) return reply.code(409).send({ error: "username sudah dipakai" });

    const { password, ...rest } = parsed.data;
    const user = await prisma.user.create({ data: { ...rest, passwordHash: await hashPassword(password) } });
    return reply.code(201).send(sanitize(user));
  });

  app.put("/api/users/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        username: z.string().min(1).optional(),
        password: z.string().min(4).optional(),
        email: z.string().optional(),
        role: z.enum(["superadmin", "admin", "viewer"]).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { password, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (password) data.passwordHash = await hashPassword(password);

    const user = await prisma.user.update({ where: { id }, data });
    return sanitize(user);
  });

  app.delete("/api/users/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (id === req.user.sub) return reply.code(400).send({ error: "tidak bisa menghapus akun sendiri" });
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });
}
