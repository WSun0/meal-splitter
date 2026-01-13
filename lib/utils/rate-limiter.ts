/**
 * Client-side usage tracker for Google Cloud Vision API
 * 
 * NOTE: This provides UI feedback only. Real rate limiting happens server-side
 * via Upstash Redis in /lib/utils/server-rate-limiter.ts
 * 
 * This tracker:
 * - Shows users their approximate usage
 * - Provides quick fail UX (avoid uploading if limit reached)
 * - Syncs with server 429 responses
 */

const STORAGE_KEY = 'ocr-usage';
const RATE_LIMIT_KEY = 'ocr-rate-limited';
const MONTHLY_LIMIT = 950; // 50 buffer from 1,000 free tier
const WARNING_THRESHOLD = 850;

interface UsageData {
  count: number;
  monthYear: string; // Format: "2026-01"
}

interface RateLimitData {
  limitedUntil: number; // timestamp
}

function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getUsageData(): UsageData {
  if (typeof window === 'undefined') {
    return { count: 0, monthYear: getCurrentMonthYear() };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { count: 0, monthYear: getCurrentMonthYear() };
    }

    const data: UsageData = JSON.parse(stored);
    const currentMonthYear = getCurrentMonthYear();

    // Reset if it's a new month
    if (data.monthYear !== currentMonthYear) {
      const newData = { count: 0, monthYear: currentMonthYear };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      return newData;
    }

    return data;
  } catch {
    return { count: 0, monthYear: getCurrentMonthYear() };
  }
}

function setUsageData(data: UsageData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export interface UsageStats {
  used: number;
  limit: number;
  remaining: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
  resetDate: string; // First day of next month
}

/**
 * Get current usage statistics
 */
export function getUsageStats(): UsageStats {
  const data = getUsageData();
  const remaining = Math.max(0, MONTHLY_LIMIT - data.count);
  
  // Calculate reset date (first day of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = nextMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });

  return {
    used: data.count,
    limit: MONTHLY_LIMIT,
    remaining,
    isAtLimit: data.count >= MONTHLY_LIMIT,
    isNearLimit: data.count >= WARNING_THRESHOLD,
    resetDate,
  };
}

/**
 * Check if user is currently rate-limited by server
 */
function isServerRateLimited(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return false;

    const data: RateLimitData = JSON.parse(stored);
    if (Date.now() < data.limitedUntil) {
      return true;
    }

    // Clear expired rate limit
    localStorage.removeItem(RATE_LIMIT_KEY);
    return false;
  } catch {
    return false;
  }
}

/**
 * Set server rate limit (called when we get a 429 response)
 */
export function setServerRateLimited(retryAfterSeconds: number): void {
  if (typeof window === 'undefined') return;

  const data: RateLimitData = {
    limitedUntil: Date.now() + retryAfterSeconds * 1000,
  };
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

/**
 * Clear server rate limit (for testing/manual reset)
 */
export function clearServerRateLimit(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RATE_LIMIT_KEY);
}

/**
 * Check if OCR can be used (under rate limit)
 * Checks both client-side counter and server rate limit status
 */
export function canUseOCR(): boolean {
  // Check server rate limit first
  if (isServerRateLimited()) {
    return false;
  }

  const stats = getUsageStats();
  return !stats.isAtLimit;
}

/**
 * Increment the usage counter after a successful API call
 */
export function incrementUsage(): void {
  const data = getUsageData();
  data.count += 1;
  setUsageData(data);
}

/**
 * Get remaining seconds until server rate limit expires
 */
export function getServerRateLimitRemaining(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return 0;

    const data: RateLimitData = JSON.parse(stored);
    const remaining = Math.ceil((data.limitedUntil - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

/**
 * Get a human-readable usage message
 */
export function getUsageMessage(): string {
  // Check server rate limit first
  const serverLimitSeconds = getServerRateLimitRemaining();
  if (serverLimitSeconds > 0) {
    if (serverLimitSeconds > 3600) {
      const hours = Math.ceil(serverLimitSeconds / 3600);
      return `Rate limited. Please try again in ${hours} hour${hours > 1 ? 's' : ''}.`;
    } else if (serverLimitSeconds > 60) {
      const minutes = Math.ceil(serverLimitSeconds / 60);
      return `Rate limited. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return `Rate limited. Please try again in ${serverLimitSeconds} seconds.`;
  }

  const stats = getUsageStats();
  
  if (stats.isAtLimit) {
    return `Monthly scan limit reached (${stats.limit}). Resets ${stats.resetDate}. Please use manual entry.`;
  }
  
  if (stats.isNearLimit) {
    return `${stats.remaining} scans remaining this month. Resets ${stats.resetDate}.`;
  }
  
  return `${stats.used}/${stats.limit} scans used this month`;
}
