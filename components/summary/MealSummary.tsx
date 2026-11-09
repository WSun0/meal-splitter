'use client';

import { useMeal } from '@/lib/store/meal-store';
import { generateMealSummary, calculateComputedTotal, getUnassignedItems, calculateTotalAdjustments } from '@/lib/utils/calculations';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import PersonAvatar from '@/components/ui/PersonAvatar';

export default function MealSummary() {
  const { meal, updateMealInfo } = useMeal();

  if (!meal || meal.diners.length === 0 || meal.items.length === 0) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">The bill</h2>
        <p className="text-ink-muted mt-2">Add people and items to see who owes what.</p>
      </div>
    );
  }

  const summary = generateMealSummary(meal);
  const computedTotal = calculateComputedTotal(meal);
  const unassignedItems = getUnassignedItems(meal);
  const totalAdjustments = calculateTotalAdjustments(meal);
  const itemsSubtotal = meal.items.reduce((sum, item) => sum + item.amount, 0);
  const sharesSum = summary.dinerTotals.reduce((sum, dt) => sum + dt.total, 0);
  const payerIndex = meal.payerId ? meal.diners.findIndex((d) => d.id === meal.payerId) : -1;
  const payer = payerIndex >= 0 ? meal.diners[payerIndex] : undefined;
  const indexOf = new Map(meal.diners.map((d, i) => [d.id, i]));

  // Payer last; everyone else by amount owed, largest first.
  const rows = [...summary.dinerTotals].sort((a, b) => {
    if (a.dinerId === meal.payerId) return 1;
    if (b.dinerId === meal.payerId) return -1;
    return b.total - a.total;
  });

  return (
    <div className="paper slip-torn px-5 sm:px-6 pt-5 sm:pt-6">
      {/* Title: always an input, so renaming before sharing is obvious */}
      <label htmlFor="meal-title" className="sr-only">Meal name</label>
      <div className="flex items-center gap-2 group">
        <input
          id="meal-title"
          type="text"
          value={meal.title}
          maxLength={200}
          onChange={(e) => updateMealInfo({ title: e.target.value })}
          onFocus={(e) => { if (meal.title === 'New Meal') e.target.select(); }}
          onBlur={(e) => { if (!e.target.value.trim()) updateMealInfo({ title: 'New Meal' }); }}
          className="flex-1 min-w-0 font-serif text-[1.75rem] leading-tight font-medium tracking-tight text-ink bg-transparent border-b-[1.5px] border-dashed border-transparent hover:border-rule-dashed focus:border-ink focus:outline-none py-0.5"
          placeholder="Name this meal"
        />
        <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
      <p className="text-sm text-ink-muted mt-1">
        {meal.restaurant && `${meal.restaurant} · `}{formatDate(meal.date)} · {meal.diners.length} {meal.diners.length === 1 ? 'person' : 'people'}
      </p>

      {unassignedItems.length > 0 && (
        <p className="mt-4 text-sm rounded-lg bg-[#fdf3f0] text-[#9a3a24] px-3 py-2">
          {unassignedItems.length === 1
            ? `“${unassignedItems[0].name}” isn’t assigned to anyone, so no one is paying for it yet.`
            : `${unassignedItems.length} items aren’t assigned to anyone, so no one is paying for them yet.`}
        </p>
      )}

      <hr className="rule-dashed mt-4" />
      <div className="flex items-baseline justify-between py-3">
        <span className="text-ink-muted">Total</span>
        <span className="money text-[1.75rem] font-semibold text-ink">{formatCurrency(computedTotal)}</span>
      </div>
      <hr className="rule-dashed" />

      {/* Who paid */}
      {meal.diners.length > 1 && (
        <div className="mt-4">
          <p id="payer-label" className="text-sm font-semibold text-ink-muted mb-2">Who paid?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="payer-label">
            {meal.diners.map((d, i) => {
              const on = d.id === meal.payerId;
              return (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => updateMealInfo({ payerId: on ? null : d.id })}
                  className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-[1.5px] text-sm font-medium transition-colors ${
                    on ? 'bg-ink text-paper border-ink' : 'border-rule text-ink hover:border-stone-400'
                  }`}
                >
                  <PersonAvatar name={d.name} index={i} size="sm" />
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Who owes what */}
      <p className="text-sm text-ink-muted mt-5 mb-1">
        {payer ? <><span className="font-semibold text-ink">{payer.name}</span> paid. Here&apos;s who owes them:</> : 'What each person owes:'}
      </p>
      <ul>
        {rows.map((dt) => {
          const isPayer = dt.dinerId === meal.payerId;
          return (
            <li key={dt.dinerId} className={`py-2.5 border-b border-rule last:border-b-0 ${isPayer ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-3">
                <PersonAvatar name={dt.dinerName} index={indexOf.get(dt.dinerId) ?? 0} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">
                    {dt.dinerName}
                    {isPayer && <span className="badge badge-secondary ml-2 align-middle">paid</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    <span className="money">{formatCurrency(dt.itemSubtotal)}</span> items + <span className="money">{formatCurrency(dt.allocatedTax)}</span> tax + <span className="money">{formatCurrency(dt.allocatedTip)}</span> tip
                    {Math.abs(dt.adjustments + dt.allocatedFees + dt.allocatedDiscounts) > 0.001 && (
                      <> {dt.adjustments + dt.allocatedFees + dt.allocatedDiscounts < 0 ? '−' : '+'} <span className="money">{formatCurrency(Math.abs(dt.adjustments + dt.allocatedFees + dt.allocatedDiscounts))}</span> other</>
                    )}
                  </p>
                </div>
                <span className="money text-lg font-medium text-ink">{formatCurrency(dt.total)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Bill lines */}
      <dl className="mt-4 pt-3 border-t border-rule text-sm space-y-1">
        <div className="flex justify-between"><dt className="text-ink-muted">Items</dt><dd className="money text-ink">{formatCurrency(itemsSubtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Tax</dt><dd className="money text-ink">{formatCurrency(meal.receiptMeta.tax)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Tip</dt><dd className="money text-ink">{formatCurrency(meal.receiptMeta.tip)}</dd></div>
        {totalAdjustments !== 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Fees &amp; discounts</dt>
            <dd className="money text-ink">{totalAdjustments < 0 ? '−' : '+'}{formatCurrency(Math.abs(totalAdjustments))}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-ink-muted mt-3">
        {Math.abs(sharesSum - computedTotal) < 0.01
          ? 'Everyone’s shares add up exactly to the total.'
          : `Shares differ from the total by ${formatCurrency(Math.abs(sharesSum - computedTotal))} because of rounding.`}
      </p>
    </div>
  );
}
