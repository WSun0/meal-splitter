import 'server-only';

/*
 * Abuse controls for the unauthenticated share endpoint. Without them anyone
 * can script writes until the Vercel Blob free allowance runs out, which
 * pauses Blob and breaks every short link (new and existing).
 *
 * These checks are per serverless instance. They stop drive-by abuse and
 * casual scripts; a Vercel Firewall rate-limit rule on /api/share is the
 * durable backstop (see README > Security).
 */

type HeaderSource = { get(name: string): string | null };

/** Best-effort client IP. On Vercel these headers are set by the platform. */
export function clientIp(headers: HeaderSource): string {
  return (
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * Reject requests a browser marks as coming from another site. Requests with
 * no browser metadata (curl, scripts) pass here and are left to the rate
 * limiter: this check is about other websites using visitors' browsers.
 */
export function isCrossSite(headers: HeaderSource): boolean {
  const site = headers.get('sec-fetch-site');
  if (site) return site !== 'same-origin';

  const origin = headers.get('origin');
  if (!origin) return false;
  if (origin === 'null') return true;
  const host = headers.get('x-forwarded-host') || headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Sliding-window limiter keyed by IP, held in this instance's memory. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000
  ) {}

  /** Records a hit. Returns seconds to wait if over the limit, otherwise 0. */
  check(key: string, now = Date.now()): number {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
    }
    recent.push(now);
    this.hits.delete(key); // re-insert so Map order tracks recency
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      // Drop the least recently seen keys rather than growing without bound.
      for (const k of this.hits.keys()) {
        if (this.hits.size <= this.maxKeys) break;
        this.hits.delete(k);
      }
    }
    return 0;
  }
}

/**
 * Read a request body as text, refusing anything over `maxBytes` without
 * buffering it all first (Content-Length is checked up front; chunked bodies
 * are cut off while streaming).
 */
export async function readBodyCapped(
  req: { headers: HeaderSource; body: ReadableStream<Uint8Array> | null },
  maxBytes: number
): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
