'use client';

import type { SavedDraft } from '@/lib/store/meal-store';
import { personColor } from '@/lib/utils/person-color';

interface LandingProps {
  onStart: () => void;
  draft: SavedDraft | null;
  onResume: () => void;
  onDiscard: () => void;
}

function timeAgo(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
}

// Sample bill. Diner order is Theo, Maya, Nora, Kenji, Sam, so colors follow it.
const SAMPLE_TITLE = 'Friday Dinner';
const SAMPLE_TOTAL = '$286.40';
const SAMPLE_PAYER = 'Theo';
const SAMPLE = [
  { name: 'Maya', amount: '$64.20', index: 1 },
  { name: 'Nora', amount: '$58.75', index: 2 },
  { name: 'Kenji', amount: '$55.10', index: 3 },
  { name: 'Sam', amount: '$49.35', index: 4 },
];

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-folder-text ${className}`}>
      will<span className="text-secondary-400">split</span>
    </span>
  );
}

export default function Landing({ onStart, draft, onResume, onDiscard }: LandingProps) {
  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="max-w-md mx-auto">
        <Wordmark className="text-lg" />

        <h1 className="font-serif text-[2.75rem] leading-[1.02] font-medium tracking-tight text-folder-text mt-10 mb-4">
          Split the check without the math.
        </h1>
        <p className="text-folder-muted text-lg leading-snug mb-8 max-w-sm">
          Type in the receipt, tap who had what. Tax and tip are shared fairly, and everyone gets a link with what they owe.
        </p>

        {/* What you end up with: a slip like the one friends receive */}
        <div className="paper slip-torn animate-slip px-5 pt-5 mb-8" aria-hidden>
          <div className="flex items-baseline justify-between">
            <p className="font-serif text-xl font-medium">{SAMPLE_TITLE}</p>
            <p className="money text-lg font-semibold">{SAMPLE_TOTAL}</p>
          </div>
          <hr className="rule-dashed my-3" />
          <p className="text-sm text-ink-muted mb-1"><span className="font-semibold text-ink">{SAMPLE_PAYER}</span> paid. Settle up:</p>
          <ul>
            {SAMPLE.map((row) => (
              <li key={row.name} className="flex items-center justify-between py-1.5 text-[15px]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: personColor(row.index) }} />
                  {row.name}
                </span>
                <span className="money">{row.amount}</span>
              </li>
            ))}
          </ul>
        </div>

        {draft && (
          <div className="rounded-xl border border-folder-line p-4 mb-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-folder-text truncate">{draft.meal.title || 'Untitled meal'}</p>
              <p className="text-sm text-folder-muted">
                {draft.meal.items.length} {draft.meal.items.length === 1 ? 'item' : 'items'},{' '}
                {draft.meal.diners.length} {draft.meal.diners.length === 1 ? 'person' : 'people'} · {timeAgo(draft.savedAt)}
              </p>
            </div>
            <button onClick={onDiscard} className="btn-folder">Discard</button>
            <button onClick={onResume} className="btn-folder !bg-folder-text !text-folder-deep !border-folder-text font-semibold">Resume</button>
          </div>
        )}

        <button onClick={onStart} className="btn-cta w-full py-4 text-base">
          Start a new split
        </button>

        <p className="text-center text-sm text-folder-muted mt-10">© William Sun 2026</p>
      </div>
    </div>
  );
}
