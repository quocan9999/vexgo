import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { DemoSessionProvider } from '@/features/auth/demo-session';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'VexGo — Đặt vé xe khách',
  description: 'Tìm chuyến, chọn ghế, thanh toán và gửi hàng cùng VexGo.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={cn('font-sans', geist.variable)}>
      <body><DemoSessionProvider>{children}</DemoSessionProvider></body>
    </html>
  );
}
