import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'AlphaTrade AI — Institutional Crypto Intelligence',
  description:
    '24/7 AI-powered crypto market analyst and trading assistant. Institutional-grade signals, technical analysis, and risk management.',
  openGraph: {
    title: 'AlphaTrade AI',
    description: 'Institutional-grade AI crypto trading intelligence, 24/7.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${mono.variable} font-sans antialiased`}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
