'use client';

import type { SavedDraft } from '@/lib/store/meal-store';

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

export default function Landing({ onStart, draft, onResume, onDiscard }: LandingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 overflow-auto relative">
      {/* Soft gradient orbs in background */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary-200/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-2xl w-full relative z-10 stagger-children">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 mb-6 shadow-lg shadow-primary-500/25 animate-float">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-stone-800 mb-4 tracking-tight">
            Will's Meal Splitting Tool
          </h1>
          <p className="text-xl text-stone-500 max-w-md mx-auto leading-relaxed">
            Seamlessly split a bill without doing any awkward math!
          </p>
        </div>

        {/* Resume a recent meal, if there is one */}
        {draft && (
          <div className="card p-5 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Pick up where you left off</p>
              <p className="font-semibold text-stone-800 truncate">{draft.meal.title || 'Untitled meal'}</p>
              <p className="text-sm text-stone-500">
                {draft.meal.items.length} {draft.meal.items.length === 1 ? 'item' : 'items'} ·{' '}
                {draft.meal.diners.length} {draft.meal.diners.length === 1 ? 'person' : 'people'} · {timeAgo(draft.savedAt)}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={onDiscard} className="btn-ghost text-sm py-2 px-4">Discard</button>
              <button onClick={onResume} className="btn-secondary text-sm py-2 px-4">Resume</button>
            </div>
          </div>
        )}

        <button onClick={onStart} className="card-elevated w-full p-6 mb-10 text-left group flex items-center gap-5">
          <div className="flex items-center justify-center w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 group-hover:from-primary-400 group-hover:to-primary-600 transition-all duration-300">
            <svg className="w-7 h-7 text-primary-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-stone-800 mb-1">Start a new split</h2>
            <p className="text-stone-500 text-sm leading-relaxed">Type in the items and prices from the receipt</p>
          </div>
          <svg className="w-5 h-5 text-primary-600 shrink-0 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* How it works */}
        <div className="card p-6">
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-5 text-center">
            How it works
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { num: '1', title: 'Add items', desc: 'From the receipt' },
              { num: '2', title: 'Assign', desc: 'Who ate what' },
              { num: '3', title: 'Split', desc: 'Fair totals' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary-500/20">
                  {step.num}
                </div>
                <p className="font-semibold text-stone-800 text-sm">{step.title}</p>
                <p className="text-xs text-stone-400 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
