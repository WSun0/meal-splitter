import { Meal, Item, DinerTotal, MealSummary, Adjustment, Assignment, ItemPortion } from '../types/meal';

/**
 * Calculate how much of an item belongs to a specific diner based on their assignment weight.
 * 
 * For each item, the sum of all diner weights equals 1 (100% of the item).
 */
function calculateAssignmentShare(
  amount: number,
  assignments: Assignment[],
  dinerId: string
): number {
  const assignment = assignments.find((a) => a.dinerId === dinerId);
  if (!assignment) return 0;

  const assignedDiners = assignments;
  if (assignedDiners.length === 0) return 0;

  switch (assignment.splitType) {
    case 'single':
      // 100% to this diner (weight = 1)
      return amount;

    case 'even':
      // Split evenly among all assigned diners (weight = 1/k for k diners)
      return amount / assignedDiners.length;

    case 'shares': {
      // Calculate based on shares (weight = thisShare / totalShares)
      const totalShares = assignedDiners.reduce(
        (sum, a) => sum + (a.value || 1),
        0
      );
      if (totalShares === 0) return 0;
      const thisShare = assignment.value || 1;
      return (amount * thisShare) / totalShares;
    }

    case 'percentage': {
      // Calculate based on percentage (weight = percentage / 100)
      const percentage = assignment.value || 0;
      return (amount * percentage) / 100;
    }

    default:
      return 0;
  }
}

function getItemPortionsForCalculation(item: Item): Array<{ amount: number; assignments: Assignment[] }> {
  const quantity = Math.max(1, Math.round(item.quantity || 1));
  const portions: ItemPortion[] = item.portions && item.portions.length > 0
    ? item.portions
    : [];

  if (portions.length === 0) {
    const portionCount = quantity;
    const unitAmount = portionCount > 0 ? item.amount / portionCount : item.amount;
    return Array.from({ length: portionCount }, () => ({
      amount: unitAmount,
      assignments: item.assignments,
    }));
  }

  const portionCount = portions.length || quantity;
  const unitAmount = portionCount > 0 ? item.amount / portionCount : item.amount;
  return portions.map((portion) => ({
    amount: unitAmount,
    assignments: portion.assignments,
  }));
}

export function calculateItemShareForDiner(
  item: Item,
  dinerId: string
): number {
  const portions = getItemPortionsForCalculation(item);
  return portions.reduce((sum, portion) => {
    return sum + calculateAssignmentShare(portion.amount, portion.assignments, dinerId);
  }, 0);
}

/**
 * Calculate the pre-tax/pre-tip subtotal for a specific diner.
 * This is the sum of their share of all items.
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
 * Calculate person-specific adjustments for a diner.
 * These are adjustments scoped to a specific person (not meal-level).
 */
export function calculatePersonSpecificAdjustments(
  adjustments: Adjustment[],
  dinerId: string
): number {
  return adjustments
    .filter((adj) => adj.scope === 'person' && adj.personId === dinerId)
    .reduce((sum, adj) => sum + adj.amount, 0);
}

/**
 * Calculate totals for all diners with proper proportional allocation.
 * 
 * Algorithm:
 * 1. Calculate each diner's pre-tax item subtotal
 * 2. Calculate group subtotal S (sum of all diner subtotals)
 * 3. Calculate total global charges (tax + tip + fees + discounts + meal-level adjustments)
 * 4. Allocate global charges proportionally: share[d] = subtotal[d] / S
 * 5. Add person-specific adjustments directly to that person
 */
export function calculateMealTotals(meal: Meal): DinerTotal[] {
  const { items, diners, receiptMeta, adjustments } = meal;

  // Step 1 & 2: Calculate each diner's subtotal and group subtotal
  const dinerSubtotals = new Map<string, number>();
  let groupSubtotal = 0;
  
  for (const diner of diners) {
    const subtotal = calculateDinerSubtotal(items, diner.id);
    dinerSubtotals.set(diner.id, subtotal);
    groupSubtotal += subtotal;
  }

  // Step 3: Calculate global charges
  const totalFees = receiptMeta.fees.reduce((sum, f) => sum + f, 0);
  const totalDiscounts = receiptMeta.discounts.reduce((sum, d) => sum + d, 0); // stored as negative
  const hasExplicitTotal = receiptMeta.total > 0;
  
  // Meal-level adjustments (not person-specific)
  const mealLevelAdjustments = adjustments.filter((adj) => adj.scope === 'meal');
  
  // Calculate total meal-level adjustment amount to allocate proportionally
  const mealAdjustmentTotal = mealLevelAdjustments.reduce((sum, adj) => {
    if (adj.allocationRule === 'proportional') {
      return sum + adj.amount;
    }
    return sum;
  }, 0);

  // Total global charges = tax + tip + fees + discounts + proportional meal adjustments
  const totalGlobalCharges = receiptMeta.tax + receiptMeta.tip + totalFees + totalDiscounts + mealAdjustmentTotal;

  // Step 4 & 5: Calculate totals for each diner
  const dinerTotals: DinerTotal[] = diners.map((diner) => {
    const itemSubtotal = dinerSubtotals.get(diner.id) || 0;
    
    // Proportional share of global charges
    const proportion = groupSubtotal > 0 ? itemSubtotal / groupSubtotal : 0;
    
    const allocatedTax = receiptMeta.tax * proportion;
    const allocatedTip = receiptMeta.tip * proportion;
    const allocatedFees = totalFees * proportion;
    const allocatedDiscounts = totalDiscounts * proportion;
    
    // Allocated meal-level adjustments (proportional ones)
    let allocatedMealAdjustments = mealAdjustmentTotal * proportion;
    
    // Add explicit/equal split adjustments
    for (const adj of mealLevelAdjustments) {
      if (adj.allocationRule === 'explicit') {
        // For "explicit" rule with meal scope, treat as equal split among all diners
        allocatedMealAdjustments += adj.amount / diners.length;
      }
    }
    
    // Person-specific adjustments
    const personAdjustments = calculatePersonSpecificAdjustments(adjustments, diner.id);
    
    // Total adjustments for this diner (will include any explicit equal split + person-specific)
    let totalAdjustments = allocatedMealAdjustments + personAdjustments;

    // Provisional total using itemized components
    let total = itemSubtotal + allocatedTax + allocatedTip + allocatedFees + allocatedDiscounts + totalAdjustments;

    // If an explicit receipt total is provided, force totals to reconcile to that value
    if (hasExplicitTotal) {
      // Target total for this diner based on share of explicit receipt total
      const targetTotalForDiner = proportion * receiptMeta.total;

      // Remainder captures any mismatch between itemized breakdown and explicit total (e.g., service fees not itemized)
      const remainder = targetTotalForDiner - total;

      // Add the remainder to adjustments (displayed as "Other") so components sum exactly to target
      totalAdjustments += remainder;
      total = targetTotalForDiner;
    }

    return {
      dinerId: diner.id,
      dinerName: diner.name,
      itemSubtotal,
      allocatedTax,
      allocatedTip,
      allocatedFees,
      allocatedDiscounts,
      adjustments: totalAdjustments,
      total,
    };
  });

  return dinerTotals;
}

/**
 * Apply largest remainder rounding to ensure totals reconcile exactly.
 * 
 * Uses the "largest remainder" (Hamilton) method:
 * 1. Convert all raw totals to cents
 * 2. Floor each to get integer cents, track the fractional remainder
 * 3. Sum floored cents - this will be <= target cents
 * 4. Distribute the leftover cents one at a time to diners with largest remainders
 * 
 * This ensures:
 * - Sum of all rounded totals exactly equals the target total
 * - Rounding is fair (those closest to rounding up get the extra cents)
 */
export function reconcileRounding(
  dinerTotals: DinerTotal[],
  targetTotal: number
): DinerTotal[] {
  const targetCents = Math.round(targetTotal * 100);
  
  // Convert to cents and floor, tracking remainders
  const withRemainders = dinerTotals.map((dt, index) => {
    const rawCents = dt.total * 100;
    const flooredCents = Math.floor(rawCents);
    const remainder = rawCents - flooredCents; // fractional part (0 to <1)
    return {
      dt: { ...dt },
      flooredCents,
      remainder,
      index,
    };
  });

  // Calculate how many extra cents we need to distribute
  const sumFloored = withRemainders.reduce((sum, wr) => sum + wr.flooredCents, 0);
  let leftoverCents = targetCents - sumFloored;

  // Sort by remainder descending (those closest to rounding up get priority)
  // Secondary sort by itemSubtotal descending (tie-breaker: higher spenders)
  const sorted = [...withRemainders].sort((a, b) => {
    if (Math.abs(a.remainder - b.remainder) > 0.0001) {
      return b.remainder - a.remainder;
    }
    return b.dt.itemSubtotal - a.dt.itemSubtotal;
  });

  // Distribute leftover cents
  for (let i = 0; leftoverCents > 0 && i < sorted.length; i++) {
    sorted[i].flooredCents += 1;
    leftoverCents--;
  }

  // Handle negative leftover (if target is less than sum, which shouldn't happen normally)
  // This can occur with rounding edge cases
  for (let i = sorted.length - 1; leftoverCents < 0 && i >= 0; i--) {
    if (sorted[i].flooredCents > 0) {
      sorted[i].flooredCents -= 1;
      leftoverCents++;
    }
  }

  // Convert back to dollars and return in original order
  for (const wr of withRemainders) {
    const sortedEntry = sorted.find((s) => s.index === wr.index)!;
    wr.dt.total = sortedEntry.flooredCents / 100;
  }

  return withRemainders.map((wr) => wr.dt);
}

/**
 * Calculate total adjustments amount (all adjustments, regardless of scope)
 */
export function calculateTotalAdjustments(meal: Meal): number {
  return meal.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
}

/**
 * Calculate the computed total from all bill components.
 * Total = items + tax + tip + fees + discounts + adjustments
 * 
 * This is used instead of the parsed receipt total to avoid OCR errors.
 */
export function calculateComputedTotal(meal: Meal): number {
  const itemsTotal = meal.items.reduce((sum, item) => sum + item.amount, 0);
  const tax = meal.receiptMeta.tax;
  const tip = meal.receiptMeta.tip;
  const feesTotal = meal.receiptMeta.fees.reduce((sum, f) => sum + f, 0);
  const discountsTotal = meal.receiptMeta.discounts.reduce((sum, d) => sum + d, 0);
  const adjustmentsTotal = calculateTotalAdjustments(meal);
  
  return itemsTotal + tax + tip + feesTotal + discountsTotal + adjustmentsTotal;
}

/**
 * Validate that all items have valid assignments.
 * Returns items that are missing assignments or have invalid assignment weights.
 */
export function getUnassignedItems(meal: Meal): Item[] {
  return meal.items.filter((item) => {
    const portions = item.portions && item.portions.length > 0
      ? item.portions
      : [{ id: 'legacy', assignments: item.assignments }];

    // Any portion missing assignments should be flagged
    for (const portion of portions) {
      if (portion.assignments.length === 0) {
        return true;
      }

      const validAssignments = portion.assignments.filter((a) =>
        meal.diners.some((d) => d.id === a.dinerId)
      );

      if (validAssignments.length === 0) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Calculate the group subtotal (sum of all item amounts).
 * This should equal the sum of all diner subtotals.
 */
export function calculateGroupSubtotal(meal: Meal): number {
  return meal.items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Validate that the sum of diner subtotals matches the group subtotal.
 * Returns the difference (should be close to 0).
 */
export function validateSubtotalReconciliation(meal: Meal): number {
  const groupSubtotal = calculateGroupSubtotal(meal);
  const dinerSubtotalSum = meal.diners.reduce((sum, diner) => {
    return sum + calculateDinerSubtotal(meal.items, diner.id);
  }, 0);
  return Math.abs(groupSubtotal - dinerSubtotalSum);
}

/**
 * Generate complete meal summary with reconciled totals.
 * 
 * The total is computed from items + tax + tip + fees + discounts + adjustments
 * rather than using the parsed receipt total, to avoid OCR parsing errors.
 * 
 * The algorithm ensures:
 * 1. Global charges are allocated proportionally to each diner's item subtotal
 * 2. Rounding is handled fairly using the largest remainder method
 * 3. Sum of all diner totals exactly equals the computed total
 */
export function generateMealSummary(meal: Meal): MealSummary {
  const dinerTotals = calculateMealTotals(meal);
  
  // If explicit receipt total is provided, use it; otherwise compute from components
  const targetTotal = meal.receiptMeta.total > 0 ? meal.receiptMeta.total : calculateComputedTotal(meal);

  // Apply largest remainder rounding to ensure exact reconciliation
  const reconciledTotals = reconcileRounding(dinerTotals, targetTotal);

  // Calculate reconciliation difference (should be 0 or very close to 0)
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
