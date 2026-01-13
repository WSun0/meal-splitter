'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { AdjustmentScope, AllocationRule, AdjustmentType } from '@/lib/types/meal';

export default function AdjustmentsManager() {
  const { meal, addAdjustment, removeAdjustment } = useMeal();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<AdjustmentType>('debit');
  const [scope, setScope] = useState<AdjustmentScope>('meal');
  const [allocationRule, setAllocationRule] = useState<AllocationRule>('proportional');
  const [personId, setPersonId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
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
        setLabel(''); setAmount(''); setType('debit'); setScope('meal'); setAllocationRule('proportional'); setPersonId(''); setShowForm(false);
      }
    }
  };

  if (!meal) return null;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg shadow-secondary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Adjustments</h2>
            <p className="text-sm text-stone-500">Add discounts or extra charges</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn-ghost' : 'btn-secondary'}>
          {showForm ? 'Cancel' : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-5 bg-stone-50 rounded-2xl space-y-4">
          <div>
            <label className="label">Description</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Birthday discount" className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="input" required />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as AdjustmentType)} className="input">
                <option value="debit">Add to bill</option>
                <option value="credit">Subtract</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Apply to</label>
            <select value={scope} onChange={(e) => { setScope(e.target.value as AdjustmentScope); if (e.target.value === 'meal') setPersonId(''); }} className="input">
              <option value="meal">Everyone (split)</option>
              <option value="person">One person</option>
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
                <option value="proportional">By spending</option>
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
        <div className="text-center py-12 px-4 rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <p className="text-stone-600 font-medium mb-1">No adjustments</p>
          <p className="text-sm text-stone-400">Add discounts or custom charges here</p>
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
                  {isCredit ? '-' : '+'}${Math.abs(adj.amount).toFixed(2)}
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
  );
}
