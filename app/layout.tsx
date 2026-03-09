import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Impact — Asteroid Idle Game',
  description: 'Build your asteroid from a rock to a black hole.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-space text-white min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
