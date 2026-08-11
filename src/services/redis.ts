import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
let client: Redis | undefined;

export function getRedis(): Redis | undefined {
  if (!redisUrl) return undefined;
  if (!client) {
    client = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
    client.on("error", (error) => console.error(`[redis] ${error.message}`));
  }
  return client;
}
