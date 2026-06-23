import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyPassword } from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/login", async (req, reply) => {
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
}
