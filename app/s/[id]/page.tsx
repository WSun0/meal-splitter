import type { Metadata } from 'next';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import SharedSplitView, { SharedSplitError } from '@/components/share/SharedSplitView';
import { loadSplit } from '@/lib/server/share-store';
import { fromWire, SharedSplit } from '@/lib/utils/share';
import { formatCurrency } from '@/lib/utils/helpers';

export const dynamic = 'force-dynamic';

class ShareNotFound extends Error {}

// Shares are content-addressed and never change, so a successful read can be
// cached for a long time. This keeps repeat views (and link-preview bots) from
// spending Blob read operations. Misses throw so they are never cached.
const loadCached = unstable_cache(
  async (id: string) => {
    const wire = await loadSplit(id);
    if (wire == null) throw new ShareNotFound();
    return wire;
  },
  ['shared-split-v1'],
  { revalidate: 60 * 60 * 24 * 30 }
);

const getSplit = cache(async (id: string): Promise<SharedSplit | null> => {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  try {
    return fromWire(await loadCached(id));
  } catch (err) {
    if (!(err instanceof ShareNotFound)) console.error('Failed to load shared split:', err);
    return null;
  }
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const split = await getSplit((await params).id);
  if (!split) return { title: 'Meal Splitter' };
  const payer = split.payer !== undefined ? split.diners[split.payer] : undefined;
  const description = payer
    ? `${payer.name} paid ${formatCurrency(split.total / 100)}. See what you owe.`
    : `Total ${formatCurrency(split.total / 100)}. See what you owe.`;
  return {
    title: `${split.title} · Meal Splitter`,
    description,
    openGraph: { title: split.title, description },
    robots: { index: false },
  };
}

export default async function ShortSharePage({ params }: Props) {
  const split = await getSplit((await params).id);
  if (!split) {
    return (
      <SharedSplitError
        title="Split Not Found"
        message="This link may have expired or been mistyped. Ask for a new link."
      />
    );
  }
  return <SharedSplitView split={split} />;
}
