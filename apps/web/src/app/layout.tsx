import type { Metadata } from 'next';
import './globals.css';
import { DemoSessionProvider } from '@/features/auth/demo-session';

export const metadata: Metadata = {
  title: 'VexGo — Đặt vé xe khách',
  description: 'Tìm chuyến, chọn ghế, thanh toán và gửi hàng cùng VexGo.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white font-sans text-slate-900"><DemoSessionProvider>{children}</DemoSessionProvider></body>
    </html>
  );
}
