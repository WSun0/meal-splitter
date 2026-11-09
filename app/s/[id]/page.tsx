import type { Metadata } from 'next';
import SharedSplitView, { SharedSplitError } from '@/components/share/SharedSplitView';
import { getSharedSplit as getSplit } from '@/lib/server/share-cache';
import { formatCurrency } from '@/lib/utils/helpers';

export const dynamic = 'force-dynamic';

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
    openGraph: { title: split.title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: split.title, description },
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
