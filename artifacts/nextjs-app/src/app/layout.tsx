import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jima | CARAVAN Lounge Operations',
  description: 'Premium hospitality management workspace for CARAVAN Lounge, powered by Idata Technologies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-cream-100 text-coffee-800 selection:bg-teal-200 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
