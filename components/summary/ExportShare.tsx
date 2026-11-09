'use client';

import { useMeal } from '@/lib/store/meal-store';
import { generateMealSummary, getUnassignedItems } from '@/lib/utils/calculations';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import { buildSharedSplit, createShareLink, getSettlements, toWire } from '@/lib/utils/share';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const { meal, updateMealInfo } = useMeal();
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle');
  const [payerIdForExport, setPayerIdForExport] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const split = useMemo(
    () => (meal ? buildSharedSplit(meal, payerIdForExport || undefined) : null),
    [meal, payerIdForExport]
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
      text += `  • Items: ${money(d.items)}\n`;
      text += `  • Tax: ${money(d.tax)}\n`;
      text += `  • Tip: ${money(d.tip)}\n`;
      if (d.other !== 0) text += `  • Other: ${money(d.other)}\n`;
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

  // Sanitize string for CSV to prevent formula injection
  const sanitizeForCSV = (value: string): string => {
    // If the value starts with characters that could be interpreted as formulas, prefix with a single quote
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
    // Escape double quotes by doubling them
    return value.replace(/"/g, '""');
  };

  const handleDownloadCSV = () => {
    let csv = 'Diner,Items,Tax,Tip,Fees,Discounts,Adjustments,Total\n';
    summary.dinerTotals.forEach((dt) => {
      csv += `"${sanitizeForCSV(dt.dinerName)}",${dt.itemSubtotal.toFixed(2)},${dt.allocatedTax.toFixed(2)},${dt.allocatedTip.toFixed(2)},${dt.allocatedFees.toFixed(2)},${dt.allocatedDiscounts.toFixed(2)},${dt.adjustments.toFixed(2)},${dt.total.toFixed(2)}\n`;
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

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg shadow-secondary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Share & Export</h2>
          <p className="text-sm text-stone-500">Share the breakdown with friends</p>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {unassigned.length === 1 ? `"${unassigned[0].name}" isn't` : `${unassigned.length} items aren't`} assigned to
          anyone yet, so nobody is paying for {unassigned.length === 1 ? 'it' : 'them'} in this link.
        </div>
      )}

      <div className="mb-5">
        <label className="label" htmlFor="share-meal-name">Meal name</label>
        <input
          id="share-meal-name"
          type="text"
          value={meal.title}
          maxLength={200}
          placeholder="e.g. Friday ramen"
          onChange={(e) => updateMealInfo({ title: e.target.value })}
          onFocus={(e) => { if (meal.title === 'New Meal') e.target.select(); }}
          className="input"
        />
      </div>

      {meal.diners.length > 1 && (
        <div className="mb-5">
          <label className="label">Who paid the bill?</label>
          <select value={payerIdForExport} onChange={(e) => setPayerIdForExport(e.target.value)} className="input">
            <option value="">No payer selected</option>
            {meal.diners.map((d) => <option key={d.id} value={d.id}>{d.name} paid</option>)}
          </select>
        </div>
      )}

      {/* Shareable Link Section */}
      <div className="mb-5 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl border border-primary-200">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="font-bold text-primary-800">Shareable Link</p>
        </div>
        <p className="text-sm text-primary-700 mb-3">
          Share this link so friends can see what they owe:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            placeholder="Your link will appear here"
            readOnly
            aria-busy={!shareUrl}
            className="input flex-1 min-w-0 text-sm bg-white/80 text-stone-600 placeholder:text-stone-400"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopyLink}
            aria-live="polite"
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              linkCopyState === 'copied'
                ? 'bg-green-500 text-white'
                : linkCopyState === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            <CopyLabel state={linkCopyState} idle="Copy" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCopyToClipboard}
          aria-live="polite"
          className={`w-full py-4 px-4 rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            copyState === 'copied'
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
              : copyState === 'error'
              ? 'bg-red-500 text-white'
              : 'btn-secondary'
          }`}
        >
          <CopyLabel state={copyState} idle="Copy Full Summary" large />
        </button>

        <button onClick={handleDownloadCSV} className="btn-ghost w-full py-4 border-2 border-stone-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download CSV
        </button>
      </div>
    </div>
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
  return (
    <>
      <svg className={icon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      {idle}
    </>
  );
}
