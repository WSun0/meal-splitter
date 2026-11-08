import { describe, it, expect } from 'vitest';
import { Meal } from '../types/meal';
import {
  buildSharedSplit,
  toWire,
  fromWire,
  encodeFragment,
  decodeFragment,
  decodeLegacyShareData,
  getSettlements,
} from './share';
import { formatDate } from './helpers';

function makeMeal(): Meal {
  return {
    id: 'm1',
    title: 'Friday Ramen',
    date: '2026-11-08',
    createdAt: '2026-11-08T01:00:00.000Z',
    diners: [
      { id: 'a', name: 'Will' },
      { id: 'b', name: 'Liam' },
      { id: 'c', name: 'Alex' },
    ],
    items: [
      { id: 'i1', name: 'Tonkotsu', quantity: 1, amount: 18, assignments: [{ dinerId: 'a', splitType: 'single' }] },
      { id: 'i2', name: 'Shoyu', quantity: 1, amount: 16, assignments: [{ dinerId: 'b', splitType: 'single' }] },
      { id: 'i3', name: 'Miso', quantity: 1, amount: 17, assignments: [{ dinerId: 'c', splitType: 'single' }] },
      {
        id: 'i4', name: 'Gyoza', quantity: 1, amount: 10,
        assignments: [
          { dinerId: 'a', splitType: 'even' },
          { dinerId: 'b', splitType: 'even' },
          { dinerId: 'c', splitType: 'even' },
        ],
      },
    ],
    // receipt total intentionally 0 (manual entry) to cover the $0.00 bug
    receiptMeta: { subtotal: 61, tax: 4.5, tip: 12, fees: [], discounts: [], total: 0 },
    adjustments: [],
  };
}

describe('buildSharedSplit', () => {
  it('uses the computed bill total, not the parsed receipt total', () => {
    const split = buildSharedSplit(makeMeal(), 'b');
    expect(split.total).toBe(7750); // 61 + 4.50 + 12
    expect(split.diners.reduce((s, d) => s + d.total, 0)).toBe(split.total);
  });

  it('splits shared items into cents that sum to the item price', () => {
    const split = buildSharedSplit(makeMeal());
    const gyoza = split.items.find((i) => i.name === 'Gyoza')!;
    expect(gyoza.shares).toHaveLength(3);
    expect(gyoza.shares.reduce((s, x) => s + x.amount, 0)).toBe(1000);
    expect(gyoza.shares.map((s) => s.amount).sort()).toEqual([333, 333, 334]);
  });

  it('derives settlements from the payer', () => {
    const split = buildSharedSplit(makeMeal(), 'b');
    const s = getSettlements(split);
    expect(s.map((x) => x.from)).toEqual(['Will', 'Alex']);
    expect(s.every((x) => x.to === 'Liam')).toBe(true);
  });
});

describe('wire + fragment encoding', () => {
  it('round-trips through the wire format', () => {
    const split = buildSharedSplit(makeMeal(), 'b');
    expect(fromWire(JSON.parse(JSON.stringify(toWire(split))))).toEqual(split);
  });

  it('round-trips through the compressed fragment', async () => {
    const split = buildSharedSplit(makeMeal(), 'b');
    const encoded = await encodeFragment(split);
    expect(encoded.startsWith('z')).toBe(true);
    expect(await decodeFragment(encoded)).toEqual(split);
  });

  it('rejects malformed payloads', async () => {
    expect(fromWire([2, 'x'])).toBeNull();
    const wire = toWire(buildSharedSplit(makeMeal()));
    wire[7][0][2] = [99, 100]; // share pointing at a diner that doesn't exist
    expect(fromWire(wire)).toBeNull();
    expect(await decodeFragment('zzzz')).toBeNull();
  });
});

describe('legacy v1 links', () => {
  it('decodes old ?data= links and fixes the total', () => {
    const v1 = {
      title: 'New Meal',
      date: '2026-11-08',
      dinerTotals: [
        { name: 'Will', itemSubtotal: 51.95, tax: 5.07, tip: 10.26, fees: 0, total: 67.28 },
        { name: 'Liam', itemSubtotal: 44.95, tax: 4.38, tip: 8.88, fees: 0, total: 58.21 },
      ],
      receiptTotal: 0,
      payerName: 'Liam',
    };
    const encoded = Buffer.from(JSON.stringify(v1)).toString('base64url');
    const split = decodeLegacyShareData(encoded)!;
    expect(split.total).toBe(12549);
    expect(split.payer).toBe(1);
    expect(split.items).toEqual([]);
  });
});

describe('formatDate', () => {
  it('treats YYYY-MM-DD as a local calendar date', () => {
    expect(formatDate('2026-11-08')).toBe('November 8, 2026');
  });
});
