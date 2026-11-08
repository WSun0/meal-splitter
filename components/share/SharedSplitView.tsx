'use client';

import { useState } from 'react';
import { SharedSplit, SharedDiner, getSettlements, dinerItemLines } from '@/lib/utils/share';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';

const money = (cents: number) => formatCurrency(cents / 100);

function Initial({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg';
  return (
    <div className={`${dims} shrink-0 rounded-full bg-stone-100 text-stone-800 font-medium flex items-center justify-center`}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function Arrow() {
  return (
    <svg className="w-4 h-4 shrink-0 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function DinerBreakdown({ split, diner, index }: { split: SharedSplit; diner: SharedDiner; index: number }) {
  const lines = dinerItemLines(split, index);
  const isPayer = split.payer === index;

  return (
    <div className="p-4 sm:p-5 bg-white rounded-3xl border border-stone-700">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Initial name={diner.name} />
          <div className="min-w-0">
            <h4 className="font-medium text-stone-900 truncate">{diner.name}</h4>
            {isPayer && <span className="badge badge-secondary text-xs">Paid the bill</span>}
          </div>
        </div>
        <p className="font-serif text-2xl font-semibold text-stone-900">{money(diner.total)}</p>
      </div>

      {lines.length > 0 && (
        <ul className="divide-y divide-stone-200 border-t border-stone-200">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-stone-800 break-words">{line.name}</p>
                {line.detail && <p className="text-xs text-stone-500">{line.detail}</p>}
              </div>
              <p className="text-sm font-medium text-stone-900 tabular-nums whitespace-nowrap">{money(line.amount)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Receipt-style subtotal block: amounts share the item column */}
      <dl className="border-t border-stone-300 pt-2 space-y-1 text-sm">
        <SummaryRow label={lines.length > 0 ? 'Items subtotal' : 'Items'} value={diner.items} />
        <SummaryRow label="Tax" value={diner.tax} />
        <SummaryRow label="Tip" value={diner.tip} />
        {diner.other !== 0 && <SummaryRow label="Fees & adjustments" value={diner.other} />}
        <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-stone-200">
          <dt className="font-semibold text-stone-900">Total</dt>
          <dd className="font-semibold text-stone-900 tabular-nums">{money(diner.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-stone-700 tabular-nums">{money(value)}</dd>
    </div>
  );
}

export default function SharedSplitView({ split }: { split: SharedSplit }) {
  const [open, setOpen] = useState(false);
  const settlements = getSettlements(split);
  const payer = split.payer !== undefined ? split.diners[split.payer] : undefined;

  return (
    <SharedShell>
      {/* Meal info */}
      <div className="card p-6 mb-6">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-semibold text-stone-900 mb-1 break-words">{split.title}</h2>
          {split.restaurant && <p className="text-stone-600 mb-1">{split.restaurant}</p>}
          <p className="text-sm text-stone-600">{formatDate(split.date)}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-700 text-center">
          <p className="text-stone-600 text-sm">Total Bill</p>
          <p className="font-serif text-3xl font-semibold text-stone-900">{money(split.total)}</p>
        </div>
      </div>

      {/* Settlement first: the thing people actually need */}
      <div className="card p-6 mb-6">
        <h3 className="font-serif text-lg font-semibold text-stone-900 mb-2">
          {payer ? 'Settlement' : 'Who Owes What'}
        </h3>
        {payer && (
          <p className="text-stone-700 text-sm mb-4">
            <span className="font-medium">{payer.name}</span> paid the bill. Here&apos;s who owes them:
          </p>
        )}
        <div className="space-y-2 mt-4">
          {payer
            ? settlements.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-full border border-stone-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Initial name={s.from} size="sm" />
                    <span className="text-stone-900 font-medium truncate">{s.from}</span>
                    <Arrow />
                    <Initial name={s.to} size="sm" />
                    <span className="text-stone-900 font-medium truncate">{s.to}</span>
                  </div>
                  <span className="font-serif text-xl font-semibold text-stone-900 whitespace-nowrap">{money(s.amount)}</span>
                </div>
              ))
            : split.diners.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-full border border-stone-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Initial name={d.name} size="sm" />
                    <span className="text-stone-900 font-medium truncate">{d.name}</span>
                  </div>
                  <span className="font-serif text-xl font-semibold text-stone-900 whitespace-nowrap">{money(d.total)}</span>
                </div>
              ))}
        </div>
        {payer && (
          <p className="text-xs text-stone-500 mt-3">
            {payer.name}&apos;s own share: {money(payer.total)}
          </p>
        )}
      </div>

      {/* Expandable full breakdown */}
      <div className="card mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="full-breakdown"
          className="w-full flex items-center justify-between gap-3 p-6 text-left"
        >
          <div>
            <h3 className="font-serif text-lg font-semibold text-stone-900">Full Breakdown</h3>
            <p className="text-sm text-stone-600">
              {split.items.length > 0
                ? 'What everyone ordered, what was shared, and their tax & tip'
                : 'Items, tax and tip per person'}
            </p>
          </div>
          <svg
            className={`w-5 h-5 shrink-0 text-stone-700 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div id="full-breakdown" className="px-4 sm:px-6 pb-6 space-y-3">
            {split.diners.map((d, i) => (
              <DinerBreakdown key={i} split={split} diner={d} index={i} />
            ))}
            <p className="text-xs text-stone-500 pt-1">
              Tax and tip are split in proportion to what each person ordered.
            </p>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-stone-600 text-sm mb-4">Need to split your own bill?</p>
        <a href="/" className="btn-primary inline-flex">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Your Own Split
        </a>
      </div>
    </SharedShell>
  );
}

export function SharedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white/60 border-b border-stone-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="font-serif text-xl font-semibold text-stone-900">Will&apos;s Meal Splitting Tool</h1>
          <p className="text-sm text-stone-700">Shared bill breakdown</p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-stone-200 mt-12 py-6">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm text-stone-500">
          <p>© William Sun 2026</p>
        </div>
      </footer>
    </div>
  );
}

export function SharedSplitError({ title, message }: { title: string; message: string }) {
  return (
    <SharedShell>
      <div className="card p-8 max-w-md mx-auto text-center">
        <h2 className="font-serif text-2xl font-semibold text-stone-900 mb-2">{title}</h2>
        <p className="text-stone-600 mb-6">{message}</p>
        <a href="/" className="btn-primary inline-flex">Create New Split</a>
      </div>
    </SharedShell>
  );
}
