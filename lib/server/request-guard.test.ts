import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { RateLimiter, clientIp, isCrossSite, readBodyCapped } from './request-guard';

const h = (o: Record<string, string>) => new Headers(o);

describe('isCrossSite', () => {
  it('trusts Sec-Fetch-Site when present', () => {
    expect(isCrossSite(h({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSite(h({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSite(h({ 'sec-fetch-site': 'same-site' }))).toBe(true);
  });

  it('falls back to comparing Origin with Host', () => {
    expect(isCrossSite(h({ origin: 'https://willsplit.vercel.app', host: 'willsplit.vercel.app' }))).toBe(false);
    expect(isCrossSite(h({ origin: 'https://evil.example', host: 'willsplit.vercel.app' }))).toBe(true);
    expect(isCrossSite(h({ origin: 'null', host: 'willsplit.vercel.app' }))).toBe(true);
  });

  it('lets non-browser requests through to the rate limiter', () => {
    expect(isCrossSite(h({}))).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows up to the limit per window, then reports a wait', () => {
    const rl = new RateLimiter(3, 60_000);
    expect([rl.check('a', 0), rl.check('a', 1), rl.check('a', 2)]).toEqual([0, 0, 0]);
    expect(rl.check('a', 3)).toBeGreaterThan(0);
    expect(rl.check('b', 3)).toBe(0); // other IPs unaffected
    expect(rl.check('a', 60_001)).toBe(0); // window slid past the first hit
  });

  it('bounds memory', () => {
    const rl = new RateLimiter(1, 60_000, 100);
    for (let i = 0; i < 1000; i++) rl.check(`ip${i}`, i);
    expect((rl as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThanOrEqual(100);
  });
});

describe('clientIp', () => {
  it('prefers platform headers', () => {
    expect(clientIp(h({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.1.1.1');
    expect(clientIp(h({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1' }))).toBe('2.2.2.2');
  });
});

describe('readBodyCapped', () => {
  const req = (body: string, headers: Record<string, string> = {}) => {
    const r = new Request('http://x', { method: 'POST', body, headers });
    return { headers: r.headers, body: r.body };
  };

  it('returns the body when small', async () => {
    expect(await readBodyCapped(req('hello'), 10)).toBe('hello');
  });

  it('rejects by Content-Length without reading', async () => {
    expect(await readBodyCapped({ headers: h({ 'content-length': '999999' }), body: null }, 10)).toBeNull();
  });

  it('rejects oversized streamed bodies', async () => {
    expect(await readBodyCapped(req('x'.repeat(50)), 10)).toBeNull();
  });
});
