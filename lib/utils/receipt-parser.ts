import { OCRResult, Item } from '../types/meal';

/**
 * Parse OCR text to extract receipt items and totals
 * This is a heuristic-based parser that looks for common receipt patterns
 */
export function parseReceiptText(text: string, confidence: number): OCRResult {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  const items: Omit<Item, 'id' | 'assignments'>[] = [];
  const receiptMeta: any = {
    subtotal: 0,
    tax: 0,
    tip: 0,
    fees: [],
    discounts: [],
    total: 0,
  };

  // Regex patterns for parsing
  const pricePattern = /\$?\s*(\d+\.\d{2})/;
  const itemPattern = /^(.+?)\s+(\d+)\s*x?\s*\$?\s*(\d+\.\d{2})\s*\$?\s*(\d+\.\d{2})?$/i;
  const simpleItemPattern = /^(.+?)\s+\$?\s*(\d+\.\d{2})$/;

  // Keywords for totals
  const subtotalKeywords = ['subtotal', 'sub total', 'sub-total'];
  const taxKeywords = ['tax', 'sales tax', 'gst', 'hst'];
  const tipKeywords = ['tip', 'gratuity'];
  const totalKeywords = ['total', 'amount', 'balance'];
  const feeKeywords = ['fee', 'service charge', 'surcharge', 'delivery'];
  const discountKeywords = ['discount', 'coupon', 'promo'];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check for subtotal
    if (subtotalKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.subtotal = parseFloat(match[1]);
      }
      continue;
    }

    // Check for tax
    if (taxKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.tax = parseFloat(match[1]);
      }
      continue;
    }

    // Check for tip
    if (tipKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.tip = parseFloat(match[1]);
      }
      continue;
    }

    // Check for total
    if (totalKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.total = parseFloat(match[1]);
      }
      continue;
    }

    // Check for fees
    if (feeKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.fees.push(parseFloat(match[1]));
      }
      continue;
    }

    // Check for discounts
    if (discountKeywords.some((kw) => lowerLine.includes(kw))) {
      const match = line.match(pricePattern);
      if (match) {
        receiptMeta.discounts.push(-parseFloat(match[1])); // negative for discounts
      }
      continue;
    }

    // Try to match item patterns
    // Pattern 1: "Item Name 2 x $5.00 $10.00" (with quantity)
    let match = line.match(itemPattern);
    if (match) {
      const [, name, qtyStr, , lineTotal] = match;
      const quantity = parseInt(qtyStr, 10);
      const amount = lineTotal ? parseFloat(lineTotal) : 0;

      if (name && quantity && amount) {
        items.push({
          name: name.trim(),
          quantity,
          amount,
        });
        continue;
      }
    }

    // Pattern 2: "Item Name $10.00" (simple)
    match = line.match(simpleItemPattern);
    if (match) {
      const [, name, amountStr] = match;
      const amount = parseFloat(amountStr);

      // Filter out lines that look like totals
      if (
        name &&
        amount &&
        !subtotalKeywords.some((kw) => name.toLowerCase().includes(kw)) &&
        !totalKeywords.some((kw) => name.toLowerCase().includes(kw))
      ) {
        items.push({
          name: name.trim(),
          quantity: 1,
          amount,
        });
      }
    }
  }

  // Calculate subtotal from items if not found
  if (receiptMeta.subtotal === 0 && items.length > 0) {
    receiptMeta.subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  }

  // Calculate total if not found
  if (receiptMeta.total === 0) {
    const totalFees = receiptMeta.fees.reduce((sum: number, fee: number) => sum + fee, 0);
    const totalDiscounts = receiptMeta.discounts.reduce((sum: number, disc: number) => sum + disc, 0);
    receiptMeta.total = receiptMeta.subtotal + receiptMeta.tax + receiptMeta.tip + totalFees + totalDiscounts;
  }

  return {
    items,
    receiptMeta,
    confidence,
    rawText: text,
  };
}

/**
 * Calculate confidence threshold
 * Returns true if confidence is acceptable
 */
export function isConfidenceAcceptable(confidence: number): boolean {
  return confidence >= 0.6; // 60% threshold
}
