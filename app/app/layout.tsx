import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Impact — Asteroid Idle Game',
  description: 'Build your asteroid from a rock to a black hole.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-space text-white overflow-hidden overscroll-none" style={{height: '100dvh'}}>
        {children}
      </body>
    </html>
  );
}
