import { NextRequest, NextResponse } from 'next/server';
import { WireSchema } from '@/lib/utils/share';
import { isShareStorageConfigured, saveSplit } from '@/lib/server/share-store';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 32 * 1024;

/**
 * POST /api/share  body: wire-format split  ->  { id }
 * Returns 503 when storage isn't configured or fails; the client then falls
 * back to a self-contained /split#... link.
 */
export async function POST(req: NextRequest) {
  if (!isShareStorageConfigured()) {
    return NextResponse.json({ error: 'Short links are not configured' }, { status: 503 });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
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
