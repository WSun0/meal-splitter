import { describe, it, expect, vi } from 'vitest';
import { generateId, formatCurrency, formatDate, safeJsonParse } from './helpers';

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('includes timestamp', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();

    const timestamp = parseInt(id.split('-')[0], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('has expected format (timestamp-randomstring)', () => {
    const id = generateId();
    const parts = id.split('-');
    expect(parts.length).toBe(2);
    expect(parts[0]).toMatch(/^\d+$/);
    expect(parts[1]).toMatch(/^[a-z0-9]+$/);
  });
});

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(10)).toBe('$10.00');
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('formats decimal amounts', () => {
    expect(formatCurrency(10.5)).toBe('$10.50');
    expect(formatCurrency(10.99)).toBe('$10.99');
    expect(formatCurrency(0.01)).toBe('$0.01');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-10)).toBe('-$10.00');
    expect(formatCurrency(-10.50)).toBe('-$10.50');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
    expect(formatCurrency(10.994)).toBe('$10.99');
    expect(formatCurrency(10.995)).toBe('$11.00');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    // Note: Date parsing can vary by timezone, so we check the format is correct
    const result = formatDate('2024-01-15');
    expect(result).toMatch(/January \d{1,2}, 2024/);
  });

  it('formats ISO datetime strings', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toMatch(/January \d{1,2}, 2024/);
  });

  it('handles different months', () => {
    // Note: Due to timezone differences, dates may shift by one day
    // We just verify the format is correct and contains a valid month
    const feb = formatDate('2024-02-15'); // Use mid-month to avoid timezone edge cases
    const jun = formatDate('2024-06-15');
    const nov = formatDate('2024-11-15');

    expect(feb).toMatch(/^[A-Z][a-z]+ \d{1,2}, 2024$/);
    expect(jun).toMatch(/^[A-Z][a-z]+ \d{1,2}, 2024$/);
    expect(nov).toMatch(/^[A-Z][a-z]+ \d{1,2}, 2024$/);
  });

  it('returns formatted string with correct structure', () => {
    const result = formatDate('2024-07-04');
    // Should be in format: "Month Day, Year"
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"name":"test"}', {})).toEqual({ name: 'test' });
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(safeJsonParse('"hello"', '')).toBe('hello');
    expect(safeJsonParse('123', 0)).toBe(123);
    expect(safeJsonParse('true', false)).toBe(true);
    expect(safeJsonParse('null', 'fallback')).toBe(null);
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
    expect(safeJsonParse(null, [])).toEqual([]);
    expect(safeJsonParse(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', 'fallback')).toBe('fallback');
    expect(safeJsonParse('{invalid}', {})).toEqual({});
    expect(safeJsonParse('undefined', [])).toEqual([]);
    expect(safeJsonParse('{', 'default')).toBe('default');
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', 'fallback')).toBe('fallback');
  });

  it('preserves complex nested structures', () => {
    const complex = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      metadata: {
        count: 2,
        nested: { deep: true },
      },
    };
    const json = JSON.stringify(complex);
    expect(safeJsonParse(json, null)).toEqual(complex);
  });
});
