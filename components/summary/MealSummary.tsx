'use client';

import { useMeal } from '@/lib/store/meal-store';
import { generateMealSummary, generateSettlementSuggestions, calculateComputedTotal } from '@/lib/utils/calculations';
import { formatCurrency } from '@/lib/utils/helpers';
import { useState, useRef, useEffect } from 'react';

export default function MealSummary() {
  const { meal, updateMealInfo } = useMeal();
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleEdit = () => {
    if (meal) {
      setEditTitle(meal.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    if (editTitle.trim()) {
      updateMealInfo({ title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  if (!meal || meal.diners.length === 0 || meal.items.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold text-stone-800 mb-4">Summary</h2>
        <p className="text-stone-500">Add diners and items to see the summary.</p>
      </div>
    );
  }

  const summary = generateMealSummary(meal);
  const computedTotal = calculateComputedTotal(meal);
  const settlements = selectedPayerId ? generateSettlementSuggestions(summary, selectedPayerId) : [];

  const colors = ['from-primary-400 to-primary-600', 'from-secondary-400 to-secondary-600', 'from-amber-400 to-amber-600', 'from-violet-400 to-violet-600', 'from-cyan-400 to-cyan-600'];

  return (
    <div className="card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="text-2xl font-bold text-stone-800 bg-transparent border-b-2 border-primary-400 outline-none w-full"
              placeholder="Meal name..."
            />
          ) : (
            <h2 
              className="text-2xl font-bold text-stone-800 cursor-pointer hover:text-primary-600 transition-colors group flex items-center gap-2"
              onClick={handleTitleEdit}
              title="Click to edit meal name"
            >
              {meal.title}
              <svg className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </h2>
          )}
          <p className="text-sm text-stone-500">{meal.restaurant && `${meal.restaurant} • `}{meal.date}</p>
        </div>
      </div>

      {/* Reconciliation warning */}
      {Math.abs(summary.reconciliationDiff) > 0.01 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> ${Math.abs(summary.reconciliationDiff).toFixed(2)} difference due to rounding.
            </p>
          </div>
        </div>
      )}

      {/* Per-diner breakdown */}
      <div className="space-y-3">
        {summary.dinerTotals.map((dt, i) => (
          <div key={dt.dinerId} className="p-5 bg-stone-50 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[i % colors.length]} text-white font-bold text-lg flex items-center justify-center shadow-md`}>
                  {dt.dinerName.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-stone-800">{dt.dinerName}</h3>
              </div>
              <p className="text-2xl font-bold gradient-text">{formatCurrency(dt.total)}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white p-3 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Items</p>
                <p className="font-semibold text-stone-700">{formatCurrency(dt.itemSubtotal)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Tax</p>
                <p className="font-semibold text-stone-700">{formatCurrency(dt.allocatedTax)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Tip</p>
                <p className="font-semibold text-stone-700">{formatCurrency(dt.allocatedTip)}</p>
              </div>
              {(dt.allocatedFees > 0 || dt.allocatedDiscounts !== 0 || dt.adjustments !== 0) && (
                <div className="bg-white p-3 rounded-xl border border-stone-100">
                  <p className="text-xs text-stone-400 mb-1">Other</p>
                  <p className="font-semibold text-stone-700">{formatCurrency(dt.allocatedFees + dt.allocatedDiscounts + dt.adjustments)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      {/* Receipt totals */}
      <div>
        <h3 className="text-lg font-bold text-stone-800 mb-4">Receipt Totals</h3>
        <div className="bg-stone-50 rounded-2xl p-5 space-y-3">
          {[
            ['Subtotal', meal.items.reduce((sum, item) => sum + item.amount, 0)],
            ['Tax', meal.receiptMeta.tax],
            ['Tip', meal.receiptMeta.tip],
            ...(meal.receiptMeta.fees.length > 0 ? [['Fees', meal.receiptMeta.fees.reduce((s, f) => s + f, 0)] as [string, number]] : []),
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <span className="text-stone-500">{label}</span>
              <span className="text-stone-700 font-medium">{formatCurrency(value as number)}</span>
            </div>
          ))}
          <div className="pt-3 mt-3 border-t border-stone-200 flex justify-between">
            <span className="font-bold text-stone-800">Total</span>
            <span className="text-2xl font-bold gradient-text">{formatCurrency(computedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Settlement */}
      {meal.diners.length > 1 && (
        <>
          <div className="divider" />
          <div>
            <h3 className="text-lg font-bold text-stone-800 mb-4">Settlement</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Who paid the bill?</label>
                <select value={selectedPayerId} onChange={(e) => setSelectedPayerId(e.target.value)} className="input">
                  <option value="">Select payer...</option>
                  {meal.diners.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {settlements.length > 0 && (
                <div className="p-5 bg-gradient-to-br from-secondary-50 to-secondary-100/50 rounded-2xl">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="font-bold text-secondary-800">Who owes what</p>
                  </div>
                  <div className="space-y-2">
                    {settlements.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-secondary-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white text-sm font-bold flex items-center justify-center">
                            {s.from.charAt(0)}
                          </div>
                          <span className="text-stone-700 font-medium">{s.from}</span>
                          <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary-400 to-secondary-600 text-white text-sm font-bold flex items-center justify-center">
                            {s.to.charAt(0)}
                          </div>
                          <span className="text-stone-700 font-medium">{s.to}</span>
                        </div>
                        <span className="font-bold text-primary-600">{formatCurrency(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
