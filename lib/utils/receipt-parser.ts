import { OCRResult, Item } from '../types/meal';

/**
 * Clean OCR text - fix common OCR mistakes
 */
function cleanOCRText(text: string): string {
  return text
    // Normalize unicode characters
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // fancy single quotes -> straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // fancy double quotes -> straight
    .replace(/[\u2013\u2014]/g, '-')  // en-dash, em-dash -> hyphen
    // Fix common OCR mistakes with numbers
    .replace(/[oO](\d)/g, '0$1')  // O before digit -> 0
    .replace(/(\d)[oO]/g, '$10')  // O after digit -> 0
    .replace(/[lI](\d)/g, '1$1')  // l or I before digit -> 1
    .replace(/(\d)[lI]/g, '$11')  // l or I after digit -> 1
    .replace(/(\d),(\d{2})(?!\d)/g, '$1.$2')  // comma as decimal -> period
    .replace(/[^\S\n]+/g, ' ')  // normalize whitespace BUT preserve newlines
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
 * Check if a line looks like a potential item name (not a meta line)
 */
function isPotentialItemName(line: string, skipKeywords: string[], metaKeywords: string[]): boolean {
  const lowerLine = line.toLowerCase();
  
  // Skip if it contains skip keywords
  if (skipKeywords.some(kw => lowerLine.includes(kw))) {
    return false;
  }
  
  // Skip if it contains meta keywords (subtotal, tax, etc.)
  if (metaKeywords.some(kw => lowerLine.includes(kw))) {
    return false;
  }
  
  // Skip very short lines
  if (line.length < 2) {
    return false;
  }
  
  // Skip lines that are just prices
  if (/^\$?\s*\d+\.\d{2}\s*$/.test(line)) {
    return false;
  }
  
  // Skip lines that look like dates/times
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line) || /^\d{1,2}:\d{2}/.test(line)) {
    return false;
  }
  
  // Skip lines that look like sentences/paragraphs (footer text)
  // These typically have many words and common sentence patterns
  const wordCount = line.split(/\s+/).length;
  if (wordCount > 6) {
    return false;
  }
  
  // Skip lines containing common footer/legal phrases
  const footerPhrases = ['which goes', 'directly to', 'do not', 'this fee', 'is not', 'is added'];
  if (footerPhrases.some(phrase => lowerLine.includes(phrase))) {
    return false;
  }
  
  return true;
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
                        'change', 'cash', 'credit', 'debit', 'receipt', 'order', 'ordered'];

  // All meta keywords combined for checking potential item names
  const allMetaKeywords = [...subtotalKeywords, ...taxKeywords, ...tipKeywords, ...totalKeywords, ...feeKeywords, ...discountKeywords];

  // Track orphan names (item names without prices on the same line)
  const orphanNames: { name: string; quantity: number; index: number }[] = [];
  // Track orphan prices (prices without item names)
  const orphanPrices: { price: number; index: number }[] = [];

  // Helper to get price from current line or next line
  const getPriceFromLineOrNext = (lineIdx: number): { price: number | null; consumedNext: boolean } => {
    const price = extractPrice(lines[lineIdx]);
    if (price) return { price, consumedNext: false };
    
    // Check next line for price
    if (lineIdx + 1 < lines.length) {
      const nextLine = lines[lineIdx + 1];
      // Only use next line if it's just a price (no other text)
      if (/^\$?\s*-?\d+\.\d{2}\s*$/.test(nextLine)) {
        const nextPrice = extractPrice(nextLine);
        if (nextPrice) return { price: nextPrice, consumedNext: true };
      }
    }
    return { price: null, consumedNext: false };
  };

  // Track which line indices to skip (because they were consumed as prices)
  const consumedIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (consumedIndices.has(i)) continue;
    
    const line = lines[i];
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
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.subtotal = price;
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Check for tax
    if (taxKeywords.some((kw) => lowerLine.includes(kw))) {
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.tax += price; // Add to tax (handles multiple tax lines)
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Check for tip
    if (tipKeywords.some((kw) => lowerLine.includes(kw))) {
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.tip = price;
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Check for total (but not subtotal)
    if (totalKeywords.some((kw) => lowerLine.includes(kw)) && 
        !subtotalKeywords.some((kw) => lowerLine.includes(kw))) {
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.total = price;
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Check for fees
    if (feeKeywords.some((kw) => lowerLine.includes(kw))) {
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.fees.push(price);
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Check for discounts
    if (discountKeywords.some((kw) => lowerLine.includes(kw))) {
      const { price, consumedNext } = getPriceFromLineOrNext(i);
      if (price) {
        receiptMeta.discounts.push(-price);
        if (consumedNext) consumedIndices.add(i + 1);
      }
      continue;
    }

    // Try to extract item - look for any line with a price
    const price = extractPrice(line);
    if (price) {
      // Skip if this line was already consumed as a price for a meta field
      if (consumedIndices.has(i)) {
        continue;
      }
      
      // Remove the price from the line to get the item name
      let name = line
        .replace(/\$?\s*-?\d+\.\d{2}/g, '')  // Remove prices (including negative)
        .replace(/\s+/g, ' ')               // Normalize spaces
        .trim();
      
      // Clean up common prefixes/suffixes
      name = name
        .replace(/^[\d\s\-\*\.]+/, '')     // Remove leading numbers, dashes, asterisks
        .replace(/[\d\s\-\*\.]+$/, '')     // Remove trailing numbers, dashes
        .replace(/^\s*x\s*\d+\s*/i, '')    // Remove "x 2" quantity prefix
        .replace(/^\+\s*/, '')              // Remove leading + (like "+ Tip:")
        .trim();
      
      // Check for quantity pattern like "2 x" or "x2" at start
      const qtyMatch = line.match(/^(\d+)\s*x\s/i) || line.match(/x\s*(\d+)\s/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      
      // If we have a reasonable item name, add it directly
      if (name.length >= 2 && name.length <= 50) {
        items.push({
          name: name,
          quantity: quantity || 1,
          amount: price,
        });
      } else {
        // This is an orphan price (price without name on same line)
        orphanPrices.push({ price, index: i });
      }
    } else {
      // No price on this line - might be an item name
      if (isPotentialItemName(line, skipKeywords, allMetaKeywords)) {
        let name = line
          .replace(/^[\d\s\-\*\.]+/, '')
          .replace(/[\d\s\-\*\.]+$/, '')
          .trim();
        
        const qtyMatch = line.match(/^(\d+)\s+/) || line.match(/^(\d+)\s*x\s/i);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        
        // Remove quantity prefix from name if present
        if (qtyMatch) {
          name = name.replace(/^\d+\s*x?\s*/i, '').trim();
        }
        
        if (name.length >= 2 && name.length <= 50) {
          orphanNames.push({ name, quantity: quantity || 1, index: i });
        }
      }
    }
  }

  // If we have orphan names and orphan prices, try to match them
  // This handles receipts where names and prices are on separate lines
  if (orphanNames.length > 0 && orphanPrices.length > 0) {
    // Strategy: Identify "clusters" of consecutive names and match appropriately
    // - If names are clustered (consecutive without prices in between), match by order
    // - If a name is immediately followed by a price (standalone pair), match by proximity
    
    const usedNameIndices = new Set<number>();
    const usedPriceIndices = new Set<number>();
    
    // Group names into clusters (consecutive names without prices in between)
    const nameClusters: number[][] = [];
    let currentCluster: number[] = [];
    
    for (let ni = 0; ni < orphanNames.length; ni++) {
      const nameEntry = orphanNames[ni];
      const nextNameEntry = ni + 1 < orphanNames.length ? orphanNames[ni + 1] : null;
      
      currentCluster.push(ni);
      
      // Check if there's a price between this name and the next name
      if (nextNameEntry) {
        const hasPriceBetween = orphanPrices.some(p => 
          p.index > nameEntry.index && p.index < nextNameEntry.index
        );
        if (hasPriceBetween) {
          // End current cluster
          nameClusters.push(currentCluster);
          currentCluster = [];
        }
      } else {
        // Last name, end cluster
        nameClusters.push(currentCluster);
      }
    }
    
    // Process each cluster
    for (const cluster of nameClusters) {
      if (cluster.length === 1) {
        // Single name - try to match with immediately following price
        const ni = cluster[0];
        const nameEntry = orphanNames[ni];
        
        for (let pi = 0; pi < orphanPrices.length; pi++) {
          if (usedPriceIndices.has(pi)) continue;
          const priceEntry = orphanPrices[pi];
          // Price should be immediately after name (within 1-2 lines)
          if (priceEntry.index > nameEntry.index && priceEntry.index <= nameEntry.index + 2) {
            items.push({
              name: nameEntry.name,
              quantity: nameEntry.quantity,
              amount: priceEntry.price,
            });
            usedNameIndices.add(ni);
            usedPriceIndices.add(pi);
            break;
          }
        }
      } else {
        // Multiple names in cluster - match by order with following prices
        // Find prices that come after the last name in the cluster
        const lastNameIndex = orphanNames[cluster[cluster.length - 1]].index;
        const availablePrices = orphanPrices
          .map((p, pi) => ({ ...p, pi }))
          .filter(p => !usedPriceIndices.has(p.pi) && p.index > lastNameIndex)
          .sort((a, b) => a.index - b.index);
        
        // Match names in cluster with available prices in order
        for (let i = 0; i < cluster.length && i < availablePrices.length; i++) {
          const ni = cluster[i];
          const nameEntry = orphanNames[ni];
          const priceEntry = availablePrices[i];
          
          items.push({
            name: nameEntry.name,
            quantity: nameEntry.quantity,
            amount: priceEntry.price,
          });
          usedNameIndices.add(ni);
          usedPriceIndices.add(priceEntry.pi);
        }
      }
    }
    
    // Final pass: For any remaining unmatched orphans, match by order as fallback
    const remainingNames = orphanNames.filter((_, idx) => !usedNameIndices.has(idx));
    const remainingPrices = orphanPrices.filter((_, idx) => !usedPriceIndices.has(idx));
    
    if (remainingNames.length > 0 && remainingPrices.length > 0) {
      const minCount = Math.min(remainingNames.length, remainingPrices.length);
      for (let i = 0; i < minCount; i++) {
        items.push({
          name: remainingNames[i].name,
          quantity: remainingNames[i].quantity,
          amount: remainingPrices[i].price,
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
