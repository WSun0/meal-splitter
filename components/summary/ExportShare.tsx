'use client';

import { useMeal } from '@/lib/store/meal-store';
import { generateMealSummary, generateSettlementSuggestions } from '@/lib/utils/calculations';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import { createShareableData, generateShareUrl } from '@/lib/utils/share';
import { useState, useEffect } from 'react';

export default function ExportShare() {
  const { meal } = useMeal();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [payerIdForExport, setPayerIdForExport] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (meal) {
      const data = createShareableData(meal, payerIdForExport || undefined);
      setShareUrl(generateShareUrl(data));
    }
  }, [meal, payerIdForExport]);

  if (!meal) return null;

  const summary = generateMealSummary(meal);
  const settlements = payerIdForExport ? generateSettlementSuggestions(summary, payerIdForExport) : [];

  const generateTextSummary = (): string => {
    let text = `🍽️ Meal Split Summary\n━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📍 ${meal.title}\n`;
    if (meal.restaurant) text += `🏪 ${meal.restaurant}\n`;
    text += `📅 ${formatDate(meal.date)}\n\n`;
    text += `👥 Per-Person:\n`;
    summary.dinerTotals.forEach((dt) => {
      text += `\n${dt.dinerName}: ${formatCurrency(dt.total)}\n`;
      text += `  • Items: ${formatCurrency(dt.itemSubtotal)}\n`;
      text += `  • Tax: ${formatCurrency(dt.allocatedTax)}\n`;
      text += `  • Tip: ${formatCurrency(dt.allocatedTip)}\n`;
    });
    text += `\n🧾 Total: ${formatCurrency(meal.receiptMeta.total)}\n`;
    if (settlements.length > 0) {
      text += `\n💸 Settlement:\n`;
      settlements.forEach((s) => { text += `${s.from} → ${s.to}: ${formatCurrency(s.amount)}\n`; });
    }
    text += `\n🔗 View: ${shareUrl}\n`;
    text += `\n✨ Will's Meal Splitting Tool\n`;
    return text;
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateTextSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDownloadCSV = () => {
    let csv = 'Diner,Items,Tax,Tip,Fees,Discounts,Adjustments,Total\n';
    summary.dinerTotals.forEach((dt) => {
      csv += `"${dt.dinerName}",${dt.itemSubtotal.toFixed(2)},${dt.allocatedTax.toFixed(2)},${dt.allocatedTip.toFixed(2)},${dt.allocatedFees.toFixed(2)},${dt.allocatedDiscounts.toFixed(2)},${dt.adjustments.toFixed(2)},${dt.total.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mealsplit-${meal.title.replace(/\s+/g, '-').toLowerCase()}-${meal.date}.csv`;
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
            readOnly
            className="input flex-1 text-sm bg-white/80 text-stone-600"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopyLink}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              linkCopied
                ? 'bg-green-500 text-white'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {linkCopied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCopyToClipboard}
          className={`w-full py-4 px-4 rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            copied 
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25' 
              : 'btn-secondary'
          }`}
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Copy Full Summary
            </>
          )}
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
