import { ImageResponse } from 'next/og';
import { getSharedSplit } from '@/lib/server/share-cache';
import { BrandCard, OG_SIZE, SplitCard, loadFonts } from '@/lib/og/cards';

export const runtime = 'nodejs';
export const alt = 'Who owes what for this meal';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const split = await getSharedSplit((await params).id);
  return new ImageResponse(split ? <SplitCard split={split} /> : <BrandCard />, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: {
      // Shares never change; let chat apps and the CDN keep the image.
      'Cache-Control': split ? 'public, max-age=86400, s-maxage=2592000, immutable' : 'public, max-age=300',
    },
  });
}
