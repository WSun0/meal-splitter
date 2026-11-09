'use client';

import { useId, useState } from 'react';
import { formatCurrency } from '@/lib/utils/helpers';

export type PriceMode = 'each' | 'total';

export interface ItemFormValues {
  name: string;
  quantity: number;
  amount: number; // line total (quantity × unit price), which is what Item.amount stores
}

interface ItemFormProps {
  initial?: ItemFormValues;
  defaultPriceMode?: PriceMode;
  submitLabel: string;
  onSubmit: (values: ItemFormValues, priceMode: PriceMode) => void;
  onCancel: () => void;
  hideCancel?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Inputs are text fields holding the raw string, so a field can be empty
// while you're typing (backspace the 1, type a 2). Parsing and validation
// happen on blur and on submit, not on every keystroke.
const cleanQty = (s: string) => s.replace(/\D/g, '').slice(0, 3);
const cleanPrice = (s: string) => {
  const stripped = s.replace(/[^\d.]/g, '');
  const [whole, ...rest] = stripped.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

function initialPrice(initial: ItemFormValues | undefined, mode: PriceMode): { text: string; mode: PriceMode } {
  if (!initial) return { text: '', mode };
  if (initial.quantity > 1) {
    const each = initial.amount / initial.quantity;
    // Show "each" only if it divides evenly to the cent; otherwise keep the exact total.
    if (Math.abs(round2(each) * initial.quantity - initial.amount) < 0.005) {
      return { text: round2(each).toFixed(2), mode: 'each' };
    }
    return { text: initial.amount.toFixed(2), mode: 'total' };
  }
  return { text: initial.amount.toFixed(2), mode };
}

export default function ItemForm({ initial, defaultPriceMode = 'each', submitLabel, onSubmit, onCancel, hideCancel }: ItemFormProps) {
  const start = initialPrice(initial, defaultPriceMode);
  const [name, setName] = useState(initial?.name ?? '');
  const [qtyText, setQtyText] = useState(String(initial?.quantity ?? 1));
  // Last valid quantity, so the Each/Total toggle doesn't vanish while the box is empty mid-edit.
  const [lastQty, setLastQty] = useState(initial?.quantity ?? 1);
  const [priceText, setPriceText] = useState(start.text);
  const [priceMode, setPriceMode] = useState<PriceMode>(start.mode);
  const id = useId();
  const [touched, setTouched] = useState({ name: false, qty: false, price: false });

  const qty = Number.parseInt(qtyText, 10);
  const price = Number.parseFloat(priceText);
  const qtyValid = Number.isInteger(qty) && qty >= 1;
  const priceValid = Number.isFinite(price) && price > 0;
  const nameValid = name.trim().length > 0;
  const multi = (qtyValid ? qty : lastQty) > 1;

  const errors = {
    name: touched.name && !nameValid ? 'Give the item a name' : null,
    qty: touched.qty && !qtyValid ? 'Enter a quantity (1 or more)' : null,
    price: touched.price && !priceValid ? 'Enter a price' : null,
  };

  const lineTotal = qtyValid && priceValid ? (qty > 1 && priceMode === 'each' ? round2(price * qty) : round2(price)) : null;
  const unitPrice = lineTotal !== null && qtyValid ? lineTotal / qty : null;

  const submit = () => {
    setTouched({ name: true, qty: true, price: true });
    if (!nameValid || !qtyValid || !priceValid || lineTotal === null) return;
    onSubmit({ name: name.trim(), quantity: qty, amount: lineTotal }, priceMode);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };


  return (
    <div className="space-y-3" onKeyDown={onKeyDown}>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 sm:col-span-6">
          <label className="block text-xs font-medium text-ink-muted mb-1" htmlFor={`${id}-name`}>Item</label>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            className="input"
            placeholder="e.g. Spicy miso ramen"
            aria-invalid={!!errors.name}
            autoFocus
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div className="col-span-4 sm:col-span-2">
          <label className="block text-xs font-medium text-ink-muted mb-1" htmlFor={`${id}-qty`}>Qty</label>
          <input
            id={`${id}-qty`}
            type="text"
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => {
              const text = cleanQty(e.target.value);
              setQtyText(text);
              const n = Number.parseInt(text, 10);
              if (Number.isInteger(n) && n >= 1) setLastQty(n);
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => setTouched((t) => ({ ...t, qty: true }))}
            className="input text-center"
            aria-invalid={!!errors.qty}
          />
        </div>

        <div className="col-span-8 sm:col-span-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-stone-500" htmlFor={`${id}-price`}>
              {multi ? (priceMode === 'each' ? 'Price each' : 'Total price') : 'Price'}
            </label>
            {multi && (
              <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs" role="group" aria-label="Price is per item or for all">
                {(['each', 'total'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPriceMode(m)}
                    aria-pressed={priceMode === m}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      priceMode === m ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {m === 'each' ? 'Each' : 'Total'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">$</span>
            <input
              id={`${id}-price`}
              type="text"
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(cleanPrice(e.target.value))}
              onFocus={(e) => e.target.select()}
              onBlur={() => setTouched((t) => ({ ...t, price: true }))}
              className="input input-prefixed"
              placeholder="0.00"
              aria-invalid={!!errors.price}
            />
          </div>
        </div>
      </div>

      {(errors.qty || errors.price) && (
        <p className="text-xs text-red-600 -mt-1 sm:text-right">{[errors.qty, errors.price].filter(Boolean).join(' · ')}</p>
      )}

      {multi && qtyValid && lineTotal !== null && unitPrice !== null && (
        <p className="text-sm text-ink-muted sm:text-right">
          {qty} × <span className="money">{formatCurrency(unitPrice)}</span> ={' '}
          <span className="money font-semibold text-ink">{formatCurrency(lineTotal)}</span>
        </p>
      )}

      <div className="flex justify-end gap-2">
        {!hideCancel && <button type="button" onClick={onCancel} className="btn-ghost text-sm py-2 px-4">Cancel</button>}
        <button type="button" onClick={submit} className="btn-primary text-sm py-2 px-4">{submitLabel}</button>
      </div>
    </div>
  );
}
