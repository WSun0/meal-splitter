import { Meal, MealSummary as MealSummaryType, DinerTotal } from '../types/meal';
import { generateMealSummary, generateSettlementSuggestions } from './calculations';

// Shareable data structure (minimal data needed for display)
export interface ShareableData {
  title: string;
  restaurant?: string;
  date: string;
  dinerTotals: {
    name: string;
    itemSubtotal: number;
    tax: number;
    tip: number;
    fees: number;
    total: number;
  }[];
  receiptTotal: number;
  payerId?: string;
  payerName?: string;
  settlements?: {
    from: string;
    to: string;
    amount: number;
  }[];
}

/**
 * Create shareable data from a meal
 */
export function createShareableData(meal: Meal, payerId?: string): ShareableData {
  const summary = generateMealSummary(meal);
  const settlements = payerId ? generateSettlementSuggestions(summary, payerId) : [];
  const payer = payerId ? meal.diners.find(d => d.id === payerId) : undefined;

  return {
    title: meal.title,
    restaurant: meal.restaurant,
    date: meal.date,
    dinerTotals: summary.dinerTotals.map(dt => ({
      name: dt.dinerName,
      itemSubtotal: dt.itemSubtotal,
      tax: dt.allocatedTax,
      tip: dt.allocatedTip,
      fees: dt.allocatedFees + dt.allocatedDiscounts + dt.adjustments,
      total: dt.total,
    })),
    receiptTotal: meal.receiptMeta.total,
    payerId,
    payerName: payer?.name,
    settlements: settlements.length > 0 ? settlements : undefined,
  };
}

/**
 * Encode shareable data to a URL-safe string
 */
export function encodeShareData(data: ShareableData): string {
  try {
    const json = JSON.stringify(data);
    // Use base64url encoding (URL-safe)
    const base64 = btoa(unescape(encodeURIComponent(json)));
    // Make it URL-safe by replacing + with -, / with _, and removing =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error('Failed to encode share data:', error);
    return '';
  }
}

/**
 * Decode shareable data from a URL-safe string
 */
export function decodeShareData(encoded: string): ShareableData | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add back padding
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json) as ShareableData;
  } catch (error) {
    console.error('Failed to decode share data:', error);
    return null;
  }
}

/**
 * Generate a shareable URL
 */
export function generateShareUrl(data: ShareableData): string {
  const encoded = encodeShareData(data);
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    return `${baseUrl}/split?data=${encoded}`;
  }
  return `/split?data=${encoded}`;
}
