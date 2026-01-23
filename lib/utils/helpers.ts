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
  const date = new Date(dateString);
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
