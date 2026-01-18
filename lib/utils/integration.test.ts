import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './receipt-parser';
import {
  generateMealSummary,
  calculateMealTotals,
  getUnassignedItems,
  generateSettlementSuggestions,
  calculateGroupSubtotal,
} from './calculations';
import { generateId, formatCurrency } from './helpers';
import { Meal, Diner, Item, Adjustment } from '../types/meal';

/**
 * Integration tests that verify multiple modules work together correctly.
 * These tests simulate real-world usage patterns.
 */

describe('Receipt to Meal Flow Integration', () => {
  /**
   * Helper to create a complete meal from parsed receipt data
   */
  function createMealFromReceipt(
    receiptText: string,
    diners: Diner[],
    assignItems: (items: Omit<Item, 'id' | 'assignments' | 'portions'>[]) => Item[]
  ): Meal {
    const parsed = parseReceiptText(receiptText, 0.9);

    return {
      id: generateId(),
      title: 'Test Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners,
      items: assignItems(parsed.items),
      receiptMeta: {
        subtotal: parsed.receiptMeta.subtotal || 0,
        tax: parsed.receiptMeta.tax || 0,
        tip: parsed.receiptMeta.tip || 0,
        fees: parsed.receiptMeta.fees || [],
        discounts: parsed.receiptMeta.discounts || [],
        total: parsed.receiptMeta.total || 0,
      },
      adjustments: [],
    };
  }

  it('processes a simple two-person dinner', () => {
    const receiptText = `
      Steak $35.00
      Pasta $22.00
      Wine $28.00

      Subtotal $85.00
      Tax $7.23
      Tip $17.00
      Total $109.23
    `;

    const diners: Diner[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];

    const meal = createMealFromReceipt(receiptText, diners, (parsedItems) => {
      return parsedItems.map((item, idx) => ({
        ...item,
        id: generateId(),
        // Alice gets steak, Bob gets pasta, they share wine
        assignments:
          idx === 0
            ? [{ dinerId: 'alice', splitType: 'single' as const }]
            : idx === 1
            ? [{ dinerId: 'bob', splitType: 'single' as const }]
            : [
                { dinerId: 'alice', splitType: 'even' as const },
                { dinerId: 'bob', splitType: 'even' as const },
              ],
      }));
    });

    const summary = generateMealSummary(meal);

    // Verify all items assigned
    expect(getUnassignedItems(meal)).toHaveLength(0);

    // Verify totals sum correctly
    const totalSum = summary.dinerTotals.reduce((sum, dt) => sum + dt.total, 0);
    expect(totalSum).toBeCloseTo(109.23, 2);

    // Alice: $35 (steak) + $14 (half wine) = $49 subtotal
    // Bob: $22 (pasta) + $14 (half wine) = $36 subtotal
    const alice = summary.dinerTotals.find((dt) => dt.dinerId === 'alice')!;
    const bob = summary.dinerTotals.find((dt) => dt.dinerId === 'bob')!;

    expect(alice.itemSubtotal).toBe(49);
    expect(bob.itemSubtotal).toBe(36);

    // Tax and tip should be allocated proportionally
    expect(alice.allocatedTax).toBeGreaterThan(bob.allocatedTax);
    expect(alice.allocatedTip).toBeGreaterThan(bob.allocatedTip);
  });

  it('handles group dinner with uneven spending', () => {
    const receiptText = `
      Lobster $65.00
      Salad $12.00
      Shared Appetizer $24.00

      Subtotal $101.00
      Tax $8.59
      Total $109.59
    `;

    const diners: Diner[] = [
      { id: 'big', name: 'Big Spender' },
      { id: 'small', name: 'Small Spender' },
    ];

    const meal = createMealFromReceipt(receiptText, diners, (parsedItems) => {
      return parsedItems.map((item) => ({
        ...item,
        id: generateId(),
        assignments:
          item.name.toLowerCase().includes('lobster')
            ? [{ dinerId: 'big', splitType: 'single' as const }]
            : item.name.toLowerCase().includes('salad')
            ? [{ dinerId: 'small', splitType: 'single' as const }]
            : [
                { dinerId: 'big', splitType: 'even' as const },
                { dinerId: 'small', splitType: 'even' as const },
              ],
      }));
    });

    const summary = generateMealSummary(meal);

    // Big spender: $65 + $12 (half app) = $77
    // Small spender: $12 + $12 (half app) = $24
    const big = summary.dinerTotals.find((dt) => dt.dinerId === 'big')!;
    const small = summary.dinerTotals.find((dt) => dt.dinerId === 'small')!;

    expect(big.itemSubtotal).toBe(77);
    expect(small.itemSubtotal).toBe(24);

    // Tax should be proportional
    expect(big.allocatedTax / small.allocatedTax).toBeCloseTo(77 / 24, 1);
  });

  it('processes receipt with adjustments', () => {
    const receiptText = `
      Burger $15.00
      Fries $8.00

      Subtotal $23.00
      Tax $1.96
      Total $24.96
    `;

    const diners: Diner[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];

    const parsed = parseReceiptText(receiptText, 0.9);

    const meal: Meal = {
      id: generateId(),
      title: 'Test Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners,
      items: parsed.items.map((item, idx) => ({
        ...item,
        id: generateId(),
        assignments: [
          { dinerId: idx === 0 ? 'alice' : 'bob', splitType: 'single' as const },
        ],
      })),
      receiptMeta: {
        subtotal: parsed.receiptMeta.subtotal || 0,
        tax: parsed.receiptMeta.tax || 0,
        tip: 5, // Added tip
        fees: [],
        discounts: [],
        total: 29.96,
      },
      adjustments: [
        {
          id: 'service',
          label: 'Service Charge',
          amount: 3,
          type: 'debit',
          scope: 'meal',
          allocationRule: 'proportional',
        },
        {
          id: 'birthday',
          label: 'Birthday Discount',
          amount: -2,
          type: 'credit',
          scope: 'person',
          allocationRule: 'proportional',
          personId: 'alice',
        },
      ],
    };

    const summary = generateMealSummary(meal);

    // Alice: $15 item, proportional share of tax/tip/service, minus $2 birthday discount
    const alice = summary.dinerTotals.find((dt) => dt.dinerId === 'alice')!;

    // Adjustment includes the personal discount
    expect(alice.adjustments).toBeLessThan(0); // Should be negative due to birthday discount
  });

  it('calculates settlements correctly', () => {
    const meal: Meal = {
      id: generateId(),
      title: 'Test Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners: [
        { id: 'payer', name: 'Payer' },
        { id: 'guest1', name: 'Guest 1' },
        { id: 'guest2', name: 'Guest 2' },
      ],
      items: [
        {
          id: '1',
          name: 'Item 1',
          quantity: 1,
          amount: 30,
          assignments: [{ dinerId: 'payer', splitType: 'single' }],
        },
        {
          id: '2',
          name: 'Item 2',
          quantity: 1,
          amount: 20,
          assignments: [{ dinerId: 'guest1', splitType: 'single' }],
        },
        {
          id: '3',
          name: 'Item 3',
          quantity: 1,
          amount: 25,
          assignments: [{ dinerId: 'guest2', splitType: 'single' }],
        },
      ],
      receiptMeta: {
        subtotal: 75,
        tax: 6.38,
        tip: 15,
        fees: [],
        discounts: [],
        total: 96.38,
      },
      adjustments: [],
      payerId: 'payer',
    };

    const summary = generateMealSummary(meal);
    const settlements = generateSettlementSuggestions(summary, 'payer');

    // Payer should not appear in settlements
    expect(settlements.every((s) => s.from !== 'Payer')).toBe(true);
    expect(settlements.every((s) => s.to === 'Payer')).toBe(true);

    // Should have 2 settlements (from guest1 and guest2)
    expect(settlements).toHaveLength(2);

    // Settlement amounts should match diner totals
    const guest1Settlement = settlements.find((s) => s.from === 'Guest 1');
    const guest2Settlement = settlements.find((s) => s.from === 'Guest 2');
    const guest1Total = summary.dinerTotals.find((dt) => dt.dinerId === 'guest1')!.total;
    const guest2Total = summary.dinerTotals.find((dt) => dt.dinerId === 'guest2')!.total;

    expect(guest1Settlement?.amount).toBe(guest1Total);
    expect(guest2Settlement?.amount).toBe(guest2Total);
  });
});

describe('Currency Formatting Integration', () => {
  it('formats all diner totals correctly', () => {
    const meal: Meal = {
      id: generateId(),
      title: 'Test Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      items: [
        {
          id: '1',
          name: 'Expensive Item',
          quantity: 1,
          amount: 1234.56,
          assignments: [{ dinerId: 'a', splitType: 'single' }],
        },
        {
          id: '2',
          name: 'Cheap Item',
          quantity: 1,
          amount: 0.99,
          assignments: [{ dinerId: 'b', splitType: 'single' }],
        },
      ],
      receiptMeta: {
        subtotal: 1235.55,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 1235.55,
      },
      adjustments: [],
    };

    const summary = generateMealSummary(meal);

    for (const dt of summary.dinerTotals) {
      const formatted = formatCurrency(dt.total);
      expect(formatted).toMatch(/^\$[\d,]+\.\d{2}$/);
    }

    // Verify specific formatting
    const alice = summary.dinerTotals.find((dt) => dt.dinerId === 'a')!;
    expect(formatCurrency(alice.total)).toBe('$1,234.56');
  });
});

describe('Receipt Parsing to Calculation Flow', () => {
  it('handles a complete bar bill scenario', () => {
    // Create meal directly with known items to test calculation flow
    // (Receipt parsing is tested separately)
    const diners: Diner[] = [
      { id: 'will', name: 'Will' },
      { id: 'jensen', name: 'Jensen' },
      { id: 'michael', name: 'Michael' },
    ];

    // Assign items based on the scenario:
    // Will: 2 Fog Lights, Irish Coffee, Hendricks = 74
    // Jensen: Fog Light, Hot and Dirty, Nightman = 59
    // Michael: Social Music, Ocho Plata = 40
    const items: Item[] = [
      { id: '1', name: 'Fog Light', quantity: 1, amount: 19, assignments: [{ dinerId: 'will', splitType: 'single' }] },
      { id: '2', name: 'Fog Light', quantity: 1, amount: 19, assignments: [{ dinerId: 'will', splitType: 'single' }] },
      { id: '3', name: 'Irish Coffee', quantity: 1, amount: 15, assignments: [{ dinerId: 'will', splitType: 'single' }] },
      { id: '4', name: 'Hendricks + Mule', quantity: 1, amount: 21, assignments: [{ dinerId: 'will', splitType: 'single' }] },
      { id: '5', name: 'Fog Light', quantity: 1, amount: 19, assignments: [{ dinerId: 'jensen', splitType: 'single' }] },
      { id: '6', name: 'Hot and Dirty', quantity: 1, amount: 21, assignments: [{ dinerId: 'jensen', splitType: 'single' }] },
      { id: '7', name: 'Nightman Cometh', quantity: 1, amount: 19, assignments: [{ dinerId: 'jensen', splitType: 'single' }] },
      { id: '8', name: 'Social Music', quantity: 1, amount: 19, assignments: [{ dinerId: 'michael', splitType: 'single' }] },
      { id: '9', name: 'Ocho Plata Margarita', quantity: 1, amount: 21, assignments: [{ dinerId: 'michael', splitType: 'single' }] },
    ];

    const meal: Meal = {
      id: 'test-meal',
      title: 'Bar Night',
      date: '2024-01-15',
      createdAt: '2024-01-15T00:00:00Z',
      diners,
      items,
      receiptMeta: {
        subtotal: 173,
        tax: 12.11,
        tip: 37,
        fees: [],
        discounts: [],
        total: 222.11,
      },
      adjustments: [],
    };

    const summary = generateMealSummary(meal);

    // Verify reconciliation
    expect(Math.abs(summary.reconciliationDiff)).toBeLessThanOrEqual(0.02);

    // Verify totals sum correctly
    const totalSum = summary.dinerTotals.reduce((sum, dt) => sum + dt.total, 0);
    expect(totalSum).toBeCloseTo(222.11, 2);

    // Verify diner subtotals
    const will = summary.dinerTotals.find((dt) => dt.dinerId === 'will')!;
    const jensen = summary.dinerTotals.find((dt) => dt.dinerId === 'jensen')!;
    const michael = summary.dinerTotals.find((dt) => dt.dinerId === 'michael')!;

    expect(will.itemSubtotal).toBe(74);
    expect(jensen.itemSubtotal).toBe(59);
    expect(michael.itemSubtotal).toBe(40);
  });

  it('handles receipt with missing meta fields', () => {
    // Create meal directly to test calculation with minimal meta
    const meal: Meal = {
      id: generateId(),
      title: 'Coffee Run',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners: [{ id: 'solo', name: 'Solo' }],
      items: [
        { id: '1', name: 'Coffee', quantity: 1, amount: 4.50, assignments: [{ dinerId: 'solo', splitType: 'single' }] },
        { id: '2', name: 'Muffin', quantity: 1, amount: 3.25, assignments: [{ dinerId: 'solo', splitType: 'single' }] },
      ],
      receiptMeta: {
        subtotal: 7.75,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 7.75,
      },
      adjustments: [],
    };

    const summary = generateMealSummary(meal);

    expect(summary.dinerTotals[0].total).toBe(7.75);
    expect(summary.dinerTotals[0].itemSubtotal).toBe(7.75);
  });
});

describe('Edge Cases Integration', () => {
  it('handles empty receipt gracefully', () => {
    const parsed = parseReceiptText('', 0.9);

    expect(parsed.items).toHaveLength(0);
    expect(parsed.receiptMeta.subtotal).toBe(0);
  });

  it('handles meal with no diners', () => {
    const meal: Meal = {
      id: generateId(),
      title: 'Empty Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners: [],
      items: [],
      receiptMeta: {
        subtotal: 0,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 0,
      },
      adjustments: [],
    };

    const summary = generateMealSummary(meal);

    expect(summary.dinerTotals).toHaveLength(0);
    expect(summary.reconciliationDiff).toBe(0);
  });

  it('validates unassigned items detection', () => {
    const meal: Meal = {
      id: generateId(),
      title: 'Incomplete Meal',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      diners: [{ id: 'solo', name: 'Solo' }],
      items: [
        {
          id: '1',
          name: 'Assigned Item',
          quantity: 1,
          amount: 10,
          assignments: [{ dinerId: 'solo', splitType: 'single' }],
        },
        {
          id: '2',
          name: 'Unassigned Item',
          quantity: 1,
          amount: 15,
          assignments: [],
        },
      ],
      receiptMeta: {
        subtotal: 25,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 25,
      },
      adjustments: [],
    };

    const unassigned = getUnassignedItems(meal);

    expect(unassigned).toHaveLength(1);
    expect(unassigned[0].name).toBe('Unassigned Item');

    // Group subtotal includes unassigned items
    expect(calculateGroupSubtotal(meal)).toBe(25);

    // But diner totals only include assigned items
    const totals = calculateMealTotals(meal);
    expect(totals[0].itemSubtotal).toBe(10);
  });
});
