import { z } from 'zod';
import { Meal, MealSummary as MealSummaryType, DinerTotal } from '../types/meal';
import { generateMealSummary, generateSettlementSuggestions } from './calculations';

// Zod schema for runtime validation of shareable data
const DinerTotalSchema = z.object({
  name: z.string().max(100),
  itemSubtotal: z.number().finite(),
  tax: z.number().finite(),
  tip: z.number().finite(),
  fees: z.number().finite(),
  total: z.number().finite(),
});

const SettlementSchema = z.object({
  from: z.string().max(100),
  to: z.string().max(100),
  amount: z.number().finite().nonnegative(),
});

const ShareableDataSchema = z.object({
  title: z.string().max(200),
  restaurant: z.string().max(200).optional(),
  date: z.string(),
  dinerTotals: z.array(DinerTotalSchema).max(50),
  receiptTotal: z.number().finite().nonnegative(),
  payerId: z.string().max(100).optional(),
  payerName: z.string().max(100).optional(),
  settlements: z.array(SettlementSchema).max(50).optional(),
});

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
 * Uses modern TextEncoder for proper UTF-8 handling
 */
export function encodeShareData(data: ShareableData): string {
  try {
    const json = JSON.stringify(data);
    // Use TextEncoder for proper UTF-8 encoding
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    // Convert bytes to base64
    const base64 = btoa(String.fromCharCode(...bytes));
    // Make it URL-safe by replacing + with -, / with _, and removing =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error('Failed to encode share data:', error);
    return '';
  }
}

/**
 * Decode shareable data from a URL-safe string
 * Uses modern TextDecoder and Zod for runtime validation
 */
export function decodeShareData(encoded: string): ShareableData | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add back padding
    while (base64.length % 4) {
      base64 += '=';
    }
    // Decode base64 to bytes
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Use TextDecoder for proper UTF-8 decoding
    const decoder = new TextDecoder('utf-8');
    const json = decoder.decode(bytes);

    // Parse and validate with Zod
    const parsed = JSON.parse(json);
    const result = ShareableDataSchema.safeParse(parsed);

    if (!result.success) {
      console.error('Invalid share data schema:', result.error.issues);
      return null;
    }

    return result.data;
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
