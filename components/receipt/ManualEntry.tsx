'use client';

import { useState, useEffect } from 'react';
import { useMeal } from '@/lib/store/meal-store';

export default function ManualEntry() {
  const { meal, addItem, updateReceiptMeta } = useMeal();
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemAmount, setItemAmount] = useState('');
  const [tax, setTax] = useState('');
  const [tip, setTip] = useState('');
  const [otherAdjustments, setOtherAdjustments] = useState('');

  // Auto-calculated values
  const calculateSubtotalFromItems = () => {
    if (!meal) return 0;
    return meal.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const subtotal = calculateSubtotalFromItems();
  const taxValue = parseFloat(tax) || 0;
  const tipValue = parseFloat(tip) || 0;
  const otherValue = parseFloat(otherAdjustments) || 0;
  const total = subtotal + taxValue + tipValue + otherValue;

  // Auto-update receiptMeta when values change
  useEffect(() => {
    if (meal) {
      updateReceiptMeta({
        subtotal,
        tax: taxValue,
        tip: tipValue,
        fees: otherValue !== 0 ? [otherValue] : [],
        total,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, taxValue, tipValue, otherValue]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemName.trim() && itemAmount) {
      const amount = parseFloat(itemAmount);
      const quantity = parseInt(itemQty, 10);
      if (!isNaN(amount) && !isNaN(quantity) && quantity > 0) {
        addItem({ name: itemName.trim(), quantity, amount, assignments: [] });
        setItemName('');
        setItemQty('1');
        setItemAmount('');
      }
    }
  };

  if (!meal) return null;

  return (
    <div className="card p-6 space-y-6">
      {/* Add Item Section */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Add Items</h2>
            <p className="text-sm text-stone-500">Enter each item from the receipt</p>
          </div>
        </div>

        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-6">
              <label className="label">Item Name</label>
              <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g., Burger" className="input" />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <label className="label">Qty</label>
              <input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="input text-center" />
            </div>
            <div className="col-span-8 sm:col-span-4">
              <label className="label">Amount ($)</label>
              <input type="number" step="0.01" min="0" value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} placeholder="0.00" className="input" />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </form>
      </div>

      <div className="divider" />

      {/* Receipt Totals Section */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg shadow-secondary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-800">Receipt Totals</h3>
            <p className="text-sm text-stone-500">Tax, tip, and other adjustments</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Auto-calculated Subtotal (read-only) */}
          <div className="p-4 bg-gradient-to-r from-stone-50 to-stone-100 rounded-xl border border-stone-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-stone-600 font-medium">Subtotal</span>
                <span className="text-xs text-stone-400 bg-stone-200 px-2 py-0.5 rounded-full">auto</span>
              </div>
              <span className="font-bold text-stone-800 text-lg">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tax ($)</label>
              <input type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label">Tip ($)</label>
              <input type="number" step="0.01" min="0" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0.00" className="input" />
            </div>
          </div>

          {/* Other Adjustments */}
          <div>
            <label className="label">Other Adjustments ($)</label>
            <input 
              type="number" 
              step="0.01" 
              value={otherAdjustments} 
              onChange={(e) => setOtherAdjustments(e.target.value)} 
              placeholder="0.00 (fees, discounts, etc.)" 
              className="input" 
            />
            <p className="text-xs text-stone-400 mt-1">Use negative for discounts (e.g., -5.00)</p>
          </div>

          {/* Auto-calculated Total (read-only) */}
          <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-primary-700 font-semibold">Total</span>
                <span className="text-xs text-primary-500 bg-primary-200 px-2 py-0.5 rounded-full">auto</span>
              </div>
              <span className="font-bold text-primary-800 text-2xl">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
