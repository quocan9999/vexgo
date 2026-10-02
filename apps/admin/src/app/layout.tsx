import type { Metadata } from 'next';
import './globals.css';
import '@/styles/admin-components.css';
import '@/features/super-admin-dashboard/dashboard.css';
import '@/features/bus-companies/bus-companies.css';
import '@/features/admin-auth/admin-auth.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'VexGo | Super Admin',
  description: 'Tổng quan quản trị nền tảng VexGo',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // Browser extensions may add classes (e.g. mdl-js) before hydration.
    // Limit suppression to html attributes; descendants still report mismatches.
    <html
      lang="vi"
      className={cn('font-sans', geist.variable)}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
