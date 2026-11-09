import { ImageResponse } from 'next/og';
import { BrandCard, OG_SIZE, loadFonts } from '@/lib/og/cards';

export const runtime = 'nodejs';
export const alt = 'willsplit: split the check without the math';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(<BrandCard />, { ...OG_SIZE, fonts: await loadFonts() });
}
