import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SharedSplit } from '@/lib/utils/share';
import { formatCurrency, formatDate } from '@/lib/utils/helpers';
import { personColor } from '@/lib/utils/person-color';

/*
 * Link-preview images (what iMessage, WhatsApp, Slack etc. show when a link
 * is pasted). Rendered with next/og at 1200×630 in the app's visual language:
 * the green check folder with a paper slip on it.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  folder: '#14322a',
  folderText: '#eaf0eb',
  folderMuted: '#a7bcb2',
  brass: '#d9b45b',
  paper: '#fbfaf6',
  ink: '#1f2622',
  muted: '#68716b',
  rule: '#c9c6ba',
};

const FONT_DIR = join(process.cwd(), 'lib/og/fonts');

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 600 | 700; style: 'normal' }[]> | null = null;

export function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, 'familjen-grotesk-latin-500-normal.woff')).then((data) => ({ name: 'Familjen Grotesk', data, weight: 500 as const, style: 'normal' as const })),
    readFile(join(FONT_DIR, 'familjen-grotesk-latin-700-normal.woff')).then((data) => ({ name: 'Familjen Grotesk', data, weight: 700 as const, style: 'normal' as const })),
    readFile(join(FONT_DIR, 'newsreader-latin-500-normal.woff')).then((data) => ({ name: 'Newsreader', data, weight: 500 as const, style: 'normal' as const })),
    readFile(join(FONT_DIR, 'jetbrains-mono-latin-600-normal.woff')).then((data) => ({ name: 'JetBrains Mono', data, weight: 600 as const, style: 'normal' as const })),
  ]);
  return fontsPromise;
}

const money = (cents: number) => formatCurrency(cents / 100);

function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 700, fontSize: size, color: C.folderText, letterSpacing: -0.5 }}>
      will<span style={{ color: C.brass }}>split</span>
    </div>
  );
}

/** Saw-tooth bottom edge of the paper slip. */
function TornEdge({ width, tooth = 18 }: { width: number; tooth?: number }) {
  const n = Math.ceil(width / tooth);
  const pts = ['0,0', `${width},0`];
  for (let i = n; i >= 0; i--) {
    const x = Math.min(i * tooth, width);
    pts.push(`${x},${i % 2 === 0 ? 0 : tooth * 0.6}`);
  }
  return (
    <svg width={width} height={tooth} viewBox={`0 0 ${width} ${tooth}`} style={{ display: 'flex' }}>
      <polygon points={pts.join(' ')} fill={C.paper} />
    </svg>
  );
}

function Slip({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width,
          background: C.paper,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          padding: '44px 52px 36px',
        }}
      >
        {children}
      </div>
      <TornEdge width={width} />
    </div>
  );
}

const SLIP_W = 1088;

/** Preview for a shared split: title, total, who paid, and who owes what. */
export function SplitCard({ split }: { split: SharedSplit }) {
  const payer = split.payer !== undefined ? split.diners[split.payer] : undefined;
  const rows = split.diners
    .map((d, index) => ({ d, index }))
    .filter(({ index, d }) => index !== split.payer && d.total > 0)
    .sort((a, b) => b.d.total - a.d.total);
  const shown = rows.slice(0, rows.length > 4 ? 3 : 4);
  const more = rows.length - shown.length;
  const people = `${split.diners.length} ${split.diners.length === 1 ? 'person' : 'people'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.folder, padding: '38px 56px 0' }}>
      <Wordmark />
      <div style={{ display: 'flex', marginTop: 24 }}>
        <Slip width={SLIP_W}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: 660 }}>
              <div style={{ display: 'flex', fontFamily: 'Newsreader', fontWeight: 500, fontSize: 68, color: C.ink, lineHeight: 1.05, letterSpacing: -1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {split.title}
              </div>
              <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 27, color: C.muted, marginTop: 12 }}>
                {`${formatDate(split.date)} · ${people}`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 24, color: C.muted }}>Total</div>
              <div style={{ display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 62, color: C.ink, letterSpacing: -2 }}>{money(split.total)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: `2px dashed ${C.rule}`, marginTop: 30, marginBottom: 24 }} />

          <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 29, color: C.muted, marginBottom: 12 }}>
            {payer ? (
              <span style={{ display: 'flex' }}>
                <span style={{ color: C.ink, fontWeight: 700, marginRight: 7 }}>{payer.name}</span>paid. Here&apos;s who owes them:
              </span>
            ) : (
              'What each person owes:'
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {shown.map(({ d, index }) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', width: 465, height: 62 }}>
                <div style={{ display: 'flex', width: 20, height: 20, borderRadius: 10, background: personColor(index), marginRight: 14 }} />
                <div style={{ display: 'flex', flex: 1, fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 34, color: C.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {d.name}
                </div>
                <div style={{ display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 34, color: C.ink, letterSpacing: -1 }}>{money(d.total)}</div>
              </div>
            ))}
            {more > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', width: 465, height: 62, fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 32, color: C.muted }}>
                {`+ ${more} more`}
              </div>
            )}
          </div>
        </Slip>
      </div>
    </div>
  );
}

/** Generic preview for the site itself (and for links whose split can't be read). */
export function BrandCard() {
  const sample = [
    { name: 'Maya', amount: '$64.20', index: 1 },
    { name: 'Nora', amount: '$58.75', index: 2 },
    { name: 'Kenji', amount: '$55.10', index: 3 },
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: C.folder, padding: '56px 64px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 560 }}>
        <Wordmark size={40} />
        <div style={{ display: 'flex', fontFamily: 'Newsreader', fontWeight: 500, fontSize: 76, color: C.folderText, lineHeight: 1.02, letterSpacing: -1.5, marginTop: 56 }}>
          Split the check without the math.
        </div>
        <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 28, color: C.folderMuted, marginTop: 26, lineHeight: 1.3 }}>
          Tap who had what. Everyone gets a link with what they owe.
        </div>
      </div>
      <div style={{ display: 'flex', marginLeft: 'auto', marginTop: 62 }}>
        <Slip width={450}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontWeight: 500, fontSize: 30, color: C.ink, whiteSpace: 'nowrap' }}>Friday Dinner</div>
            <div style={{ display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 28, color: C.ink }}>$286.40</div>
          </div>
          <div style={{ display: 'flex', borderTop: `2px dashed ${C.rule}`, marginTop: 18, marginBottom: 14 }} />
          <div style={{ display: 'flex', fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 22, color: C.muted, marginBottom: 6 }}>
            <span style={{ color: C.ink, fontWeight: 700, marginRight: 6 }}>Theo</span>paid. Settle up:
          </div>
          {sample.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', height: 44 }}>
              <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: personColor(r.index), marginRight: 12 }} />
              <div style={{ display: 'flex', flex: 1, fontFamily: 'Familjen Grotesk', fontWeight: 500, fontSize: 24, color: C.ink }}>{r.name}</div>
              <div style={{ display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 24, color: C.ink }}>{r.amount}</div>
            </div>
          ))}
        </Slip>
      </div>
    </div>
  );
}
