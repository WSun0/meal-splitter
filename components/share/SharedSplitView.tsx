'use client';

import { useState } from 'react';
import { SharedSplit, SharedDiner, dinerItemLines } from '@/lib/utils/share';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import PersonAvatar from '@/components/ui/PersonAvatar';
import { Wordmark } from '@/components/Landing';

const money = (cents: number) => formatCurrency(cents / 100);

function DinerBreakdown({ split, diner, index }: { split: SharedSplit; diner: SharedDiner; index: number }) {
  const lines = dinerItemLines(split, index);
  const isPayer = split.payer === index;

  return (
    <section className="py-4 border-b border-rule last:border-b-0" aria-label={diner.name}>
      <div className="flex items-center gap-3 mb-2">
        <PersonAvatar name={diner.name} index={index} />
        <h4 className="flex-1 min-w-0 font-semibold text-ink truncate">
          {diner.name}
          {isPayer && <span className="badge badge-secondary ml-2 align-middle">paid</span>}
        </h4>
        <p className="money text-lg font-semibold text-ink">{money(diner.total)}</p>
      </div>

      {lines.length > 0 && (
        <ul className="pl-12">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="text-[15px] text-ink break-words">{line.name}</p>
                {line.detail && <p className="text-xs text-ink-muted">{line.detail}</p>}
              </div>
              <p className="money text-[15px] text-ink whitespace-nowrap">{money(line.amount)}</p>
            </li>
          ))}
        </ul>
      )}

      <dl className="pl-12 mt-1 pt-2 border-t border-dashed border-rule-dashed text-sm space-y-0.5">
        <SummaryRow label="Items" value={diner.items} />
        <SummaryRow label="Tax" value={diner.tax} />
        <SummaryRow label="Tip" value={diner.tip} />
        {diner.other !== 0 && <SummaryRow label="Fees & discounts" value={diner.other} />}
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="money text-ink-muted">{money(value)}</dd>
    </div>
  );
}

export default function SharedSplitView({ split }: { split: SharedSplit }) {
  const [open, setOpen] = useState(false);
  const payer = split.payer !== undefined ? split.diners[split.payer] : undefined;

  // Who owes, largest first. Without a payer, everyone is listed.
  const owing = split.diners
    .map((d, index) => ({ d, index }))
    .filter(({ index, d }) => index !== split.payer && d.total > 0)
    .sort((a, b) => b.d.total - a.d.total);

  return (
    <SharedShell>
      <article className="paper slip-torn animate-slip px-5 sm:px-6 pt-5 sm:pt-6">
        <h1 className="font-serif text-[1.875rem] leading-tight font-medium tracking-tight text-ink break-words">{split.title}</h1>
        <p className="text-sm text-ink-muted mt-1">
          {split.restaurant && `${split.restaurant} · `}{formatDate(split.date)} · {split.diners.length}{' '}
          {split.diners.length === 1 ? 'person' : 'people'}
        </p>

        <hr className="rule-dashed mt-4" />
        <div className="flex items-baseline justify-between py-3">
          <span className="text-ink-muted">Total</span>
          <span className="money text-[1.75rem] font-semibold text-ink">{money(split.total)}</span>
        </div>
        <hr className="rule-dashed" />

        <p className="text-[15px] text-ink-muted mt-4 mb-1">
          {payer ? (
            <>
              <span className="font-semibold text-ink">{payer.name}</span> paid. Here&apos;s who owes them:
            </>
          ) : (
            'What each person owes:'
          )}
        </p>
        <ul>
          {owing.map(({ d, index }) => (
            <li key={index} className="flex items-center gap-3 py-2.5 border-b border-rule last:border-b-0">
              <PersonAvatar name={d.name} index={index} />
              <span className="flex-1 min-w-0 font-medium text-ink truncate">
                {d.name}
                {payer && <span className="text-ink-muted font-normal text-sm"> to {payer.name}</span>}
              </span>
              <span className="money text-lg font-medium text-ink">{money(d.total)}</span>
            </li>
          ))}
        </ul>
        {payer && (
          <p className="text-xs text-ink-muted mt-2">
            {payer.name}&apos;s own share was {money(payer.total)}.
          </p>
        )}
      </article>

      {/* Full breakdown: folds out of the folder */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="full-breakdown"
          className="w-full flex items-center justify-between gap-3 py-3 text-left border-t border-folder-line"
        >
          <span>
            <span className="block font-semibold text-folder-text">What everyone had</span>
            <span className="block text-sm text-folder-muted">
              {split.items.length > 0 ? 'Each item, who shared it, and tax & tip' : 'Items, tax and tip per person'}
            </span>
          </span>
          <svg
            className={`w-5 h-5 shrink-0 text-folder-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div id="full-breakdown" className="paper px-5 sm:px-6 py-1 mt-1">
            {split.diners.map((d, i) => (
              <DinerBreakdown key={i} split={split} diner={d} index={i} />
            ))}
            <p className="text-xs text-ink-muted pb-4">Tax and tip are split in proportion to what each person ordered.</p>
          </div>
        )}
      </div>

      <div className="text-center mt-10">
        <a href="/" className="btn-cta">Split your own bill</a>
      </div>
    </SharedShell>
  );
}

export function SharedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="max-w-md mx-auto px-4 pt-4 pb-5">
        <a href="/" aria-label="willsplit home"><Wordmark className="text-lg" /></a>
      </header>
      <main className="max-w-md mx-auto px-4">{children}</main>
      <footer className="py-10 text-center text-sm text-folder-muted">© William Sun 2026</footer>
    </div>
  );
}

export function SharedSplitError({ title, message }: { title: string; message: string }) {
  return (
    <SharedShell>
      <div className="paper p-6 text-center">
        <h1 className="font-serif text-2xl font-medium text-ink mb-2">{title}</h1>
        <p className="text-ink-muted mb-6">{message}</p>
        <a href="/" className="btn-primary">Start a new split</a>
      </div>
    </SharedShell>
  );
}
