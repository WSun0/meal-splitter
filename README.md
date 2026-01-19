# Meal Splitter

Seamlessly split a meal among multiple diners. Handles the annoying stuff automatically: proportional tax and tip splitting, uneven dish prices, and making sure the math actually adds up.

https://meal-splitter-hazel.vercel.app

## What It Does

1. **Add your items** - Upload a photo of your receipt and complete in-house preprocessing for best parsing results, or manually add your items
2. **Add your diners** - People who are splitting the bill
3. **Assign items** - Drag items to their respective consumers, splitting shared dishes however you want
4. **Get the breakdown** - Each person's total

<details>
<summary><strong>Technical Details</strong></summary>

## Architecture Overview

Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS. State management via React Context with localStorage persistence. OCR powered by Google Cloud Vision API with server-side image preprocessing.

```
meal-splitter/
├── app/
│   ├── api/ocr/route.ts     # OCR endpoint with rate limiting
│   ├── page.tsx             # Landing page
│   └── split/page.tsx       # Main splitting interface
├── components/
│   ├── assignment/          # Drag-and-drop item assignment
│   ├── meal/                # Meal creation, diner management
│   ├── receipt/             # Photo upload, manual entry, item review
│   └── summary/             # Final breakdown, adjustments, export
└── lib/
    ├── hooks/               # Custom React hooks
    ├── store/               # React Context state management
    ├── types/               # TypeScript type definitions
    └── utils/               # Calculations, parsing, image processing
```

---

## Data Model

```typescript
interface Meal {
  id: string;
  title: string;
  restaurant?: string;
  date: string;
  diners: Diner[];
  items: Item[];
  receiptMeta: ReceiptMeta;
  adjustments: Adjustment[];
}

interface Item {
  id: string;
  name: string;
  quantity: number;
  amount: number;                    // Total for this line item
  assignments: Assignment[];         // Who pays for this item
  portions?: ItemPortion[];          // For multi-quantity items with different assignments per unit
}

interface Assignment {
  dinerId: string;
  splitType: 'single' | 'even' | 'shares' | 'percentage';
  value?: number;                    // Shares count or percentage value
}

interface Adjustment {
  id: string;
  label: string;
  amount: number;
  type: 'credit' | 'debit';
  scope: 'meal' | 'person';
  allocationRule: 'proportional' | 'explicit';
  personId?: string;                 // Required if scope is 'person'
}
```

---

## OCR Pipeline

### Image Preprocessing (Server-side with Sharp)

Before sending to Google Cloud Vision, images go through a preprocessing pipeline to maximize OCR accuracy:

1. **Grayscale conversion** - Removes color noise
2. **Auto-resize** - Caps at 2000px on longest side for performance
3. **Normalization** - Auto-levels to maximize dynamic range
4. **Contrast enhancement** - Linear transform: `output = 1.5 * input - 64`
5. **Sharpening** - Gaussian sharpen with σ=1.0
6. **Binarization** - Threshold at 128 for crisp text/background separation

### Google Cloud Vision Integration

```
POST /api/ocr
├── Rate limit check (IP-based, 950/month)
├── File validation (10MB max, image/* only)
├── Image preprocessing pipeline
├── Base64 encode (15MB limit post-encoding)
├── Vision API call (TEXT_DETECTION)
└── Receipt parsing + structured response
```

**Security measures:**
- Server-side rate limiting via Upstash Redis (per-IP and global limits)
- Client-side usage tracking for UX (shows remaining scans)
- File type validation (magic bytes via Sharp, not just MIME type)
- Max file size: 10MB, max dimensions: 4096x4096
- Sanitized logging (no PII, truncated text previews)

### Receipt Text Parsing

The parser uses heuristic pattern matching to extract structured data from OCR text:

**Item extraction:**
```
Line patterns tried:
  $10.00          → Price only (orphan price)
  Burger $10.00   → Item with price
  Burger          → Name only (orphan name)
  2 x Taco $8.00  → Quantity + item + price
```

**Orphan matching:**
When items and prices appear on separate lines (common in columnar receipts), the parser:
1. Groups consecutive orphan names into "clusters"
2. Finds orphan prices that follow each cluster
3. Matches names to prices by position within clusters
4. Falls back to simple order-based matching for unmatched orphans

**Meta field detection (keyword-based):**
- Subtotal: `subtotal`, `sub total`, `food total`, `item total`
- Tax: `tax`, `sales tax`, `gst`, `hst`, `vat`
- Tip: `tip`, `gratuity`, `service`
- Total: `total`, `amount due`, `balance`, `grand total`
- Fees: `fee`, `service charge`, `surcharge`, `delivery`
- Discounts: `discount`, `coupon`, `promo`, `savings`

**OCR text cleaning:**
- Unicode normalization (fancy quotes → straight quotes)
- Common OCR error correction: `O` → `0`, `l`/`I` → `1` when adjacent to digits
- Comma-as-decimal fix: `10,00` → `10.00`

---

## Calculation Engine

### Split Types

Each item assignment has a `splitType` determining how that portion is divided:

| Type | Description | Weight Formula |
|------|-------------|----------------|
| `single` | 100% to one person | `weight = 1` |
| `even` | Equal split among assignees | `weight = 1 / numAssignees` |
| `shares` | Ratio-based (e.g., 2:1) | `weight = myShares / totalShares` |
| `percentage` | Explicit % (e.g., 70/30) | `weight = percentage / 100` |

### Proportional Allocation

Tax, tip, and proportional adjustments are allocated based on each diner's pre-tax spending:

```
allocatedTax[diner] = totalTax × (dinerSubtotal / groupSubtotal)
allocatedTip[diner] = totalTip × (dinerSubtotal / groupSubtotal)
```

### Largest Remainder Rounding (Hamilton Method)

The naive approach of rounding each person's total independently can cause the sum to not match the bill. We use the **largest remainder method** to guarantee exact reconciliation:

```
Algorithm:
1. Convert all raw totals to cents
2. Floor each to get integer cents
3. Track fractional remainders (0 to <1 cent)
4. Sum floored cents → will be ≤ target cents
5. Calculate leftover = targetCents - sumFloored
6. Sort diners by remainder (descending)
7. Distribute leftover cents one-at-a-time to highest remainders
8. Convert back to dollars

Example:
  Target: $30.00 (3000 cents)
  Raw totals: $10.003, $10.003, $9.994
  Floored: 1000 + 1000 + 999 = 2999 cents
  Remainders: 0.3, 0.3, 0.4
  Leftover: 1 cent → goes to person with 0.4 remainder
  Final: $10.00, $10.00, $10.00 ✓
```

This ensures:
- Sum of all totals exactly equals the bill
- Rounding is fair (closest to rounding up get the extra cents)
- Tie-breaker: higher spenders get priority

---

## State Management

Uses React Context (`MealProvider`) with localStorage persistence:

```typescript
const MealContext = createContext<{
  meal: Meal | null;
  createMeal: (title, restaurant?, date?) => void;
  addDiner: (name) => void;
  removeDiner: (dinerId) => void;
  addItem: (item) => void;
  updateItem: (itemId, updates) => void;
  // ... etc
}>();
```

**Auto-save:** Every state change triggers `localStorage.setItem()` via `useEffect`.

**Cascading deletes:** Removing a diner also removes:
- Their assignments from all items
- Their portion assignments from multi-quantity items
- Any person-specific adjustments

---

## Rate Limiting

### Server-side (Upstash Redis)

- **Per-IP limit:** 950 scans/month (buffer from 1,000 free tier)
- **Global limit:** Backstop for total API usage
- Returns `429 Too Many Requests` with `Retry-After` header

### Client-side (localStorage)

- Mirrors server count for instant UX feedback
- Shows "X scans remaining" before upload
- Syncs on 429 responses from server
- Resets automatically on month change

---

## Environment Variables

```env
# Required for OCR functionality
GOOGLE_CLOUD_VISION_API_KEY=your_api_key

# Optional: Upstash Redis for server-side rate limiting
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Google Cloud Vision Setup

1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Cloud Vision API**
3. Create API key (Credentials → Create Credentials → API Key)
4. Restrict key to Cloud Vision API only (recommended)
5. Add to `.env.local`

Free tier: 1,000 TEXT_DETECTION requests/month

---

## Limitations

- **OCR accuracy** varies with receipt quality, lighting, and print format
- **Receipt parsing** is heuristic-based; unusual formats may need manual correction
- **No cloud sync** - data is browser-local (localStorage only)
- **Single device** - no account system or cross-device access

---

## Future Roadmap

- [ ] Database integration (Supabase/PlanetScale) for persistent storage
- [ ] User accounts with meal history
- [ ] Shareable meal links (view-only and collaborative)
- [ ] Payment app integration (Venmo, PayPal, Zelle deep links)
- [ ] ML-enhanced receipt parsing (fine-tuned model for receipt formats)
- [ ] Multi-currency support with exchange rates
- [ ] Recurring split templates (for regular group dinners)
- [ ] Mobile apps (React Native or PWA enhancement)

</details>

## License

ISC
