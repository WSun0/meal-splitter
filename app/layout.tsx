import type { Metadata, Viewport } from "next";
import "./globals.css";

// Absolute base for link-preview image URLs. Override with SITE_URL if the
// domain changes; preview deployments use their own URL.
const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_ENV === 'production'
    ? 'https://willsplit.vercel.app'
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Meal Splitter",
  description: "Calculate how much each diner owes for a shared meal",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meal Splitter',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    siteName: 'willsplit',
    title: 'willsplit',
    description: 'Split the check without the math. Everyone gets a link with what they owe.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#14322a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
