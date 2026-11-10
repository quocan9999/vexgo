import type { Metadata } from 'next';
import './globals.css';
import '@/styles/admin-components.css';
import '@/features/admin-auth/admin-auth.css';
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
});
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

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
      className={cn('font-sans admin-ui', plusJakartaSans.variable, inter.variable, jetBrainsMono.variable)}
      suppressHydrationWarning
    >
      <body className="admin-ui min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
