import type { Metadata } from 'next';
import { cache } from 'react';
import SharedSplitView, { SharedSplitError } from '@/components/share/SharedSplitView';
import { loadSplit } from '@/lib/server/share-store';
import { fromWire, SharedSplit } from '@/lib/utils/share';
import { formatCurrency } from '@/lib/utils/helpers';

export const dynamic = 'force-dynamic';

const getSplit = cache(async (id: string): Promise<SharedSplit | null> => {
  try {
    return fromWire(await loadSplit(id));
  } catch (err) {
    console.error('Failed to load shared split:', err);
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
