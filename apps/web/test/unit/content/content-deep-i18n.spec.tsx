// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/promotions',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => ({
    user: {
      id: 1,
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0900000001',
      email: 'vana@vexgo.test',
      role: 'CUSTOMER',
    },
    accessToken: 'test-token',
    isAuthenticated: true,
    isHydrated: true,
    executeWithAuth: vi.fn(async (cb) => cb('test-token')),
  }),
}));

import { PromotionsListPage } from '@/features/promotions/components/promotions-list-page';
import { NewsListPage } from '@/features/news/components/news-list-page';
import { DonationPage } from '@/features/donation/components/donation-page';
import { AboutPageContent } from '@/features/content/components/about-page';
import { ContactPageContent } from '@/features/content/components/contact-page';

describe('Customer Promotions, News, Donation & Content Deep i18n (Phase C4)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('guarantees 100% key parity for promotions, news, donation, invoice, and content namespaces', () => {
    const namespaces = ['promotions', 'news', 'donation', 'invoice', 'content'] as const;

    for (const ns of namespaces) {
      const viNs = viMessages[ns as keyof typeof viMessages] as Record<string, any>;
      const enNs = enMessages[ns as keyof typeof enMessages] as Record<string, any>;

      expect(viNs, `vi namespace ${ns} should exist`).toBeDefined();
      expect(enNs, `en namespace ${ns} should exist`).toBeDefined();

      const getKeys = (obj: Record<string, any>, prefix = ''): string[] => {
        let keys: string[] = [];
        for (const k in obj) {
          const full = prefix ? `${prefix}.${k}` : k;
          if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            keys = keys.concat(getKeys(obj[k], full));
          } else {
            keys.push(full);
          }
        }
        return keys;
      };

      const viKeys = getKeys(viNs).sort();
      const enKeys = getKeys(enNs).sort();

      expect(viKeys.length).toBeGreaterThan(0);
      expect(enKeys.length).toBeGreaterThan(0);

      const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
      const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

      expect(missingInEn, `Missing keys in en for namespace: ${ns}`).toEqual([]);
      expect(missingInVi, `Missing keys in vi for namespace: ${ns}`).toEqual([]);
    }
  });

  it('renders PromotionsListPage in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PromotionsListPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Tất cả ưu đãi')).toBeTruthy();
    expect(screen.getByText('Chương trình khuyến mãi nổi bật')).toBeTruthy();
    expect(screen.getAllByText('Mã giảm giá:').length).toBeGreaterThan(0);

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PromotionsListPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('All Promotions')).toBeTruthy();
    expect(screen.getByText('Featured Promotions & Discounts')).toBeTruthy();
    expect(screen.getAllByText('Discount Code:').length).toBeGreaterThan(0);
  });

  it('renders NewsListPage in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <NewsListPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Tất cả tin tức')).toBeTruthy();
    expect(screen.getByText('Tin tức & Cẩm nang xe khách')).toBeTruthy();
    expect(screen.getByText('Đọc toàn bộ bài viết')).toBeTruthy();

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NewsListPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('All News')).toBeTruthy();
    expect(screen.getByText('News & Travel Guides')).toBeTruthy();
    expect(screen.getByText('Read Full Article')).toBeTruthy();
  });

  it('renders DonationPage in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <DonationPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Thông Tin Thanh Toán Chuyển Khoản')).toBeTruthy();
    expect(screen.getByText('Tài Khoản Số 1 (Vietcombank)')).toBeTruthy();
    expect(screen.getAllByText('Chủ tài khoản:').length).toBeGreaterThan(0);

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DonationPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Bank Transfer & Payment Information')).toBeTruthy();
    expect(screen.getByText('Account No. 1 (Vietcombank)')).toBeTruthy();
    expect(screen.getAllByText('Account Holder:').length).toBeGreaterThan(0);
  });

  it('renders AboutPageContent in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <AboutPageContent />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByText(/Hệ Thống Đặt Vé Xe Khách/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trực Tuyến').length).toBeGreaterThan(0);
    expect(screen.getByText('Giá Trị Nền Tảng')).toBeTruthy();
    expect(screen.getByText('Khách hàng')).toBeTruthy();

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AboutPageContent />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByText(/Online Bus Ticket Booking/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    expect(screen.getByText('Core Foundation Values')).toBeTruthy();
    expect(screen.getByText('Customers')).toBeTruthy();
  });

  it('renders ContactPageContent in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <ContactPageContent />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Liên Hệ Hỗ Trợ Khách Hàng')).toBeTruthy();
    expect(screen.getByText('Thông Tin Liên Hệ')).toBeTruthy();
    expect(screen.getByText('Gửi yêu cầu')).toBeTruthy();

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ContactPageContent />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Customer Support Contact')).toBeTruthy();
    expect(screen.getByText('Contact Information')).toBeTruthy();
    expect(screen.getByText('Submit Request')).toBeTruthy();
  });
});
