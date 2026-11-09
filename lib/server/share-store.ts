import 'server-only';
import { createHash } from 'crypto';
import { get, put } from '@vercel/blob';
import { Wire } from '@/lib/utils/share';

/*
 * Short-link storage for shared splits, backed by Vercel Blob.
 *
 * Each split is one small JSON file at shares/<id>.json, where <id> is derived
 * from a hash of its contents (same split -> same link). Blob has no
 * inactivity expiry, and on the Hobby plan going over the free allowance
 * pauses Blob rather than billing, in which case the app falls back to
 * self-contained /split#... links.
 *
 * Connecting a Blob store to the Vercel project sets BLOB_READ_WRITE_TOKEN.
 * SHARE_BLOB_ACCESS must match the store's access type (default: private).
 */

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const SHARE_ID_LENGTH = 10;
const ID_PATTERN = /^[A-Za-z0-9]{6,16}$/;

const access = (): 'public' | 'private' => (process.env.SHARE_BLOB_ACCESS === 'public' ? 'public' : 'private');
const pathFor = (id: string) => `shares/${id}.json`;

export function isShareStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Content-addressed id: 10 base62 chars (~59 bits) of a SHA-256. */
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
  if (!isShareStorageConfigured()) return null;
  const json = JSON.stringify(wire);
  const id = shareIdFor(json);
  await put(pathFor(id), json, {
    access: access(),
    contentType: 'application/json',
    addRandomSuffix: false,
    // Same id means same content, so overwriting is harmless.
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 30,
  });
  return id;
}

export async function loadSplit(id: string): Promise<unknown | null> {
  if (!ID_PATTERN.test(id) || !isShareStorageConfigured()) return null;
  const result = await get(pathFor(id), { access: access() });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  if (text.length > 64_000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
