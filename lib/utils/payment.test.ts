import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeVenmo, normalizeZelle, cleanPayment, venmoPayUrl, recallPayment, rememberPayment } from './payment';

describe('normalizeVenmo', () => {
  it('strips @ and whitespace', () => {
    expect(normalizeVenmo(' @will-sun_2 ')).toBe('will-sun_2');
  });
  it('rejects anything that could change a URL', () => {
    for (const bad of ['a', 'will sun', 'will/../x', 'will?x=1', 'will&amount=999', 'x'.repeat(31), '']) {
      expect(normalizeVenmo(bad)).toBeUndefined();
    }
  });
});

describe('normalizeZelle', () => {
  it('formats US phone numbers', () => {
    expect(normalizeZelle('555.123.4567')).toBe('(555) 123-4567');
    expect(normalizeZelle('+1 (555) 123-4567')).toBe('(555) 123-4567');
  });
  it('lowercases emails', () => {
    expect(normalizeZelle('Will@Example.com')).toBe('will@example.com');
  });
  it('rejects junk', () => {
    for (const bad of ['12345', 'call me', '<script>@x.com', 'a@b', '555-123-4567 ext 2']) {
      expect(normalizeZelle(bad)).toBeUndefined();
    }
  });
});

describe('cleanPayment', () => {
  it('drops invalid fields and empty results', () => {
    expect(cleanPayment({ venmo: 'ok_user', zelle: 'nope' })).toEqual({ venmo: 'ok_user' });
    expect(cleanPayment({ venmo: '', zelle: '' })).toBeUndefined();
  });
});

describe('venmoPayUrl', () => {
  it('prefills amount and note', () => {
    const url = new URL(venmoPayUrl('theo', 6228, 'Friday Dinner')!);
    expect(url.origin).toBe('https://venmo.com');
    expect(url.searchParams.get('recipients')).toBe('theo');
    expect(url.searchParams.get('amount')).toBe('62.28');
    expect(url.searchParams.get('note')).toBe('Friday Dinner');
  });
  it('refuses bad input', () => {
    expect(venmoPayUrl('bad user', 100, 'x')).toBeUndefined();
    expect(venmoPayUrl('theo', 0, 'x')).toBeUndefined();
  });
});

describe('remembered pay details', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
  });

  it('recalls by name, case-insensitively', () => {
    rememberPayment('Theo', { venmo: 'theo-v' });
    expect(recallPayment('theo')).toEqual({ venmo: 'theo-v' });
  });

  it('is not confused by a name like __proto__', () => {
    rememberPayment('__proto__', { venmo: 'sneaky' });
    expect(({} as Record<string, unknown>).venmo).toBeUndefined();
    expect(recallPayment('__proto__')).toEqual({ venmo: 'sneaky' });
  });
});
