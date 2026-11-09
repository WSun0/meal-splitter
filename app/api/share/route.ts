import { NextRequest, NextResponse } from 'next/server';
import { WireSchema } from '@/lib/utils/share';
import { isShareStorageConfigured, saveSplit } from '@/lib/server/share-store';
import { RateLimiter, clientIp, isCrossSite, readBodyCapped } from '@/lib/server/request-guard';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 32 * 1024;

// 30 links per IP per 10 minutes is far above normal use (one link per meal,
// plus a few re-generations while renaming) and well under the Blob allowance.
const limiter = new RateLimiter(30, 10 * 60 * 1000);

/**
 * POST /api/share  body: wire-format split  ->  { id }
 * Returns 503 when storage isn't configured or fails; the client then falls
 * back to a self-contained /split#... link. Any other non-200 does the same.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req.headers)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
  }

  if (!isShareStorageConfigured()) {
    return NextResponse.json({ error: 'Short links are not configured' }, { status: 503 });
  }

  const text = await readBodyCapped(req, MAX_BODY_BYTES);
  if (text === null) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = WireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid split data' }, { status: 400 });
  }

  // Counted after validation so malformed requests can't lock out a real user
  // sharing from the same network, but before any storage write.
  const retryAfter = limiter.check(clientIp(req.headers));
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: 'Too many links created. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  try {
    const id = await saveSplit(parsed.data);
    if (!id) {
      return NextResponse.json({ error: 'Short links are not configured' }, { status: 503 });
    }
    return NextResponse.json({ id });
  } catch (err) {
    console.error('Failed to save shared split:', err);
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}
