import { describe, it, expect } from 'vitest';
import { parseSavedDraft } from './meal-store';

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-11-08T04:00:00Z');

const meal = (items = 1, diners = 1) => ({
  id: 'm',
  title: 'Dinner',
  date: '2026-11-07',
  createdAt: new Date(now - 2 * HOUR).toISOString(),
  diners: Array.from({ length: diners }, (_, i) => ({ id: `d${i}`, name: `D${i}` })),
  items: Array.from({ length: items }, (_, i) => ({ id: `i${i}`, name: 'x', quantity: 1, amount: 1, assignments: [] })),
  receiptMeta: { subtotal: 0, tax: 0, tip: 0, fees: [], discounts: [], total: 0 },
  adjustments: [],
});

describe('parseSavedDraft', () => {
  it('returns a recent draft', () => {
    const draft = parseSavedDraft(JSON.stringify({ meal: meal(), savedAt: now - HOUR }), now);
    expect(draft?.meal.title).toBe('Dinner');
  });

  it('drops drafts older than 24 hours', () => {
    expect(parseSavedDraft(JSON.stringify({ meal: meal(), savedAt: now - 25 * HOUR }), now)).toBeNull();
  });

  it('drops empty drafts', () => {
    expect(parseSavedDraft(JSON.stringify({ meal: meal(0, 0), savedAt: now }), now)).toBeNull();
  });

  it('reads the old bare-meal format using createdAt', () => {
    expect(parseSavedDraft(JSON.stringify(meal()), now)?.savedAt).toBe(now - 2 * HOUR);
  });

  it('ignores garbage', () => {
    expect(parseSavedDraft('not json', now)).toBeNull();
    expect(parseSavedDraft(null, now)).toBeNull();
    expect(parseSavedDraft('{"foo":1}', now)).toBeNull();
  });
});
