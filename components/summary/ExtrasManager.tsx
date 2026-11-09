'use client';

import { useEffect, useId, useRef, useState } from 'react';
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

  const tipPercents = [15, 18, 20, 22];
  const currentTipPct = itemsSubtotal > 0 ? (meal.receiptMeta.tip / itemsSubtotal) * 100 : 0;

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">Tax &amp; tip</h2>
      <p className="text-sm text-ink-muted mt-0.5 mb-4">
        Copy these from the receipt. They&apos;re shared in proportion to what each person ordered.
      </p>

      <div className="divide-y divide-rule border-y border-rule">
        <div className="flex items-baseline justify-between py-3">
          <span className="text-ink">Items <span className="text-ink-muted text-sm">({meal.items.length})</span></span>
          <span className="money text-[17px] text-ink">{formatCurrency(itemsSubtotal)}</span>
        </div>

        <MoneyRow
          id="tax"
          label="Tax"
          value={meal.receiptMeta.tax}
          onChange={(v) => updateReceiptMeta({ tax: v })}
        />

        <div className="py-3">
          <MoneyRow
            id="tip"
            label="Tip"
            value={meal.receiptMeta.tip}
            onChange={(v) => updateReceiptMeta({ tip: v })}
            bare
          />
          {itemsSubtotal > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Tip as a percentage of items">
              {tipPercents.map((pct) => {
                const active = Math.abs(currentTipPct - pct) < 0.05;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => updateReceiptMeta({ tip: Math.round(itemsSubtotal * pct) / 100 })}
                    aria-pressed={active}
                    className={`px-3 py-1 rounded-full text-sm font-medium border-[1.5px] transition-colors ${
                      active ? 'bg-ink text-paper border-ink' : 'border-rule text-ink hover:border-stone-400'
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
              {meal.receiptMeta.tip > 0 && !tipPercents.some((p) => Math.abs(currentTipPct - p) < 0.05) && (
                <span className="text-sm text-ink-muted self-center pl-1">{currentTipPct.toFixed(1)}% of items</span>
              )}
              <TipInfo subtotal={itemsSubtotal} tax={meal.receiptMeta.tax} tip={meal.receiptMeta.tip} />
            </div>
          )}
        </div>

        {meal.adjustments.map((adj) => {
          const diner = adj.personId ? meal.diners.find((d) => d.id === adj.personId) : null;
          const isCredit = adj.amount < 0;
          return (
            <div key={adj.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-ink">{adj.label}</p>
                <p className="text-sm text-ink-muted">
                  {adj.scope === 'person' && diner ? `${diner.name} only` : adj.allocationRule === 'proportional' ? 'Split by what people ordered' : 'Split equally'}
                </p>
              </div>
              <span className={`money text-[17px] ${isCredit ? 'text-primary-500' : 'text-ink'}`}>
                {isCredit ? '−' : '+'}{formatCurrency(Math.abs(adj.amount))}
              </span>
              <button
                onClick={() => removeAdjustment(adj.id)}
                aria-label={`Remove ${adj.label}`}
                className="p-2 -mr-2 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {showAdjustmentForm ? (
        <form onSubmit={handleAdjustmentSubmit} className="mt-4 p-4 bg-paper-shade rounded-xl space-y-3">
          <div>
            <label className="label" htmlFor="adj-label">What is it?</label>
            <input id="adj-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Service fee, birthday discount…" className="input" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="adj-amount">Amount</label>
              <input id="adj-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="adj-type">Type</label>
              <select id="adj-type" value={type} onChange={(e) => setType(e.target.value as AdjustmentType)} className="input">
                <option value="debit">Adds to bill</option>
                <option value="credit">Takes off bill</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="adj-scope">Who pays it?</label>
            <select id="adj-scope" value={scope} onChange={(e) => { setScope(e.target.value as AdjustmentScope); if (e.target.value === 'meal') setPersonId(''); }} className="input">
              <option value="meal">Everyone</option>
              <option value="person">One person</option>
            </select>
          </div>
          {scope === 'person' && meal.diners.length > 0 && (
            <div>
              <label className="label" htmlFor="adj-person">Person</label>
              <select id="adj-person" value={personId} onChange={(e) => setPersonId(e.target.value)} className="input" required>
                <option value="">Choose…</option>
                {meal.diners.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {scope === 'meal' && (
            <div>
              <label className="label" htmlFor="adj-rule">How to split it</label>
              <select id="adj-rule" value={allocationRule} onChange={(e) => setAllocationRule(e.target.value as AllocationRule)} className="input">
                <option value="proportional">By what each person ordered</option>
                <option value="explicit">Equally</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowAdjustmentForm(false)} className="btn-ghost text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-primary text-sm py-2 px-4">Add charge</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdjustmentForm(true)}
          className="mt-3 text-sm font-medium text-ink-muted hover:text-ink underline underline-offset-2 decoration-rule-dashed"
        >
          Add a fee or discount
        </button>
      )}

      <hr className="rule-dashed mt-5 mb-3" />
      <div className="flex justify-between items-baseline">
        <span className="font-semibold text-ink">Total</span>
        <span className="money text-2xl font-semibold text-ink">{formatCurrency(calculatedTotal)}</span>
      </div>
    </div>
  );
}

/**
 * A receipt line with an editable amount. Keeps the raw text while typing so
 * the field can be cleared and retyped; commits a number on every change.
 */
function MoneyRow({ id, label, value, onChange, bare }: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  bare?: boolean;
}) {
  const [text, setText] = useState(value ? value.toFixed(2) : '');
  const [lastValue, setLastValue] = useState(value);
  // Sync when the value changes from outside (e.g. a tip % button).
  if (value !== lastValue) {
    setLastValue(value);
    if (Math.abs((parseFloat(text) || 0) - value) > 0.001) setText(value ? value.toFixed(2) : '');
  }
  return (
    <div className={`flex items-center justify-between gap-4 ${bare ? '' : 'py-3'}`}>
      <label htmlFor={`extras-${id}`} className="text-ink">{label}</label>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">$</span>
        <input
          id={`extras-${id}`}
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0.00"
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
            setText(cleaned);
            const n = parseFloat(cleaned);
            const next = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
            setLastValue(next);
            onChange(next);
          }}
          onBlur={() => setText(value ? value.toFixed(2) : '')}
          className="input input-prefixed money text-right py-2"
        />
      </div>
    </div>
  );
}

/**
 * Explains that the % buttons are on the pre-tax amount. Some restaurants
 * suggest tips on the post-tax total, which makes "20%" on the receipt a
 * bigger number. Opens on tap (not hover) so it works on phones.
 */
function TipInfo({ subtotal, tax, tip }: { subtotal: number; tax: number; tip: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const showNumbers = tip > 0 && tax > 0 && subtotal > 0;
  const before = (tip / subtotal) * 100;
  const after = (tip / (subtotal + tax)) * 100;

  return (
    <div ref={ref} className="relative self-center ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="How tip percentages are worked out"
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink hover:bg-paper-shade'
        }`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 11v5" />
          <circle cx="12" cy="7.75" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="note"
          className="absolute right-0 bottom-full mb-2.5 w-72 max-w-[calc(100vw-2.5rem)] z-20 rounded-lg bg-ink text-paper text-sm leading-snug p-3.5 shadow-lg"
        >
          <p>
            Some restaurants work out the tip <span className="font-semibold">after tax</span>, which quietly makes it bigger.
          </p>
          <p className="mt-2 text-paper/80">
            These buttons use the total <span className="font-semibold text-paper">before tax</span>, so a 20% tip here can look a little different from the 20% printed on your receipt.
          </p>
          {showNumbers && (
            <p className="mt-2.5 pt-2.5 border-t border-white/15 text-paper/80">
              Your tip is <span className="money text-paper">{before.toFixed(1)}%</span> before tax, or{' '}
              <span className="money text-paper">{after.toFixed(1)}%</span> after tax.
            </p>
          )}
          {/* the little triangle, pointing at the ⓘ button */}
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-2 w-3 h-3 rotate-45 bg-ink"
          />
        </div>
      )}
    </div>
  );
}
