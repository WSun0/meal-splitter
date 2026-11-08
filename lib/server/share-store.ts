import 'server-only';
import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { Wire } from '@/lib/utils/share';

/*
 * Short-link storage for shared splits, backed by the same Upstash Redis used
 * for OCR rate limiting. Accepts either the UPSTASH_* env names or the KV_*
 * names the Vercel marketplace integration injects.
 */

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
const KEY_PREFIX = 'share:';
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const SHARE_ID_LENGTH = 10;

let redis: Redis | null | undefined;
let limiter: Ratelimit | null = null;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  if (redis) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 h'),
      prefix: 'share:ip',
    });
  }
  return redis;
}

export async function allowShareWrite(ip: string): Promise<boolean> {
  getRedis();
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit(ip);
    return success;
  } catch (err) {
    // Don't block sharing if the limiter itself is having trouble.
    console.error('Share rate limiter failed:', err);
    return true;
  }
}

/**
 * Content-addressed id: the same split always gets the same link, so the
 * share panel regenerating the link while you edit doesn't pile up keys for
 * identical data.
 */
export function shareIdFor(canonicalJson: string): string {
  const digest = createHash('sha256').update(canonicalJson).digest();
  let n = digest.readBigUInt64BE(0);
  let id = '';
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    id += BASE62[Number(n % 62n)];
    n /= 62n;
  }
  return id;
}

export async function saveSplit(wire: Wire): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const json = JSON.stringify(wire);
  const id = shareIdFor(json);
  // Refresh the TTL whenever the same split is shared again.
  await r.set(KEY_PREFIX + id, json, { ex: SHARE_TTL_SECONDS });
  return id;
}

export async function loadSplit(id: string): Promise<unknown | null> {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  const r = getRedis();
  if (!r) return null;
  const value = await r.get<unknown>(KEY_PREFIX + id);
  if (value == null) return null;
  // @upstash/redis auto-parses JSON strings; handle both just in case.
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}
