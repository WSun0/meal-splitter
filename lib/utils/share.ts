import { z } from 'zod';
import { Meal } from '../types/meal';
import { generateMealSummary, calculateItemShareForDiner } from './calculations';
import { PayerPayment, cleanPayment } from './payment';

/*
 * Shared split data.
 *
 * Everything a viewer needs to see the split, with money stored as integer
 * cents so nothing drifts through float math on the way over.
 *
 * There are two ways a split travels:
 *   1. Short link  -> /s/<id>, payload stored in Vercel Blob (see /api/share)
 *   2. Fallback    -> /split#<deflate+base64url payload>, used if storage is down
 *                     or not configured. The fragment never hits the server.
 *
 * Legacy v1 links (/split?data=<base64 JSON>) are still decoded.
 */

export interface SharedDiner {
  name: string;
  items: number; // cents
  tax: number;
  tip: number;
  other: number; // fees, discounts, adjustments
  total: number;
}

export interface SharedItemShare {
  diner: number; // index into diners
  amount: number; // cents
}

export interface SharedItem {
  name: string;
  amount: number; // cents, full line price (quantity × unit price)
  quantity: number;
  shares: SharedItemShare[];
}

export interface SharedSplit {
  title: string;
  restaurant?: string;
  date: string; // YYYY-MM-DD
  total: number; // cents
  payer?: number; // index into diners
  diners: SharedDiner[];
  items: SharedItem[]; // empty for legacy links
  pay?: PayerPayment; // how to pay the payer, if they added it
}

export interface Settlement {
  from: string;
  to: string;
  amount: number; // cents
}

// ---------------------------------------------------------------------------
// Building from a meal
// ---------------------------------------------------------------------------

const toCents = (dollars: number) => Math.round(dollars * 100);

/**
 * Split `totalCents` across raw (fractional-dollar) shares so the rounded
 * pieces add up exactly to the total. Largest-remainder method.
 */
function distributeCents(totalCents: number, rawShares: number[]): number[] {
  const rawCents = rawShares.map((s) => s * 100);
  const floored = rawCents.map((c) => Math.floor(c));
  let leftover = totalCents - floored.reduce((a, b) => a + b, 0);
  const order = rawCents
    .map((c, i) => ({ i, rem: c - Math.floor(c) }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; leftover > 0 && order.length > 0; k = (k + 1) % order.length) {
    floored[order[k].i] += 1;
    leftover--;
  }
  for (let k = order.length - 1; leftover < 0 && order.length > 0; k = (k - 1 + order.length) % order.length) {
    floored[order[k].i] -= 1;
    leftover++;
  }
  return floored;
}

export function buildSharedSplit(meal: Meal, payerId?: string): SharedSplit {
  const summary = generateMealSummary(meal);

  const diners: SharedDiner[] = summary.dinerTotals.map((dt) => ({
    name: dt.dinerName,
    items: toCents(dt.itemSubtotal),
    tax: toCents(dt.allocatedTax),
    tip: toCents(dt.allocatedTip),
    other: toCents(dt.allocatedFees + dt.allocatedDiscounts + dt.adjustments),
    total: toCents(dt.total),
  }));

  const dinerIndex = new Map(summary.dinerTotals.map((dt, i) => [dt.dinerId, i]));

  const items: SharedItem[] = meal.items.map((item) => {
    const amount = toCents(item.amount);
    const raw = summary.dinerTotals.map((dt) => calculateItemShareForDiner(item, dt.dinerId));
    const rawSum = raw.reduce((a, b) => a + b, 0);
    // Only force the pieces to sum to the item price if the item is fully assigned.
    const target = Math.abs(rawSum - item.amount) < 0.005 ? amount : toCents(rawSum);
    const cents = distributeCents(target, raw);
    return {
      name: item.name,
      amount,
      quantity: Math.max(1, Math.round(item.quantity || 1)),
      shares: cents
        .map((c, i) => ({ diner: i, amount: c }))
        .filter((s) => s.amount !== 0),
    };
  });

  const payerIdx = payerId !== undefined ? dinerIndex.get(payerId) : undefined;

  return {
    title: meal.title.trim() || 'Meal',
    restaurant: meal.restaurant?.trim() || undefined,
    date: meal.date,
    // The real bill total is the sum of what everyone owes (items + tax + tip
    // + adjustments). receiptMeta.total is only the OCR-parsed figure and is 0
    // for manual entry, which is what caused the "$0.00 total" bug.
    total: diners.reduce((sum, d) => sum + d.total, 0),
    payer: payerIdx,
    diners,
    items,
    ...(payerIdx !== undefined && cleanPayment(meal.payerPayment) && { pay: cleanPayment(meal.payerPayment) }),
  };
}

export function getSettlements(split: SharedSplit): Settlement[] {
  if (split.payer === undefined) return [];
  const payer = split.diners[split.payer];
  if (!payer) return [];
  return split.diners
    .filter((d, i) => i !== split.payer && d.total > 0)
    .map((d) => ({ from: d.name, to: payer.name, amount: d.total }));
}

// ---------------------------------------------------------------------------
// Wire format: compact positional arrays, validated with zod.
//
// [2, title, restaurant, date, total, payer, diners, items]
//   diner: [name, items, tax, tip, other, total]
//   item:  [name, amount, [dinerIdx, cents, dinerIdx, cents, ...], quantity?]
//   pay?:  [venmoUsername, zellePhoneOrEmail]  (only when the payer added them)
//          (quantity omitted when 1; links made before it existed have none)
// ---------------------------------------------------------------------------

const cents = z.number().int().safe();
const name = z.string().max(100);

const WireDiner = z.tuple([name, cents, cents, cents, cents, cents]);
const WireItem = z.tuple([
  z.string().max(200),
  cents,
  z.array(cents).max(100),
  z.number().int().min(1).max(999).optional(),
]);

export const WireSchema = z.tuple([
  z.literal(2),
  z.string().max(200),
  z.string().max(200),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cents,
  z.number().int().min(-1).max(49),
  z.array(WireDiner).min(1).max(50),
  z.array(WireItem).max(200),
  // [venmo, zelle], either may be ''. Omitted when there are no pay details.
  z.tuple([z.string().max(30), z.string().max(254)]).optional(),
]);

export type Wire = z.infer<typeof WireSchema>;

export function toWire(split: SharedSplit): Wire {
  const pay = split.payer !== undefined ? cleanPayment(split.pay) : undefined;
  const wire: Wire = [
    2,
    split.title,
    split.restaurant ?? '',
    split.date,
    split.total,
    split.payer ?? -1,
    split.diners.map((d) => [d.name, d.items, d.tax, d.tip, d.other, d.total]),
    split.items.map((it) => {
      const flat = it.shares.flatMap((s) => [s.diner, s.amount]);
      return it.quantity > 1 ? [it.name, it.amount, flat, it.quantity] : [it.name, it.amount, flat];
    }),
  ];
  if (pay) wire.push([pay.venmo ?? '', pay.zelle ?? '']);
  return wire;
}

export function fromWire(input: unknown): SharedSplit | null {
  const parsed = WireSchema.safeParse(input);
  if (!parsed.success) return null;
  const [, title, restaurant, date, total, payer, diners, items, payTuple] = parsed.data;
  if (payer >= diners.length) return null;
  const pay = payer >= 0 && payTuple ? cleanPayment({ venmo: payTuple[0], zelle: payTuple[1] }) : undefined;

  const sharedItems: SharedItem[] = [];
  for (const [itemName, amount, flat, quantity] of items) {
    if (flat.length % 2 !== 0) return null;
    const shares: SharedItemShare[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i] < 0 || flat[i] >= diners.length) return null;
      shares.push({ diner: flat[i], amount: flat[i + 1] });
    }
    sharedItems.push({ name: itemName, amount, quantity: quantity ?? 1, shares });
  }

  return {
    title,
    restaurant: restaurant || undefined,
    date,
    total,
    payer: payer >= 0 ? payer : undefined,
    diners: diners.map(([n, it, tax, tip, other, t]) => ({ name: n, items: it, tax, tip, other, total: t })),
    items: sharedItems,
    ...(pay && { pay }),
  };
}

// ---------------------------------------------------------------------------
// Base64url helpers (work in both browser and Node)
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Largest decoded share payload accepted (real splits are a few KB). */
export const MAX_SHARE_PAYLOAD_BYTES = 64_000;
/** Longest fragment accepted before decoding (a 64 KB payload base64s to ~86 KB). */
const MAX_FRAGMENT_CHARS = 100_000;

/**
 * Inflate, giving up as soon as the output passes `maxBytes`. Checking only
 * after inflating let a ~400 KB link expand to hundreds of MB in the viewer's
 * tab (decompression bomb).
 */
async function inflateCapped(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array | null> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fallback link encoding: /split#<encoded>
// Prefix "z" = deflate-raw compressed, "j" = plain JSON (no CompressionStream)
// ---------------------------------------------------------------------------

export async function encodeFragment(split: SharedSplit): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(split)));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + bytesToBase64Url(await pipeThrough(json, new CompressionStream('deflate-raw')));
    } catch {
      // fall through
    }
  }
  return 'j' + bytesToBase64Url(json);
}

export async function decodeFragment(encoded: string): Promise<SharedSplit | null> {
  try {
    if (encoded.length > MAX_FRAGMENT_CHARS) return null;
    const kind = encoded[0];
    let bytes: Uint8Array | null = base64UrlToBytes(encoded.slice(1));
    if (kind === 'z') {
      bytes = await inflateCapped(bytes, MAX_SHARE_PAYLOAD_BYTES);
    } else if (kind !== 'j') {
      return null;
    }
    if (!bytes || bytes.length > MAX_SHARE_PAYLOAD_BYTES) return null;
    return fromWire(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy v1: /split?data=<base64url JSON>
// ---------------------------------------------------------------------------

const LegacySchema = z.object({
  title: z.string().max(200),
  restaurant: z.string().max(200).optional(),
  date: z.string(),
  dinerTotals: z
    .array(
      z.object({
        name: z.string().max(100),
        itemSubtotal: z.number().finite(),
        tax: z.number().finite(),
        tip: z.number().finite(),
        fees: z.number().finite(),
        total: z.number().finite(),
      })
    )
    .max(50),
  receiptTotal: z.number().finite().nonnegative(),
  payerName: z.string().max(100).optional(),
});

export function decodeLegacyShareData(encoded: string): SharedSplit | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    const parsed = LegacySchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    const data = parsed.data;
    const diners: SharedDiner[] = data.dinerTotals.map((d) => ({
      name: d.name,
      items: toCents(d.itemSubtotal),
      tax: toCents(d.tax),
      tip: toCents(d.tip),
      other: toCents(d.fees),
      total: toCents(d.total),
    }));
    const payer = data.payerName ? diners.findIndex((d) => d.name === data.payerName) : -1;
    return {
      title: data.title,
      restaurant: data.restaurant,
      date: data.date.slice(0, 10),
      total: diners.reduce((s, d) => s + d.total, 0),
      payer: payer >= 0 ? payer : undefined,
      diners,
      items: [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Link creation (client side)
// ---------------------------------------------------------------------------

/** How long to wait for a short link before falling back to a long one. */
export const SHORT_LINK_TIMEOUT_MS = 4000;

/**
 * Get a link for this split: a short /s/<id> link if the server can store it
 * within SHORT_LINK_TIMEOUT_MS, otherwise a self-contained /split#... link.
 * Only rejects if `signal` aborts.
 */
export async function createShareLink(split: SharedSplit, signal?: AbortSignal): Promise<{ url: string; short: boolean }> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), SHORT_LINK_TIMEOUT_MS);
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toWire(split)),
      signal: controller.signal,
    });
    if (res.ok) {
      const { id } = (await res.json()) as { id: string };
      if (typeof id === 'string' && /^[A-Za-z0-9]{6,16}$/.test(id)) {
        return { url: `${origin}/s/${id}`, short: true };
      }
    }
  } catch {
    // network error or timeout: fall through to the long link
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { url: `${origin}/split#${await encodeFragment(split)}`, short: false };
}

// ---------------------------------------------------------------------------
// Per-person item lines for the breakdown view
// ---------------------------------------------------------------------------

export interface DinerItemLine {
  name: string;
  amount: number; // cents this person pays for the item
  detail?: string; // how that amount was arrived at, when it isn't obvious
}

const fmt = (c: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * What one person had, phrased the way you'd explain it at the table:
 *   - "1 of 4 · $179.80 ÷ 4 = $44.95 each"  multi-quantity item, they had whole units
 *   - "Split 3 ways with Maya & Nora · $9.00 total"  one dish shared evenly
 *   - "Shared with Kenji · $14.00 total"  shared unevenly
 * Whole units are detected from the amounts, so "4 people split 4 menus evenly"
 * and "everyone got their own menu" both read as "1 of 4" (they cost the same).
 */
export function dinerItemLines(split: SharedSplit, dinerIdx: number): DinerItemLine[] {
  const lines: DinerItemLine[] = [];
  for (const item of split.items) {
    const mine = item.shares.find((s) => s.diner === dinerIdx);
    if (!mine) continue;
    const others = item.shares.filter((s) => s.diner !== dinerIdx);
    const otherNames = joinNames(others.map((s) => split.diners[s.diner]?.name ?? '?'));
    const q = item.quantity;
    let detail: string | undefined;

    if (q > 1) {
      const unit = item.amount / q;
      const units = Math.round(mine.amount / unit);
      const exact = Number.isInteger(unit);
      const each = `${exact ? '' : '≈'}${fmt(Math.round(unit))} each`;
      if (units >= 1 && Math.abs(mine.amount - units * unit) <= 1) {
        detail = units === q && others.length === 0
          ? `${q} × ${each}`
          : `${units} of ${q} · ${fmt(item.amount)} ÷ ${q} = ${each}`;
      } else {
        detail = `${others.length ? `Shared with ${otherNames} · ` : ''}${q} × ${each} = ${fmt(item.amount)}`;
      }
    } else if (others.length > 0) {
      const amounts = item.shares.map((s) => s.amount);
      const even = Math.max(...amounts) - Math.min(...amounts) <= 1;
      detail = `${even ? `Split ${item.shares.length} ways with` : 'Shared with'} ${otherNames} · ${fmt(item.amount)} total`;
    }

    lines.push({ name: item.name, amount: mine.amount, detail });
  }
  return lines;
}
