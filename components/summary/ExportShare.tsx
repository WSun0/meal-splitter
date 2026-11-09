'use client';

import { useMeal } from '@/lib/store/meal-store';
import { generateMealSummary, getUnassignedItems } from '@/lib/utils/calculations';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import { buildSharedSplit, createShareLink, getSettlements, toWire } from '@/lib/utils/share';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { csvCell } from '@/lib/utils/helpers';

type CopyState = 'idle' | 'generating' | 'copied' | 'error';

/**
 * Copy text that may still be on its way. Passing a promise to ClipboardItem
 * keeps the click's user-activation alive while the link is created (Safari
 * otherwise refuses a clipboard write that happens after an await).
 */
async function copyEventually(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return;
    } catch {
      // fall through (older browsers reject promise-valued ClipboardItems)
    }
  }
  await navigator.clipboard.writeText(await text);
}

export default function ExportShare() {
  const { meal } = useMeal();
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle');
  const [shareUrl, setShareUrl] = useState('');

  const split = useMemo(
    () => (meal ? buildSharedSplit(meal, meal.payerId) : null),
    [meal]
  );

  // One link request per distinct split, shared by the background prefetch and
  // the copy buttons. The buttons never wait on a disabled state: if the link
  // isn't ready, they show "Generating link…" and copy as soon as it is.
  const splitKey = useMemo(() => (split ? JSON.stringify(toWire(split)) : ''), [split]);
  const linkRequest = useRef<{ key: string; promise: Promise<string> } | null>(null);

  const getLink = useCallback((): Promise<string> => {
    if (!split) return Promise.resolve('');
    if (linkRequest.current?.key !== splitKey) {
      const promise = createShareLink(split).then(({ url }) => url);
      linkRequest.current = { key: splitKey, promise };
      promise.then((url) => {
        if (linkRequest.current?.key === splitKey) setShareUrl(url);
      });
    }
    return linkRequest.current.promise;
  }, [split, splitKey]);

  // Prefetch once edits settle, so the link is usually ready before you tap Copy.
  useEffect(() => {
    if (!split) return;
    setShareUrl('');
    const timer = setTimeout(() => void getLink(), 700);
    return () => clearTimeout(timer);
  }, [split, getLink]);

  const flash = (set: (s: CopyState) => void, state: CopyState) => {
    set(state);
    setTimeout(() => set('idle'), 2000);
  };

  if (!meal || !split) return null;

  const summary = generateMealSummary(meal);
  const unassigned = getUnassignedItems(meal);
  const settlements = getSettlements(split);
  const money = (cents: number) => formatCurrency(cents / 100);

  const generateTextSummary = (link: string): string => {
    let text = `🍽️ Meal Split Summary\n━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📍 ${split.title}\n`;
    if (split.restaurant) text += `🏪 ${split.restaurant}\n`;
    text += `📅 ${formatDate(split.date)}\n\n`;
    if (settlements.length > 0) {
      text += `💸 ${settlements[0].to} paid. Settle up:\n`;
      settlements.forEach((s) => { text += `${s.from} → ${s.to}: ${money(s.amount)}\n`; });
      text += `\n`;
    }
    text += `👥 Per-Person:\n`;
    split.diners.forEach((d) => {
      text += `\n${d.name}: ${money(d.total)}\n`;
      text += `  · Items: ${money(d.items)}\n`;
      text += `  · Tax: ${money(d.tax)}\n`;
      text += `  · Tip: ${money(d.tip)}\n`;
      if (d.other !== 0) text += `  · Other: ${money(d.other)}\n`;
    });
    text += `\n🧾 Total: ${money(split.total)}\n`;
    if (link) text += `\n🔗 Full breakdown: ${link}\n`;
    text += `\n✨ Will's Meal Splitting Tool\n`;
    return text;
  };

  const runCopy = async (set: (s: CopyState) => void, text: Promise<string>) => {
    if (!shareUrl) set('generating');
    try {
      await copyEventually(text);
      flash(set, 'copied');
    } catch (err) {
      console.error('Failed to copy:', err);
      flash(set, 'error');
    }
  };

  const handleCopyToClipboard = () => runCopy(setCopyState, getLink().then(generateTextSummary));
  const handleCopyLink = () => runCopy(setLinkCopyState, getLink());


  const handleDownloadCSV = () => {
    let csv = 'Diner,Items,Tax,Tip,Fees,Discounts,Adjustments,Total\n';
    summary.dinerTotals.forEach((dt) => {
      csv += `${csvCell(dt.dinerName)},${dt.itemSubtotal.toFixed(2)},${dt.allocatedTax.toFixed(2)},${dt.allocatedTip.toFixed(2)},${dt.allocatedFees.toFixed(2)},${dt.allocatedDiscounts.toFixed(2)},${dt.adjustments.toFixed(2)},${dt.total.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mealsplit-${(meal.title.trim() || 'meal').replace(/\s+/g, '-').toLowerCase()}-${meal.date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const linkReady = Boolean(shareUrl);

  return (
    <section className="pt-2" aria-labelledby="share-heading">
      <h2 id="share-heading" className="font-serif text-2xl font-medium tracking-tight text-folder-text">Send it to the table</h2>
      <p className="text-folder-muted mt-1 mb-4">
        The link shows everyone what they owe and exactly how it was worked out.
      </p>

      {unassigned.length > 0 && (
        <p className="mb-3 text-sm text-secondary-200">
          {unassigned.length === 1 ? `“${unassigned[0].name}” isn’t` : `${unassigned.length} items aren’t`} assigned yet, so the link will leave {unassigned.length === 1 ? 'it' : 'them'} out.
        </p>
      )}

      <button
        onClick={handleCopyLink}
        aria-live="polite"
        className={`btn-cta w-full py-4 text-base ${linkCopyState === 'error' ? '!bg-red-400' : ''}`}
      >
        <CopyLabel state={linkCopyState} idle="Copy link" large />
      </button>

      <p className={`mt-2 text-sm truncate text-center ${linkReady ? 'text-folder-muted' : 'text-folder-muted/60'}`} title={shareUrl}>
        {linkReady ? shareUrl.replace(/^https?:\/\//, '') : 'Preparing link…'}
      </p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={handleCopyToClipboard} aria-live="polite" className="btn-folder justify-center py-3 text-[15px]">
          <CopyLabel state={copyState} idle="Copy as text" />
        </button>
        <button onClick={handleDownloadCSV} className="btn-folder justify-center py-3 text-[15px]">
          Download CSV
        </button>
      </div>
    </section>
  );
}

function CopyLabel({ state, idle, large }: { state: CopyState; idle: string; large?: boolean }) {
  const icon = large ? 'w-5 h-5' : 'w-4 h-4';
  if (state === 'generating') {
    return (
      <>
        <span className={`${icon} rounded-full border-2 border-current border-t-transparent animate-spin`} aria-hidden />
        Generating link…
      </>
    );
  }
  if (state === 'copied') {
    return (
      <>
        <svg className={icon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Copied!
      </>
    );
  }
  if (state === 'error') return <>Couldn&apos;t copy, try again</>;
  return <>{idle}</>;
}
