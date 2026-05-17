import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AppProvider } from '@/lib/provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Money Purse',
  description: 'An intelligent app to track your monthly expenses.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0e14" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Cpath d='M0 0 H80 V20 L60 20 V80 L80 80 V100 H0 V0 Z' fill='%23c5a059'/%3E%3Cpath d='M0 0 H60 L20 20 H0 V0 Z' fill='%23d4b06b'/%3E%3Cpath d='M0 100 H60 L20 80 H0 V100 Z' fill='%234ade80'/%3E%3Cpath d='M60 20 L80 20 V80 L60 80 L60 20 Z' fill='%23FFA500'/%3E%3Cpath d='M85 20 L160 20 V100 L140 100 L85 20 Z' fill='%23FF1493'/%3E%3Cpath d='M85 20 L140 100 L120 100 L85 45 V20 Z' fill='%23C71585'/%3E%3C/svg%3E" type="image/svg+xml" />
        {/* Manually including manifest with use-credentials to bypass Workstation CORS policy */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <AppProvider>
          {children}
        </AppProvider>
        <Toaster />
      </body>
    </html>
  );
}
