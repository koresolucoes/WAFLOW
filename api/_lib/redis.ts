import { Redis } from '@upstash/redis';

// As credenciais são obtidas das variáveis de ambiente configuradas no Vercel.
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.error("FATAL: Upstash Redis credentials (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are not set in environment variables.");
  // Lança um erro para interromper a execução se as credenciais estiverem ausentes.
  throw new Error("Server configuration error: Redis credentials missing.");
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});
