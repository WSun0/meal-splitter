import { OCRResult, Item } from '../types/meal';

/**
 * Clean OCR text - fix common OCR mistakes
 */
function cleanOCRText(text: string): string {
  return text
    // Fix common OCR mistakes with numbers
    .replace(/[oO](\d)/g, '0$1')  // O before digit -> 0
    .replace(/(\d)[oO]/g, '$10')  // O after digit -> 0
    .replace(/[lI](\d)/g, '1$1')  // l or I before digit -> 1
    .replace(/(\d)[lI]/g, '$11')  // l or I after digit -> 1
    .replace(/(\d),(\d{2})(?!\d)/g, '$1.$2')  // comma as decimal -> period
    .replace(/\s+/g, ' ')  // normalize whitespace
    .trim();
}

/**
 * Extract price from a string, handling various formats
 */
function extractPrice(text: string): number | null {
  // Try various price patterns
  const patterns = [
    /\$\s*(\d+\.\d{2})/,           // $10.00
    /\$\s*(\d+)/,                   // $10
    /(\d+\.\d{2})\s*$/,            // 10.00 at end
    /(\d+\.\d{2})/,                // 10.00 anywhere
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const price = parseFloat(match[1]);
      if (!isNaN(price) && price > 0 && price < 10000) {
        return price;
      }
    }
  }
  return null;
}

/**
 * Parse OCR text to extract receipt items and totals
 * This is a heuristic-based parser that looks for common receipt patterns
 */
export function parseReceiptText(text: string, confidence: number): OCRResult {
  const cleanedText = cleanOCRText(text);
  const lines = cleanedText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  const items: Omit<Item, 'id' | 'assignments'>[] = [];
  const receiptMeta: any = {
    subtotal: 0,
    tax: 0,
    tip: 0,
    fees: [],
    discounts: [],
    total: 0,
  };

  // Keywords for totals (expanded)
  const subtotalKeywords = ['subtotal', 'sub total', 'sub-total', 'food total', 'item total'];
  const taxKeywords = ['tax', 'sales tax', 'gst', 'hst', 'vat'];
  const tipKeywords = ['tip', 'gratuity', 'service'];
  const totalKeywords = ['total', 'amount due', 'balance', 'grand total', 'payment'];
  const feeKeywords = ['fee', 'service charge', 'surcharge', 'delivery', 'convenience'];
  const discountKeywords = ['discount', 'coupon', 'promo', 'savings', 'off'];
  
  // Skip keywords - lines containing these are not items
  const skipKeywords = ['thank', 'welcome', 'visit', 'phone', 'address', 'date', 'time', 
                        'server', 'table', 'check', 'guest', 'card', 'visa', 'mastercard',
                        'change', 'cash', 'credit', 'debit', 'receipt', 'order'];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Skip lines that are clearly not items
    if (skipKeywords.some(kw => lowerLine.includes(kw))) {
      continue;
    }
    
    // Skip very short lines (likely noise)
    if (line.length < 3) {
      continue;
    }

    // Check for subtotal
    if (subtotalKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.subtotal = price;
      continue;
    }

    // Check for tax
    if (taxKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.tax = price;
      continue;
    }

    // Check for tip
    if (tipKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.tip = price;
      continue;
    }

    // Check for total (but not subtotal)
    if (totalKeywords.some((kw) => lowerLine.includes(kw)) && 
        !subtotalKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.total = price;
      continue;
    }

    // Check for fees
    if (feeKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.fees.push(price);
      continue;
    }

    // Check for discounts
    if (discountKeywords.some((kw) => lowerLine.includes(kw))) {
      const price = extractPrice(line);
      if (price) receiptMeta.discounts.push(-price);
      continue;
    }

    // Try to extract item - look for any line with a price
    const price = extractPrice(line);
    if (price) {
      // Remove the price from the line to get the item name
      let name = line
        .replace(/\$?\s*\d+\.\d{2}/g, '')  // Remove prices
        .replace(/\s+/g, ' ')               // Normalize spaces
        .trim();
      
      // Clean up common prefixes/suffixes
      name = name
        .replace(/^[\d\s\-\*\.]+/, '')     // Remove leading numbers, dashes, asterisks
        .replace(/[\d\s\-\*\.]+$/, '')     // Remove trailing numbers, dashes
        .replace(/^\s*x\s*\d+\s*/i, '')    // Remove "x 2" quantity prefix
        .trim();
      
      // Only add if we have a reasonable item name
      if (name.length >= 2 && name.length <= 50) {
        // Check for quantity pattern like "2 x" or "x2" at start
        const qtyMatch = line.match(/^(\d+)\s*x\s/i) || line.match(/x\s*(\d+)\s/i);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        
        items.push({
          name: name,
          quantity: quantity || 1,
          amount: price,
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
  return confidence >= 0.4; // 40% threshold - be more lenient with client-side OCR
}
