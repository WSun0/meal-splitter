// Core types for meal splitting application

export interface Diner {
  id: string;
  name: string;
}

export type SplitType = 'single' | 'even' | 'shares' | 'percentage';

export interface Assignment {
  dinerId: string;
  splitType: SplitType;
  // For 'shares' type: number of shares (e.g., 2 shares vs 1 share)
  // For 'percentage' type: percentage value (e.g., 70 for 70%)
  // For 'single' and 'even': not used
  value?: number;
}

export interface Item {
  id: string;
  name: string;
  quantity: number;
  amount: number; // total amount for this item (qty * unit price)
  assignments: Assignment[];
  isUncertain?: boolean; // flag for OCR uncertainty
}

export type AdjustmentScope = 'meal' | 'person';
export type AllocationRule = 'proportional' | 'explicit';
export type AdjustmentType = 'credit' | 'debit';

export interface Adjustment {
  id: string;
  label: string;
  amount: number; // positive for debit, negative for credit
  type: AdjustmentType;
  scope: AdjustmentScope;
  allocationRule: AllocationRule;
  // If scope is 'person', this must be set
  personId?: string;
  // If allocationRule is 'explicit' and scope is 'meal',
  // this maps person IDs to amounts
  explicitAmounts?: Record<string, number>;
}

export interface ReceiptMeta {
  subtotal: number;
  tax: number;
  tip: number;
  fees: number[];
  discounts: number[];
  total: number;
}

export interface OCRResult {
  items: Omit<Item, 'id' | 'assignments'>[];
  receiptMeta: Partial<ReceiptMeta>;
  confidence: number; // 0-1
  rawText?: string;
  error?: string;
}

export interface Meal {
  id: string;
  title: string;
  restaurant?: string;
  date: string; // ISO date string
  createdAt: string; // ISO date string
  diners: Diner[];
  items: Item[];
  receiptMeta: ReceiptMeta;
  adjustments: Adjustment[];
  // Optional: track who paid the full bill
  payerId?: string;
}

export interface DinerTotal {
  dinerId: string;
  dinerName: string;
  itemSubtotal: number;
  allocatedTax: number;
  allocatedTip: number;
  allocatedFees: number;
  allocatedDiscounts: number;
  adjustments: number;
  total: number;
}

export interface MealSummary {
  meal: Meal;
  dinerTotals: DinerTotal[];
  reconciliationDiff: number; // should be close to 0
}
