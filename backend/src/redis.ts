import { Redis } from "ioredis";
import { env } from "./env.js";

// BullMQ butuh maxRetriesPerRequest: null
export const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
