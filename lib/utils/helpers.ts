/**
 * Generate a unique ID using cryptographically secure random values
 */
export function generateId(): string {
  // Use crypto.getRandomValues for secure randomness
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
  return `${Date.now()}-${randomPart}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(dateString: string): string {
  // A bare YYYY-MM-DD is parsed by Date as UTC midnight, which renders as the
  // previous day in US time zones. Treat it as a local calendar date instead.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Safely parse JSON from localStorage
 */
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Today's date as YYYY-MM-DD in the user's local time zone.
 * (new Date().toISOString() gives the UTC date, which is tomorrow after ~4pm PT.)
 */
export function todayLocalISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
