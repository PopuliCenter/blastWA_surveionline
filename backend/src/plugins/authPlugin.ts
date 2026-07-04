import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWriter: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: string; name: string };
    user: { sub: string; role: string; name: string };
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  // Pin algoritma HS256 saat sign & verify → tolak token beralgoritma lain
  // (mencegah algorithm-confusion / "alg: none").
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: "HS256" },
    verify: { algorithms: ["HS256"] },
  });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  // Guard menulis: peran "viewer" hanya boleh baca. Blokir semua metode pengubah data.
  // Dipakai sebagai onRequest hook SETELAH `authenticate` (req.user sudah terisi).
  app.decorate("requireWriter", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.user?.role === "viewer") {
      reply.code(403).send({ error: "forbidden" });
    }
  });
}
