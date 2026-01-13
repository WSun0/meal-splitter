'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { decodeShareData, ShareableData } from '@/lib/utils/share';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';

function SharedSplitContent() {
  const searchParams = useSearchParams();
  const encodedData = searchParams.get('data');

  if (!encodedData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary mb-2">Invalid Link</h1>
          <p className="text-text-secondary mb-6">This share link appears to be invalid or expired.</p>
          <a href="/" className="btn-primary inline-flex">
            Create New Split
          </a>
        </div>
      </div>
    );
  }

  const data = decodeShareData(encodedData);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary mb-2">Could Not Load Split</h1>
          <p className="text-text-secondary mb-6">The share data could not be decoded. Please ask for a new link.</p>
          <a href="/" className="btn-primary inline-flex">
            Create New Split
          </a>
        </div>
      </div>
    );
  }

  return <SharedSplitView data={data} />;
}

function SharedSplitView({ data }: { data: ShareableData }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-text-primary">Will's Meal Splitting Tool</h1>
              <p className="text-sm text-text-muted">Shared bill breakdown</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Meal Info */}
        <div className="card p-6 mb-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl font-semibold text-text-primary mb-1">
              {data.title}
            </h2>
            {data.restaurant && (
              <p className="text-text-secondary mb-1">{data.restaurant}</p>
            )}
            <p className="text-sm text-text-muted">{formatDate(data.date)}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-text-muted text-sm">Total Bill</p>
            <p className="font-serif text-3xl font-semibold text-primary">
              {formatCurrency(data.receiptTotal)}
            </p>
          </div>
        </div>

        {/* Per-person breakdown */}
        <div className="card p-6 mb-6">
          <h3 className="font-serif text-lg font-semibold text-text-primary mb-4">
            Who Owes What
          </h3>
          <div className="space-y-3">
            {data.dinerTotals.map((diner, index) => (
              <div
                key={index}
                className="p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-light text-primary font-semibold text-lg flex items-center justify-center">
                      {diner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">{diner.name}</h4>
                      {data.payerName === diner.name && (
                        <span className="badge badge-secondary text-xs">Paid the bill</span>
                      )}
                    </div>
                  </div>
                  <p className="font-serif text-2xl font-semibold text-primary">
                    {formatCurrency(diner.total)}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-surface p-2 rounded-lg border border-border">
                    <p className="text-text-muted">Items</p>
                    <p className="font-medium text-text-primary">{formatCurrency(diner.itemSubtotal)}</p>
                  </div>
                  <div className="bg-surface p-2 rounded-lg border border-border">
                    <p className="text-text-muted">Tax</p>
                    <p className="font-medium text-text-primary">{formatCurrency(diner.tax)}</p>
                  </div>
                  <div className="bg-surface p-2 rounded-lg border border-border">
                    <p className="text-text-muted">Tip</p>
                    <p className="font-medium text-text-primary">{formatCurrency(diner.tip)}</p>
                  </div>
                  {diner.fees !== 0 && (
                    <div className="bg-surface p-2 rounded-lg border border-border">
                      <p className="text-text-muted">Other</p>
                      <p className="font-medium text-text-primary">{formatCurrency(diner.fees)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settlement instructions */}
        {data.settlements && data.settlements.length > 0 && data.payerName && (
          <div className="card p-6 mb-6">
            <h3 className="font-serif text-lg font-semibold text-text-primary mb-4">
              Settlement
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              <span className="font-medium">{data.payerName}</span> paid the bill. Here's who owes them:
            </p>
            <div className="space-y-2">
              {data.settlements.map((settlement, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-secondary-light/50 rounded-xl border border-secondary/20"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-light text-primary text-sm font-medium flex items-center justify-center">
                      {settlement.from.charAt(0)}
                    </div>
                    <span className="text-text-primary font-medium">{settlement.from}</span>
                    <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="w-8 h-8 rounded-full bg-secondary-light text-secondary text-sm font-medium flex items-center justify-center">
                      {settlement.to.charAt(0)}
                    </div>
                    <span className="text-text-primary font-medium">{settlement.to}</span>
                  </div>
                  <span className="font-serif text-xl font-semibold text-primary">
                    {formatCurrency(settlement.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <p className="text-text-muted text-sm mb-4">Need to split your own bill?</p>
          <a href="/" className="btn-primary inline-flex">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your Own Split
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 bg-surface">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm text-text-muted">
          <p>© William Sun 2026</p>
        </div>
      </footer>
    </div>
  );
}

export default function SharedSplitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-border border-t-primary animate-spin mx-auto mb-4"></div>
          <p className="text-text-muted">Loading split...</p>
        </div>
      </div>
    }>
      <SharedSplitContent />
    </Suspense>
  );
}
