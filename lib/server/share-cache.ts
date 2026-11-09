import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { loadSplit } from './share-store';
import { fromWire, SharedSplit } from '@/lib/utils/share';

class ShareNotFound extends Error {}

// Shares are content-addressed and never change, so a successful read can be
// cached for a long time. This keeps repeat views, link-preview bots and the
// preview image from spending Blob read operations. Misses throw so they are
// never cached.
const loadCached = unstable_cache(
  async (id: string) => {
    const wire = await loadSplit(id);
    if (wire == null) throw new ShareNotFound();
    return wire;
  },
  ['shared-split-v1'],
  { revalidate: 60 * 60 * 24 * 30 }
);

/** The shared split for a short-link id, or null if it doesn't exist. */
export const getSharedSplit = cache(async (id: string): Promise<SharedSplit | null> => {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  try {
    return fromWire(await loadCached(id));
  } catch (err) {
    if (!(err instanceof ShareNotFound)) console.error('Failed to load shared split:', err);
    return null;
  }
});
