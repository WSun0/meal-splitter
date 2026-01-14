import { describe, it, expect } from 'vitest';
import {
  calculateItemShareForDiner,
  calculateDinerSubtotal,
  calculateMealTotals,
  reconcileRounding,
  generateMealSummary,
  calculateComputedTotal,
  calculateTotalAdjustments,
  calculateDinerAdjustments,
} from './calculations';
import { Meal, Item, Diner, DinerTotal } from '../types/meal';

// Helper to create a basic meal structure
function createMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'test-meal',
    title: 'Test Meal',
    date: '2024-01-01',
    createdAt: '2024-01-01T00:00:00Z',
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
    ...overrides,
  };
}

// Helper to create a diner
function createDiner(id: string, name: string): Diner {
  return { id, name };
}

// Helper to create an item with single assignment
function createItemWithSingleAssignment(
  id: string,
  name: string,
  amount: number,
  dinerId: string
): Item {
  return {
    id,
    name,
    quantity: 1,
    amount,
    assignments: [{ dinerId, splitType: 'single' }],
  };
}

// Helper to create an item with even split
function createItemWithEvenSplit(
  id: string,
  name: string,
  amount: number,
  dinerIds: string[]
): Item {
  return {
    id,
    name,
    quantity: 1,
    amount,
    assignments: dinerIds.map((dinerId) => ({ dinerId, splitType: 'even' as const })),
  };
}

describe('calculateItemShareForDiner', () => {
  it('returns full amount for single assignment', () => {
    const item = createItemWithSingleAssignment('item1', 'Drink', 19, 'diner1');
    expect(calculateItemShareForDiner(item, 'diner1')).toBe(19);
  });

  it('returns 0 for diner not in assignment', () => {
    const item = createItemWithSingleAssignment('item1', 'Drink', 19, 'diner1');
    expect(calculateItemShareForDiner(item, 'diner2')).toBe(0);
  });

  it('splits evenly among assigned diners', () => {
    const item = createItemWithEvenSplit('item1', 'Appetizer', 30, ['diner1', 'diner2', 'diner3']);
    expect(calculateItemShareForDiner(item, 'diner1')).toBe(10);
    expect(calculateItemShareForDiner(item, 'diner2')).toBe(10);
    expect(calculateItemShareForDiner(item, 'diner3')).toBe(10);
  });

  it('handles shares split correctly', () => {
    const item: Item = {
      id: 'item1',
      name: 'Shared Dish',
      quantity: 1,
      amount: 100,
      assignments: [
        { dinerId: 'diner1', splitType: 'shares', value: 2 },
        { dinerId: 'diner2', splitType: 'shares', value: 1 },
      ],
    };
    // diner1 gets 2/3 = 66.67, diner2 gets 1/3 = 33.33
    expect(calculateItemShareForDiner(item, 'diner1')).toBeCloseTo(66.67, 2);
    expect(calculateItemShareForDiner(item, 'diner2')).toBeCloseTo(33.33, 2);
  });

  it('handles percentage split correctly', () => {
    const item: Item = {
      id: 'item1',
      name: 'Shared Dish',
      quantity: 1,
      amount: 100,
      assignments: [
        { dinerId: 'diner1', splitType: 'percentage', value: 70 },
        { dinerId: 'diner2', splitType: 'percentage', value: 30 },
      ],
    };
    expect(calculateItemShareForDiner(item, 'diner1')).toBe(70);
    expect(calculateItemShareForDiner(item, 'diner2')).toBe(30);
  });
});

describe('calculateDinerSubtotal', () => {
  it('sums up all item shares for a diner', () => {
    const items: Item[] = [
      createItemWithSingleAssignment('item1', 'Drink 1', 19, 'diner1'),
      createItemWithSingleAssignment('item2', 'Drink 2', 15, 'diner1'),
      createItemWithSingleAssignment('item3', 'Drink 3', 21, 'diner2'),
    ];

    expect(calculateDinerSubtotal(items, 'diner1')).toBe(34);
    expect(calculateDinerSubtotal(items, 'diner2')).toBe(21);
  });

  it('returns 0 for diner with no items', () => {
    const items: Item[] = [
      createItemWithSingleAssignment('item1', 'Drink 1', 19, 'diner1'),
    ];
    expect(calculateDinerSubtotal(items, 'diner2')).toBe(0);
  });
});

describe('calculateComputedTotal', () => {
  it('correctly sums items + tax + tip + fees - discounts', () => {
    const meal = createMeal({
      items: [
        createItemWithSingleAssignment('item1', 'Item 1', 50, 'diner1'),
        createItemWithSingleAssignment('item2', 'Item 2', 30, 'diner2'),
      ],
      receiptMeta: {
        subtotal: 80,
        tax: 12.11,
        tip: 37,
        fees: [5],
        discounts: [-10],
        total: 124.11, // This would be ignored
      },
    });

    // 50 + 30 + 12.11 + 37 + 5 - 10 = 124.11
    expect(calculateComputedTotal(meal)).toBeCloseTo(124.11, 2);
  });

  it('works with no fees or discounts', () => {
    const meal = createMeal({
      items: [
        createItemWithSingleAssignment('item1', 'Item 1', 173, 'diner1'),
      ],
      receiptMeta: {
        subtotal: 173,
        tax: 12.11,
        tip: 37,
        fees: [],
        discounts: [],
        total: 222.11,
      },
    });

    expect(calculateComputedTotal(meal)).toBeCloseTo(222.11, 2);
  });
});

describe('User example: Will, Jensen, Michael bar bill', () => {
  /*
   * From user:
   * Will: 2 Fog Lights, Irish Coffee, Hendricks (+Passion Fruit mule) = 38 + 15 + 21 = 74
   * Jensen: Fog Light, Hot and Dirty, Nightman Cometh = 19 + 21 + 19 = 59
   * Michael: Social Music, Ocho Plata Margarita = 19 + 21 = 40
   * 
   * Subtotal: 74 + 59 + 40 = 173
   * Tax: 12.11
   * Tip: 37
   * Total: 173 + 49.11 = 222.11
   * 
   * Will: (74 / 173) * 222.11 = 95.00659
   * Jensen: (59 / 173) * 222.11 = 75.748
   * Michael: (40 / 173) * 222.11 = 51.355
   * 
   * Rounded: 95.01 + 75.75 + 51.35 = 222.11
   */
  const will = createDiner('will', 'Will');
  const jensen = createDiner('jensen', 'Jensen');
  const michael = createDiner('michael', 'Michael');

  const items: Item[] = [
    // Will's items
    createItemWithSingleAssignment('fog1', 'Fog Light', 19, 'will'),
    createItemWithSingleAssignment('fog2', 'Fog Light', 19, 'will'),
    createItemWithSingleAssignment('irish', 'Irish Coffee', 15, 'will'),
    createItemWithSingleAssignment('hendricks', 'Hendricks + Passion Fruit Mule', 21, 'will'),
    // Jensen's items
    createItemWithSingleAssignment('fog3', 'Fog Light', 19, 'jensen'),
    createItemWithSingleAssignment('hotdirty', 'Hot and Dirty', 21, 'jensen'),
    createItemWithSingleAssignment('nightman', 'Nightman Cometh', 19, 'jensen'),
    // Michael's items
    createItemWithSingleAssignment('social', 'Social Music', 19, 'michael'),
    createItemWithSingleAssignment('ocho', 'Ocho Plata Margarita', 21, 'michael'),
  ];

  const meal = createMeal({
    diners: [will, jensen, michael],
    items,
    receiptMeta: {
      subtotal: 173,
      tax: 12.11,
      tip: 37,
      fees: [],
      discounts: [],
      total: 222.11,
    },
  });

  it('calculates correct subtotals per diner', () => {
    expect(calculateDinerSubtotal(items, 'will')).toBe(74);
    expect(calculateDinerSubtotal(items, 'jensen')).toBe(59);
    expect(calculateDinerSubtotal(items, 'michael')).toBe(40);
  });

  it('calculates computed total correctly', () => {
    expect(calculateComputedTotal(meal)).toBeCloseTo(222.11, 2);
  });

  it('calculates proportional totals correctly', () => {
    const dinerTotals = calculateMealTotals(meal);
    
    const willTotal = dinerTotals.find((dt) => dt.dinerId === 'will');
    const jensenTotal = dinerTotals.find((dt) => dt.dinerId === 'jensen');
    const michaelTotal = dinerTotals.find((dt) => dt.dinerId === 'michael');

    // Will: (74 / 173) * 222.11 = 95.00659...
    expect(willTotal?.total).toBeCloseTo(95.01, 1);
    // Jensen: (59 / 173) * 222.11 = 75.748...
    expect(jensenTotal?.total).toBeCloseTo(75.75, 1);
    // Michael: (40 / 173) * 222.11 = 51.355...
    expect(michaelTotal?.total).toBeCloseTo(51.36, 1);
  });

  it('generates meal summary that sums to correct total', () => {
    const summary = generateMealSummary(meal);
    
    const sumOfTotals = summary.dinerTotals.reduce((sum, dt) => sum + dt.total, 0);
    
    // The sum should be very close to 222.11
    expect(sumOfTotals).toBeCloseTo(222.11, 2);
    
    // Reconciliation diff should be negligible (within a cent or two)
    expect(Math.abs(summary.reconciliationDiff)).toBeLessThanOrEqual(0.02);
  });

  it('reconciles rounding to exactly match the target', () => {
    const dinerTotals = calculateMealTotals(meal);
    const targetTotal = 222.11;
    
    const reconciled = reconcileRounding(dinerTotals, targetTotal);
    const reconciledSum = reconciled.reduce((sum, dt) => sum + dt.total, 0);
    
    // After reconciliation, should sum exactly to target
    expect(Math.round(reconciledSum * 100) / 100).toBe(targetTotal);
  });
});

describe('reconcileRounding', () => {
  it('adjusts totals to match target when sum is slightly off', () => {
    const dinerTotals: DinerTotal[] = [
      {
        dinerId: 'diner1',
        dinerName: 'Diner 1',
        itemSubtotal: 50,
        allocatedTax: 5,
        allocatedTip: 10,
        allocatedFees: 0,
        allocatedDiscounts: 0,
        adjustments: 0,
        total: 65.333333, // Will round to 65.33
      },
      {
        dinerId: 'diner2',
        dinerName: 'Diner 2',
        itemSubtotal: 50,
        allocatedTax: 5,
        allocatedTip: 10,
        allocatedFees: 0,
        allocatedDiscounts: 0,
        adjustments: 0,
        total: 65.336667, // Will round to 65.34
      },
    ];

    const targetTotal = 130.67; // Exact target

    const reconciled = reconcileRounding(dinerTotals, targetTotal);
    const sum = reconciled.reduce((s, dt) => s + dt.total, 0);

    expect(Math.round(sum * 100) / 100).toBe(targetTotal);
  });

  it('returns unchanged totals when no adjustment needed', () => {
    const dinerTotals: DinerTotal[] = [
      {
        dinerId: 'diner1',
        dinerName: 'Diner 1',
        itemSubtotal: 50,
        allocatedTax: 5,
        allocatedTip: 10,
        allocatedFees: 0,
        allocatedDiscounts: 0,
        adjustments: 0,
        total: 65.00,
      },
      {
        dinerId: 'diner2',
        dinerName: 'Diner 2',
        itemSubtotal: 50,
        allocatedTax: 5,
        allocatedTip: 10,
        allocatedFees: 0,
        allocatedDiscounts: 0,
        adjustments: 0,
        total: 65.00,
      },
    ];

    const targetTotal = 130.00;

    const reconciled = reconcileRounding(dinerTotals, targetTotal);
    expect(reconciled[0].total).toBe(65.00);
    expect(reconciled[1].total).toBe(65.00);
  });
});

describe('Edge cases', () => {
  it('handles empty meal (no items)', () => {
    const meal = createMeal({
      diners: [createDiner('diner1', 'Diner 1')],
      items: [],
      receiptMeta: {
        subtotal: 0,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 0,
      },
    });

    const summary = generateMealSummary(meal);
    expect(summary.dinerTotals[0].total).toBe(0);
  });

  it('handles single diner with full bill', () => {
    const meal = createMeal({
      diners: [createDiner('solo', 'Solo Diner')],
      items: [
        createItemWithSingleAssignment('item1', 'Entree', 25, 'solo'),
        createItemWithSingleAssignment('item2', 'Drink', 8, 'solo'),
      ],
      receiptMeta: {
        subtotal: 33,
        tax: 2.80,
        tip: 6.60,
        fees: [],
        discounts: [],
        total: 42.40,
      },
    });

    const summary = generateMealSummary(meal);
    expect(summary.dinerTotals[0].total).toBeCloseTo(42.40, 2);
  });

  it('handles diner with no items assigned', () => {
    const meal = createMeal({
      diners: [
        createDiner('diner1', 'Diner 1'),
        createDiner('diner2', 'Diner 2'), // No items
      ],
      items: [
        createItemWithSingleAssignment('item1', 'Item', 100, 'diner1'),
      ],
      receiptMeta: {
        subtotal: 100,
        tax: 10,
        tip: 20,
        fees: [],
        discounts: [],
        total: 130,
      },
    });

    const summary = generateMealSummary(meal);
    const diner2Total = summary.dinerTotals.find((dt) => dt.dinerId === 'diner2');
    
    // Diner 2 should owe nothing since they have no items
    expect(diner2Total?.total).toBe(0);
  });

  it('handles shared appetizer split evenly', () => {
    const meal = createMeal({
      diners: [
        createDiner('a', 'Alice'),
        createDiner('b', 'Bob'),
        createDiner('c', 'Carol'),
      ],
      items: [
        createItemWithEvenSplit('app', 'Shared Appetizer', 24, ['a', 'b', 'c']),
        createItemWithSingleAssignment('entree1', 'Entree', 18, 'a'),
        createItemWithSingleAssignment('entree2', 'Entree', 22, 'b'),
        createItemWithSingleAssignment('entree3', 'Entree', 20, 'c'),
      ],
      receiptMeta: {
        subtotal: 84, // 24 + 18 + 22 + 20
        tax: 7.14,
        tip: 16.80,
        fees: [],
        discounts: [],
        total: 107.94,
      },
    });

    // Alice: 8 (app share) + 18 = 26
    // Bob: 8 (app share) + 22 = 30
    // Carol: 8 (app share) + 20 = 28
    const summary = generateMealSummary(meal);
    
    const aliceTotal = summary.dinerTotals.find((dt) => dt.dinerId === 'a');
    const bobTotal = summary.dinerTotals.find((dt) => dt.dinerId === 'b');
    const carolTotal = summary.dinerTotals.find((dt) => dt.dinerId === 'c');

    // Check subtotals
    expect(aliceTotal?.itemSubtotal).toBe(26);
    expect(bobTotal?.itemSubtotal).toBe(30);
    expect(carolTotal?.itemSubtotal).toBe(28);

    // Total should sum correctly
    const totalSum = summary.dinerTotals.reduce((sum, dt) => sum + dt.total, 0);
    expect(totalSum).toBeCloseTo(107.94, 2);
  });
});

describe('Adjustments', () => {
  it('calculates proportional meal-level adjustment correctly', () => {
    const meal = createMeal({
      diners: [
        createDiner('a', 'Alice'),
        createDiner('b', 'Bob'),
      ],
      items: [
        createItemWithSingleAssignment('item1', 'Item', 60, 'a'),
        createItemWithSingleAssignment('item2', 'Item', 40, 'b'),
      ],
      receiptMeta: {
        subtotal: 100,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 100,
      },
      adjustments: [
        {
          id: 'adj1',
          label: 'Service Charge',
          amount: 10,
          type: 'debit',
          scope: 'meal',
          allocationRule: 'proportional',
        },
      ],
    });

    // Alice has 60% of subtotal, Bob has 40%
    // Alice should get 6 of the adjustment, Bob should get 4
    const aliceAdj = calculateDinerAdjustments(meal.adjustments, 'a', 60, 100);
    const bobAdj = calculateDinerAdjustments(meal.adjustments, 'b', 40, 100);

    expect(aliceAdj).toBe(6);
    expect(bobAdj).toBe(4);
  });

  it('calculates person-specific adjustment correctly', () => {
    const meal = createMeal({
      adjustments: [
        {
          id: 'adj1',
          label: 'Birthday discount',
          amount: -5,
          type: 'credit',
          scope: 'person',
          allocationRule: 'proportional',
          personId: 'alice',
        },
      ],
    });

    const aliceAdj = calculateDinerAdjustments(meal.adjustments, 'alice', 50, 100);
    const bobAdj = calculateDinerAdjustments(meal.adjustments, 'bob', 50, 100);

    expect(aliceAdj).toBe(-5);
    expect(bobAdj).toBe(0);
  });

  it('includes adjustments in final total calculation', () => {
    const meal = createMeal({
      diners: [createDiner('solo', 'Solo')],
      items: [createItemWithSingleAssignment('item1', 'Food', 50, 'solo')],
      receiptMeta: {
        subtotal: 50,
        tax: 5,
        tip: 10,
        fees: [],
        discounts: [],
        total: 65,
      },
      adjustments: [
        {
          id: 'adj1',
          label: 'Extra charge',
          amount: 5,
          type: 'debit',
          scope: 'meal',
          allocationRule: 'proportional',
        },
      ],
    });

    const summary = generateMealSummary(meal);
    
    // Items (50) + Tax (5) + Tip (10) + Adjustment (5) = 70
    expect(summary.dinerTotals[0].total).toBeCloseTo(70, 2);
  });
});

describe('Proportional allocation of tax and tip', () => {
  it('allocates tax and tip proportionally to item subtotals', () => {
    const meal = createMeal({
      diners: [
        createDiner('big', 'Big Spender'),
        createDiner('small', 'Small Spender'),
      ],
      items: [
        createItemWithSingleAssignment('expensive', 'Lobster', 80, 'big'),
        createItemWithSingleAssignment('cheap', 'Salad', 20, 'small'),
      ],
      receiptMeta: {
        subtotal: 100,
        tax: 10,
        tip: 20,
        fees: [],
        discounts: [],
        total: 130,
      },
    });

    const totals = calculateMealTotals(meal);
    const bigSpender = totals.find((t) => t.dinerId === 'big')!;
    const smallSpender = totals.find((t) => t.dinerId === 'small')!;

    // Big spender: 80% of everything
    expect(bigSpender.allocatedTax).toBe(8);
    expect(bigSpender.allocatedTip).toBe(16);
    expect(bigSpender.total).toBe(104); // 80 + 8 + 16

    // Small spender: 20% of everything
    expect(smallSpender.allocatedTax).toBe(2);
    expect(smallSpender.allocatedTip).toBe(4);
    expect(smallSpender.total).toBe(26); // 20 + 2 + 4
  });
});

describe('Rounding precision', () => {
  it('handles floating point precision issues', () => {
    // Classic floating point issue: 0.1 + 0.2 !== 0.3
    const meal = createMeal({
      diners: [
        createDiner('a', 'A'),
        createDiner('b', 'B'),
        createDiner('c', 'C'),
      ],
      items: [
        createItemWithSingleAssignment('i1', 'Item', 33.33, 'a'),
        createItemWithSingleAssignment('i2', 'Item', 33.33, 'b'),
        createItemWithSingleAssignment('i3', 'Item', 33.34, 'c'),
      ],
      receiptMeta: {
        subtotal: 100,
        tax: 8.25,
        tip: 20,
        fees: [],
        discounts: [],
        total: 128.25,
      },
    });

    const summary = generateMealSummary(meal);
    const sum = summary.dinerTotals.reduce((s, dt) => s + dt.total, 0);

    // Should reconcile to exactly 128.25
    expect(Math.abs(sum - 128.25)).toBeLessThanOrEqual(0.01);
  });

  it('keeps rounding errors to a few cents at most', () => {
    const meal = createMeal({
      diners: [
        createDiner('a', 'A'),
        createDiner('b', 'B'),
        createDiner('c', 'C'),
        createDiner('d', 'D'),
        createDiner('e', 'E'),
      ],
      items: [
        createItemWithSingleAssignment('i1', 'Item', 17.99, 'a'),
        createItemWithSingleAssignment('i2', 'Item', 23.47, 'b'),
        createItemWithSingleAssignment('i3', 'Item', 31.23, 'c'),
        createItemWithSingleAssignment('i4', 'Item', 14.89, 'd'),
        createItemWithSingleAssignment('i5', 'Item', 28.42, 'e'),
      ],
      receiptMeta: {
        subtotal: 116,
        tax: 9.86,
        tip: 23.20,
        fees: [],
        discounts: [],
        total: 149.06,
      },
    });

    const summary = generateMealSummary(meal);
    
    // Reconciliation diff should be very small (a few cents max)
    expect(Math.abs(summary.reconciliationDiff)).toBeLessThanOrEqual(0.05);
  });
});

describe('Fees and discounts', () => {
  it('includes fees in total calculation', () => {
    const meal = createMeal({
      diners: [createDiner('solo', 'Solo')],
      items: [createItemWithSingleAssignment('item1', 'Food', 50, 'solo')],
      receiptMeta: {
        subtotal: 50,
        tax: 5,
        tip: 10,
        fees: [3, 2], // Service fee + delivery fee
        discounts: [],
        total: 70,
      },
    });

    expect(calculateComputedTotal(meal)).toBe(70);
  });

  it('includes discounts (negative amounts) in total calculation', () => {
    const meal = createMeal({
      diners: [createDiner('solo', 'Solo')],
      items: [createItemWithSingleAssignment('item1', 'Food', 50, 'solo')],
      receiptMeta: {
        subtotal: 50,
        tax: 5,
        tip: 10,
        fees: [],
        discounts: [-10], // $10 discount (stored as negative)
        total: 55,
      },
    });

    expect(calculateComputedTotal(meal)).toBe(55);
  });
});
