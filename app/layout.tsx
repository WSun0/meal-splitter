import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Will's Meal Splitting Tool",
  description: "Calculate how much each diner owes for a shared meal",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}
