/**
 * Optional "how to pay the payer" details: a Venmo username and/or a Zelle
 * phone number or email. Shown on the share link and in the copied text.
 *
 * Values travel inside share links, so they're validated strictly here and
 * again when a link is decoded. The Venmo username is the only value that
 * ends up in a URL, and it's limited to Venmo's own character set.
 */

export interface PayerPayment {
  venmo?: string; // username without the @
  zelle?: string; // formatted phone number or lowercased email
}

const VENMO_RE = /^[A-Za-z0-9_-]{2,30}$/;
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;

/** "@will-sun " -> "will-sun"; invalid -> undefined. */
export function normalizeVenmo(input: string | undefined | null): string | undefined {
  const v = (input ?? '').trim().replace(/^@+/, '');
  return VENMO_RE.test(v) ? v : undefined;
}

/** US phone numbers become "(555) 123-4567"; emails are lowercased; anything else -> undefined. */
export function normalizeZelle(input: string | undefined | null): string | undefined {
  const v = (input ?? '').trim();
  if (!v || v.length > 254) return undefined;
  if (v.includes('@')) return EMAIL_RE.test(v) ? v.toLowerCase() : undefined;
  let digits = v.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10 || /[^\d\s()+.\-]/.test(v)) return undefined;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Drops empty or invalid fields; returns undefined if nothing is left. */
export function cleanPayment(p: PayerPayment | undefined | null): PayerPayment | undefined {
  if (!p) return undefined;
  const venmo = normalizeVenmo(p.venmo);
  const zelle = normalizeZelle(p.zelle);
  if (!venmo && !zelle) return undefined;
  return { ...(venmo && { venmo }), ...(zelle && { zelle }) };
}

/**
 * Venmo "pay" link with the amount and a note filled in. On phones with the
 * app installed it opens Venmo; elsewhere it opens venmo.com.
 */
export function venmoPayUrl(username: string, cents: number, note: string): string | undefined {
  const user = normalizeVenmo(username);
  if (!user || !Number.isFinite(cents) || cents <= 0) return undefined;
  const params = new URLSearchParams({
    txn: 'pay',
    audience: 'private',
    recipients: user,
    amount: (cents / 100).toFixed(2),
    note: note.slice(0, 120),
  });
  return `https://venmo.com/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Remembered on this device, by payer name, so you only type yours once.
// ---------------------------------------------------------------------------

const MEMORY_KEY = 'mealsplit-pay-details';

function readMemory(): Record<string, PayerPayment> {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Prefixed so a typed name like "__proto__" can't touch the object's prototype.
const memoryKey = (name: string) => `n:${name.trim().toLowerCase()}`;

export function recallPayment(name: string): PayerPayment | undefined {
  return cleanPayment(readMemory()[memoryKey(name)]);
}

export function rememberPayment(name: string, payment: PayerPayment | undefined) {
  try {
    const all = readMemory();
    const clean = cleanPayment(payment);
    if (clean) all[memoryKey(name)] = clean;
    else delete all[memoryKey(name)];
    localStorage.setItem(MEMORY_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: details just aren't remembered
  }
}
