# Will's Meal Splitting Tool

A comprehensive web application that calculates how much each diner owes for a shared meal by parsing receipts (photo upload or manual entry), letting users assign items to diners, and splitting tax/tip/adjustments proportionally to each person's pre-tax subtotal.

## Features

### Core Functionality
- **Meal Creation**: Create meals with names, dates, and optional restaurant info
- **Diner Management**: Add, edit, and remove diners dynamically
- **Receipt Input**: Two modes for adding receipt data
  - **Photo Upload**: Drag-and-drop receipt images with OCR parsing
  - **Manual Entry**: Direct input of items and totals
- **Item Review**: Edit parsed or manually entered items
- **Flexible Assignment**: Assign items to diners with multiple split options
  - Single owner (100%)
  - Even split among selected diners
  - Custom shares (e.g., 2:1 ratio)
  - Custom percentages (e.g., 70/30)
- **Smart Calculations**: Proportional allocation of tax, tip, and fees based on pre-tax spending
- **Adjustments System**: Add custom credits/debits (cash payments, coupons, etc.)
- **Final Summary**: Per-person breakdown with settlement instructions
- **Export/Share**: Copy summary to clipboard or download as CSV

### Technical Features
- **Image Preprocessing**: Automatic enhancement for better OCR results
  - Grayscale conversion
  - Contrast enhancement
  - Noise reduction
  - Sharpening and binarization
- **OCR Integration**: Google Cloud Vision API for high-accuracy receipt text extraction
- **Rate Limiting**: Built-in usage tracking to stay within free tier (950 scans/month)
- **Receipt Parsing**: Heuristic-based parser for extracting items and totals
- **Rounding Reconciliation**: Ensures individual totals sum exactly to receipt total
- **localStorage Persistence**: Automatic saving of meal data
- **Mobile-First Design**: Responsive UI optimized for all devices
- **TypeScript**: Fully typed for better development experience

## Installation

### Prerequisites
- Node.js 18+ and npm
- Google Cloud account (free tier available)

### Setup
```bash
# Clone the repository
git clone https://github.com/WSun0/meal-splitter.git
cd meal-splitter

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your Google Cloud Vision API key to .env.local
# (see Google Cloud Setup below)

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`.

### Google Cloud Setup (for OCR)

The app uses Google Cloud Vision API for receipt scanning. The free tier includes **1,000 scans per month** (the app limits to 950 to provide a buffer).

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Cloud Vision API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Vision API"
   - Click "Enable"
4. Create an API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - (Optional) Restrict the key to "Cloud Vision API" only
5. Add the key to your `.env.local` file:
   ```
   GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here
   ```

**Note:** The app tracks usage in your browser's localStorage and shows remaining scans. If you hit the limit, use manual entry until the next month.

## User Guide

### Step 1: Create a Meal
1. Enter a meal name (required)
2. Optionally add restaurant name and date
3. Click "Create Meal"

### Step 2: Add Diners
1. Enter diner names one by one
2. Edit or remove diners as needed
3. Continue when at least one diner is added

### Step 3: Add Receipt Data
Choose one of two methods:

#### Option A: Upload Receipt Photo
1. Drag and drop a receipt image or click to browse
2. Wait for OCR processing (may take a few seconds)
3. Review parsed items and totals
4. Adjust any incorrect data

**Tips for best OCR results:**
- Take photo in good lighting
- Hold camera directly above receipt (flat, no angle)
- Avoid glare and shadows
- Ensure text is clear and in focus

#### Option B: Manual Entry
1. Add items with name, quantity, and amount
2. Enter receipt totals (subtotal, tax, tip)
3. Use "Auto" buttons to calculate values

### Step 4: Review Items
1. Check all items for accuracy
2. Edit names, quantities, or amounts as needed
3. Delete any incorrect items
4. Continue to assignment

### Step 5: Assign Items to Diners
For each item:
1. Check which diners should be assigned
2. Select split type:
   - **Full item**: One person pays 100%
   - **Even split**: Split equally among selected diners
   - **By shares**: Custom ratio (e.g., person A gets 2 shares, person B gets 1 share)
   - **By %**: Custom percentage (e.g., 70% to A, 30% to B)
3. Use "Assign to All" for items everyone shared

### Step 6: Add Adjustments (Optional)
Add custom credits or debits:
- **Person-specific**: "Alice paid $20 cash already"
- **Meal-wide proportional**: "Service fee" (split by spending)
- **Explicit amounts**: Manual allocation per person

### Step 7: View Summary
1. Review per-person breakdown showing:
   - Item subtotal
   - Allocated tax, tip, and fees
   - Adjustments
   - Final total
2. Optionally select who paid to see settlement instructions
3. Export summary or download as CSV

## Technical Architecture

### Project Structure
```
meal-splitter/
├── app/
│   ├── api/ocr/         # OCR API endpoint
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main app page
├── components/
│   ├── assignment/      # Item assignment UI
│   ├── meal/            # Meal creation and diners
│   ├── receipt/         # Receipt upload and entry
│   └── summary/         # Summary and export
├── lib/
│   ├── store/           # State management
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities and calculations
└── public/              # Static assets
```

### Key Technologies
- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Google Cloud Vision**: High-accuracy OCR (1,000 free/month)
- **Sharp**: Server-side image processing
- **React Context**: State management

### Data Model
```typescript
Meal {
  id, title, date, restaurant
  diners: Diner[]
  items: Item[]
  receiptMeta: ReceiptMeta
  adjustments: Adjustment[]
}

Item {
  id, name, quantity, amount
  assignments: Assignment[]
}

Assignment {
  dinerId, splitType, value?
}
```

### Calculation Logic
1. Calculate per-item shares based on assignment types
2. Sum item subtotals per diner
3. Allocate tax/tip/fees proportionally:
   ```
   allocatedTax(diner) = tax × (dinerSubtotal / totalSubtotal)
   ```
4. Apply adjustments (person-specific or proportional)
5. Round totals with largest-remainder method
6. Ensure sum equals receipt total exactly

## Development

### Running Tests
```bash
npm run build  # Validates TypeScript and builds
```

### Code Style
- Uses TypeScript strict mode
- Follows Next.js 16 conventions
- Client components marked with 'use client'
- Server-side logic in API routes

## Limitations and Future Improvements
- OCR accuracy depends on receipt quality
- Receipt parsing uses heuristics (may need adjustments for different formats)
- No database persistence (localStorage only)
- Single-user application (no multi-user collaboration)

### Potential Enhancements
- Database integration for persistent storage
- User accounts and meal history
- Shareable meal links
- Mobile app versions
- Enhanced OCR with ML models
- Support for multiple currencies
- Venmo/PayPal integration for payments

## License
ISC

## Contributing
Issues and pull requests welcome at https://github.com/WSun0/meal-splitter
