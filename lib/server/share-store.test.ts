import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const files = new Map<string, string>();
const putCalls: { path: string; opts: Record<string, unknown> }[] = [];
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path: string, body: string, opts: Record<string, unknown>) => {
    files.set(path, body);
    putCalls.push({ path, opts });
    return { url: `https://x/${path}`, pathname: path };
  }),
  get: vi.fn(async (path: string) => {
    const body = files.get(path);
    if (body === undefined) return null;
    return { statusCode: 200, stream: new Response(body).body, headers: new Headers(), blob: {} };
  }),
}));

import { saveSplit, loadSplit, shareIdFor } from './share-store';
import { WireSchema } from '../utils/share';

const wire = WireSchema.parse([2, 'Ramen', '', '2026-11-08', 5000, 0, [['Will', 4000, 400, 600, 0, 5000]], []]);

describe('share-store (Vercel Blob)', () => {
  beforeEach(() => {
    files.clear();
    putCalls.length = 0;
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_secret';
    delete process.env.SHARE_BLOB_ACCESS;
  });

  it('saves under a content-addressed id and loads it back', async () => {
    const id = await saveSplit(wire);
    expect(id).toBe(shareIdFor(JSON.stringify(wire)));
    expect(id).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(putCalls[0].path).toBe(`shares/${id}.json`);
    expect(putCalls[0].opts).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: true });
    expect(await loadSplit(id!)).toEqual(wire);
  });

  it('gives identical splits the same id', async () => {
    expect(await saveSplit(wire)).toBe(await saveSplit(JSON.parse(JSON.stringify(wire))));
  });

  it('honours SHARE_BLOB_ACCESS=public', async () => {
    process.env.SHARE_BLOB_ACCESS = 'public';
    await saveSplit(wire);
    expect(putCalls[0].opts.access).toBe('public');
  });

  it('returns null for unknown or malformed ids', async () => {
    expect(await loadSplit('AAAAAAAAAA')).toBeNull();
    expect(await loadSplit('../etc/passwd')).toBeNull();
  });

  it('does nothing without a token', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(await saveSplit(wire)).toBeNull();
    expect(await loadSplit('AAAAAAAAAA')).toBeNull();
    expect(putCalls).toHaveLength(0);
  });
});
