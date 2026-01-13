import { Meal, Item, Assignment, DinerTotal, MealSummary, Adjustment } from '../types/meal';

/**
 * Calculate how much of an item belongs to a specific diner
 */
export function calculateItemShareForDiner(
  item: Item,
  dinerId: string
): number {
  const assignment = item.assignments.find((a) => a.dinerId === dinerId);
  if (!assignment) return 0;

  const assignedDiners = item.assignments;

  switch (assignment.splitType) {
    case 'single':
      // 100% to this diner
      return item.amount;

    case 'even':
      // Split evenly among all assigned diners
      return item.amount / assignedDiners.length;

    case 'shares': {
      // Calculate based on shares
      const totalShares = assignedDiners.reduce(
        (sum, a) => sum + (a.value || 1),
        0
      );
      const thisShare = assignment.value || 1;
      return (item.amount * thisShare) / totalShares;
    }

    case 'percentage': {
      // Calculate based on percentage
      const percentage = assignment.value || 0;
      return (item.amount * percentage) / 100;
    }

    default:
      return 0;
  }
}

/**
 * Calculate the pre-tax subtotal for a specific diner
 */
export function calculateDinerSubtotal(
  items: Item[],
  dinerId: string
): number {
  return items.reduce((sum, item) => {
    return sum + calculateItemShareForDiner(item, dinerId);
  }, 0);
}

/**
 * Calculate adjustments for a specific diner
 */
export function calculateDinerAdjustments(
  adjustments: Adjustment[],
  dinerId: string,
  dinerSubtotal: number,
  totalSubtotal: number
): number {
  return adjustments.reduce((sum, adj) => {
    if (adj.scope === 'person') {
      // Person-specific adjustment
      if (adj.personId === dinerId) {
        return sum + adj.amount;
      }
      return sum;
    } else {
      // Meal-level adjustment
      if (adj.allocationRule === 'proportional') {
        // Allocate proportionally
        if (totalSubtotal === 0) return sum;
        const proportion = dinerSubtotal / totalSubtotal;
        return sum + (adj.amount * proportion);
      } else {
        // Explicit allocation
        const explicitAmount = adj.explicitAmounts?.[dinerId] || 0;
        return sum + explicitAmount;
      }
    }
  }, 0);
}

/**
 * Calculate totals for all diners with proper proportional allocation
 */
export function calculateMealTotals(meal: Meal): DinerTotal[] {
  const { items, diners, receiptMeta, adjustments } = meal;

  // Calculate total subtotal for proportional allocation
  const totalSubtotal = items.reduce((sum, item) => sum + item.amount, 0);

  // Calculate totals for each diner
  const dinerTotals: DinerTotal[] = diners.map((diner) => {
    const itemSubtotal = calculateDinerSubtotal(items, diner.id);

    // Proportional allocation of receipt-level charges
    const proportion = totalSubtotal === 0 ? 0 : itemSubtotal / totalSubtotal;

    const allocatedTax = receiptMeta.tax * proportion;
    const allocatedTip = receiptMeta.tip * proportion;

    const totalFees = receiptMeta.fees.reduce((sum, fee) => sum + fee, 0);
    const allocatedFees = totalFees * proportion;

    const totalDiscounts = receiptMeta.discounts.reduce((sum, disc) => sum + disc, 0);
    const allocatedDiscounts = totalDiscounts * proportion;

    // Calculate adjustments
    const adjustmentsTotal = calculateDinerAdjustments(
      adjustments,
      diner.id,
      itemSubtotal,
      totalSubtotal
    );

    const total = itemSubtotal + allocatedTax + allocatedTip + allocatedFees + allocatedDiscounts + adjustmentsTotal;

    return {
      dinerId: diner.id,
      dinerName: diner.name,
      itemSubtotal,
      allocatedTax,
      allocatedTip,
      allocatedFees,
      allocatedDiscounts,
      adjustments: adjustmentsTotal,
      total,
    };
  });

  return dinerTotals;
}

/**
 * Apply largest remainder rounding to ensure totals reconcile exactly
 */
export function reconcileRounding(
  dinerTotals: DinerTotal[],
  targetTotal: number
): DinerTotal[] {
  // Round all totals to cents
  const roundedTotals = dinerTotals.map((dt) => ({
    ...dt,
    total: Math.round(dt.total * 100) / 100,
  }));

  // Calculate the difference
  const sumRounded = roundedTotals.reduce((sum, dt) => sum + dt.total, 0);
  const diff = Math.round((targetTotal - sumRounded) * 100); // in cents

  if (diff === 0) return roundedTotals;

  // Calculate remainders for largest remainder method
  const withRemainders = roundedTotals.map((dt, index) => {
    const originalCents = Math.round(dinerTotals[index].total * 100);
    const roundedCents = Math.round(dt.total * 100);
    const remainder = Math.abs(originalCents - roundedCents);
    return { dt, remainder, index };
  });

  // Sort by remainder (descending)
  withRemainders.sort((a, b) => b.remainder - a.remainder);

  // Distribute the difference
  const adjustment = diff > 0 ? 0.01 : -0.01;
  const numAdjustments = Math.abs(diff);

  for (let i = 0; i < numAdjustments && i < withRemainders.length; i++) {
    withRemainders[i].dt.total = Math.round((withRemainders[i].dt.total + adjustment) * 100) / 100;
  }

  // Return in original order
  withRemainders.sort((a, b) => a.index - b.index);
  return withRemainders.map((wr) => wr.dt);
}

/**
 * Generate complete meal summary with reconciled totals
 */
export function generateMealSummary(meal: Meal): MealSummary {
  const dinerTotals = calculateMealTotals(meal);
  const targetTotal = meal.receiptMeta.total;

  const reconciledTotals = reconcileRounding(dinerTotals, targetTotal);

  const actualSum = reconciledTotals.reduce((sum, dt) => sum + dt.total, 0);
  const reconciliationDiff = Math.round((actualSum - targetTotal) * 100) / 100;

  return {
    meal,
    dinerTotals: reconciledTotals,
    reconciliationDiff,
  };
}

/**
 * Generate settlement suggestions if one person paid the entire bill
 */
export function generateSettlementSuggestions(
  summary: MealSummary,
  payerId: string
): Array<{ from: string; to: string; amount: number }> {
  const payer = summary.meal.diners.find((d) => d.id === payerId);
  if (!payer) return [];

  return summary.dinerTotals
    .filter((dt) => dt.dinerId !== payerId && dt.total > 0)
    .map((dt) => ({
      from: dt.dinerName,
      to: payer.name,
      amount: dt.total,
    }));
}
