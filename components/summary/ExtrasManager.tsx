'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { AdjustmentScope, AllocationRule, AdjustmentType } from '@/lib/types/meal';
import { formatCurrency } from '@/lib/utils/helpers';

export default function ExtrasManager() {
  const { meal, updateReceiptMeta, addAdjustment, removeAdjustment } = useMeal();
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<AdjustmentType>('debit');
  const [scope, setScope] = useState<AdjustmentScope>('meal');
  const [allocationRule, setAllocationRule] = useState<AllocationRule>('proportional');
  const [personId, setPersonId] = useState('');

  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim() && amount) {
      const amountValue = parseFloat(amount);
      if (!isNaN(amountValue)) {
        addAdjustment({
          label: label.trim(),
          amount: type === 'credit' ? -Math.abs(amountValue) : Math.abs(amountValue),
          type,
          scope,
          allocationRule,
          personId: scope === 'person' ? personId : undefined,
        });
        setLabel(''); setAmount(''); setType('debit'); setScope('meal'); setAllocationRule('proportional'); setPersonId(''); setShowAdjustmentForm(false);
      }
    }
  };

  if (!meal) return null;

  const itemsSubtotal = meal.items.reduce((sum, item) => sum + item.amount, 0);
  const adjustmentsTotal = meal.adjustments.reduce((sum, a) => sum + a.amount, 0);

  const calculatedTotal = itemsSubtotal + meal.receiptMeta.tax + meal.receiptMeta.tip + adjustmentsTotal;

  return (
    <div className="space-y-6">
      {/* Tax & Tip Card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Tax & Tip</h2>
            <p className="text-sm text-stone-500">Confirm the values from your receipt</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Items Subtotal (read-only) */}
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-stone-800">Items Subtotal</p>
                <p className="text-xs text-stone-500">{meal.items.length} items</p>
              </div>
            </div>
            <p className="text-lg font-bold text-stone-700">{formatCurrency(itemsSubtotal)}</p>
          </div>

          {/* Tax */}
          <div className="p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="font-semibold text-stone-800">Tax</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={meal.receiptMeta.tax || ''}
                onChange={(e) => updateReceiptMeta({ tax: parseFloat(e.target.value) || 0 })}
                className="input text-lg font-semibold flex-1 !pl-0"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Tip */}
          <div className="p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-stone-800">Tip</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={meal.receiptMeta.tip || ''}
                onChange={(e) => updateReceiptMeta({ tip: parseFloat(e.target.value) || 0 })}
                className="input text-lg font-semibold flex-1 !pl-0"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Total */}
          <div className="p-4 bg-stone-50 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-stone-800">Receipt Total</p>
                  <p className="text-xs text-stone-500">From your receipt</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={meal.receiptMeta.total || ''}
                onChange={(e) => updateReceiptMeta({ total: parseFloat(e.target.value) || 0 })}
                className="input text-lg font-semibold flex-1 !pl-0"
                placeholder="0.00"
              />
            </div>
            {/* Mismatch warning */}
            {meal.receiptMeta.total > 0 && Math.abs(calculatedTotal - meal.receiptMeta.total) > 0.02 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex gap-2 items-start">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm">
                    <p className="text-amber-800 font-medium">Values don't add up</p>
                    <p className="text-amber-700">
                      Calculated: {formatCurrency(calculatedTotal)} vs Receipt: {formatCurrency(meal.receiptMeta.total)}
                    </p>
                    <p className="text-amber-600 text-xs mt-1">
                      Difference of {formatCurrency(Math.abs(calculatedTotal - meal.receiptMeta.total))} — check your values or add a fee/discount
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other Adjustments Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg shadow-secondary-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Other Charges</h2>
              <p className="text-sm text-stone-500">Fees, discounts, or custom adjustments</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAdjustmentForm(!showAdjustmentForm)} 
            className={showAdjustmentForm ? 'btn-ghost' : 'btn-secondary'}
          >
            {showAdjustmentForm ? 'Cancel' : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </>
            )}
          </button>
        </div>

        {showAdjustmentForm && (
          <form onSubmit={handleAdjustmentSubmit} className="mb-6 p-5 bg-stone-50 rounded-2xl space-y-4">
            <div>
              <label className="label">Description</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Service fee, Birthday discount" className="input" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount ($)</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="input" required />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as AdjustmentType)} className="input">
                  <option value="debit">+ Add to bill</option>
                  <option value="credit">− Subtract from bill</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Apply to</label>
              <select value={scope} onChange={(e) => { setScope(e.target.value as AdjustmentScope); if (e.target.value === 'meal') setPersonId(''); }} className="input">
                <option value="meal">Everyone (split)</option>
                <option value="person">One person only</option>
              </select>
            </div>
            {scope === 'person' && meal.diners.length > 0 && (
              <div>
                <label className="label">Select Person</label>
                <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input" required>
                  <option value="">Choose...</option>
                  {meal.diners.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {scope === 'meal' && (
              <div>
                <label className="label">Split Method</label>
                <select value={allocationRule} onChange={(e) => setAllocationRule(e.target.value as AllocationRule)} className="input">
                  <option value="proportional">By spending (proportional)</option>
                  <option value="explicit">Equal split</option>
                </select>
              </div>
            )}
            <button type="submit" className="btn-secondary w-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Add Adjustment
            </button>
          </form>
        )}

        {meal.adjustments.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-stone-600 font-medium">No additional charges</p>
            <p className="text-sm text-stone-400 mt-1">Service fees, discounts, etc. can be added above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meal.adjustments.map((adj) => {
              const diner = adj.personId ? meal.diners.find((d) => d.id === adj.personId) : null;
              const isCredit = adj.amount < 0;
              return (
                <div key={adj.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl group hover:bg-stone-100 transition-all">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isCredit ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-red-400 to-red-500'} shadow-md`}>
                    {isCredit ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800">{adj.label}</p>
                    <p className="text-sm text-stone-500">{adj.scope === 'person' && diner ? diner.name : adj.allocationRule === 'proportional' ? 'Split proportionally' : 'Split equally'}</p>
                  </div>
                  <p className={`font-bold text-lg ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                    {isCredit ? '−' : '+'}${Math.abs(adj.amount).toFixed(2)}
                  </p>
                  <button onClick={() => removeAdjustment(adj.id)} className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Preview */}
      <div className="card p-6 bg-gradient-to-br from-stone-50 to-stone-100">
        <h3 className="text-lg font-bold text-stone-800 mb-4">Quick Preview</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Items Subtotal</span>
            <span className="font-medium text-stone-700">{formatCurrency(itemsSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Tax</span>
            <span className="font-medium text-stone-700">{formatCurrency(meal.receiptMeta.tax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Tip</span>
            <span className="font-medium text-stone-700">{formatCurrency(meal.receiptMeta.tip)}</span>
          </div>
          {adjustmentsTotal !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Adjustments</span>
              <span className={`font-medium ${adjustmentsTotal < 0 ? 'text-green-600' : 'text-red-500'}`}>
                {adjustmentsTotal < 0 ? '−' : '+'}{formatCurrency(Math.abs(adjustmentsTotal))}
              </span>
            </div>
          )}
          <div className="pt-3 mt-3 border-t border-stone-300 flex justify-between">
            <span className="font-bold text-stone-800">Calculated Total</span>
            <span className="text-xl font-bold gradient-text">{formatCurrency(calculatedTotal)}</span>
          </div>
          {meal.receiptMeta.total > 0 && (
            <div className="flex justify-between text-sm pt-1">
              <span className="text-stone-500">Receipt Total</span>
              <span className="font-medium text-stone-700">{formatCurrency(meal.receiptMeta.total)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
