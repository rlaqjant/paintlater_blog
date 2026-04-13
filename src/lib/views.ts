import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

export async function getViewCount(slug: string): Promise<number | null> {
  if (!redis) return null;
  try {
    const count = await redis.get<number>(`views:${slug}`);
    return count ?? 0;
  } catch (error) {
    console.error("getViewCount failed", error);
    return null;
  }
}

export async function incrementViewCount(
  slug: string
): Promise<number | null> {
  if (!redis) return null;
  try {
    return await redis.incr(`views:${slug}`);
  } catch (error) {
    console.error("incrementViewCount failed", error);
    return null;
  }
}
