# Meal Splitter

Seamlessly split a meal among multiple diners. Handles the annoying stuff automatically: proportional tax and tip splitting, uneven dish prices, and making sure the math actually adds up.

https://meal-splitter-hazel.vercel.app

## What It Does

1. **Add your items** - Type in each item and its price from the receipt
2. **Add your diners** - People who are splitting the bill
3. **Assign items** - Drag items to their respective consumers, splitting shared dishes however you want
4. **Get the breakdown** - Each person's total, plus a short link to share with everyone

<details>
<summary><strong>Technical Details</strong></summary>

## Architecture Overview

Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS. State management via React Context with localStorage persistence (an unfinished meal from the last 24 hours can be resumed from the landing page). Share links are stored in Vercel Blob.

```
meal-splitter/
├── app/
│   ├── api/share/route.ts   # Stores a shared split, returns a short id
│   ├── page.tsx             # Landing page + splitting flow
│   ├── s/[id]/page.tsx      # Short share links
│   └── split/page.tsx       # Self-contained / legacy share links
├── components/
│   ├── assignment/          # Drag-and-drop item assignment
│   ├── meal/                # Meal creation, diner management
│   ├── receipt/             # Item entry and review
│   ├── share/               # Shared split view
│   └── summary/             # Final breakdown, adjustments, export
└── lib/
    ├── server/              # Share link storage (Vercel Blob)
    ├── store/               # React Context state management
    ├── types/               # TypeScript type definitions
    └── utils/               # Calculations, share encoding
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

**Auto-save:** Every state change writes the meal (with a timestamp) to localStorage.

**Resume, not auto-restore:** On open, a saved meal from the last 24 hours is offered as a "Resume" card on the landing page instead of loading automatically. Older or empty drafts are discarded.

**Cascading deletes:** Removing a diner also removes:
- Their assignments from all items
- Their portion assignments from multi-quantity items
- Any person-specific adjustments

---

## Share Links

`POST /api/share` validates the split (zod) and stores it as a small JSON file in Vercel Blob under a 10-character id derived from a hash of its contents, so sharing the same split twice gives the same link. Links don't expire. The share panel prefetches the link once edits settle; tapping Copy before it's ready shows "Generating link…" and copies when it arrives (falling back to a long link after 4 seconds).

If Blob isn't configured or is unreachable, the app falls back to a self-contained link: `/split#<deflate-compressed payload>`. Old `/split?data=` links still work.

---

## Environment Variables

```env
# Vercel Blob, for short share links. Set automatically when a Blob store is
# connected to the project in Vercel (Storage tab).
BLOB_READ_WRITE_TOKEN=your_blob_token
# Must match the store's access type. Defaults to private.
# SHARE_BLOB_ACCESS=public
```

---

## Security

No accounts: meal data stays in the browser until it's shared. Share links are capability URLs (anyone with the link can read that split).

- **`POST /api/share`**: request bodies are capped at 32 KB, validated with zod, and stored under a server-computed hash, so a share can't be overwritten with different content. Cross-site browser requests are rejected (`Sec-Fetch-Site`/`Origin`). Each IP gets 30 writes per 10 minutes, per server instance.
- **`/s/[id]`**: ids are validated before storage is touched, and successful reads are cached so repeat views don't spend Blob operations. Pages carry `X-Robots-Tag: noindex`.
- **`/split#…`**: compressed payloads are inflated with a 64 KB cap (no decompression bombs).
- **Headers** (all routes, `next.config.js`): CSP, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. `X-Powered-By` is disabled. `script-src` allows `'unsafe-inline'` because Next's bootstrap scripts are inline (nonces would force fully dynamic rendering).
- **CSV export** quotes every cell and neutralizes formula prefixes.

**Recommended in Vercel:** add a Firewall rate-limit rule for `POST /api/share` (e.g. 60 requests / 10 min per IP). The in-app limiter is per serverless instance, so the Firewall rule is the durable backstop.

---

## Limitations

- **No cloud sync** - data is browser-local (localStorage only)
- **Single device** - no account system or cross-device access

---

## Future Roadmap

- [ ] Database integration (Supabase/PlanetScale) for persistent storage
- [ ] User accounts with meal history
- [x] Shareable view-only meal links
- [ ] Collaborative meal links
- [ ] Payment app integration (Venmo, PayPal, Zelle deep links)
- [ ] Multi-currency support with exchange rates
- [ ] Recurring split templates (for regular group dinners)
- [ ] Mobile apps (React Native or PWA enhancement)

</details>

## License

ISC
