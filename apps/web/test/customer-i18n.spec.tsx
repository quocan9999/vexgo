// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace }),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => ({
    user: null,
    signOut: vi.fn(),
  }),
}));

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { HeroSection } from '@/features/home/components/hero-section';

describe('Customer i18n Dictionary & Layout Components', () => {
  beforeEach(() => {
    cleanup();
    state.pathname = '/';
    replace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('dictionary parity', () => {
    it('has all required top-level namespaces in both vi and en', () => {
      const viKeys = Object.keys(viMessages).sort();
      const enKeys = Object.keys(enMessages).sort();
      expect(viKeys).toEqual(enKeys);
    });

    it('has matching keys in header namespace', () => {
      const viHeader = Object.keys(viMessages.header).sort();
      const enHeader = Object.keys(enMessages.header).sort();
      expect(viHeader).toEqual(enHeader);
    });

    it('has matching keys in footer namespace', () => {
      const viFooter = Object.keys(viMessages.footer).sort();
      const enFooter = Object.keys(enMessages.footer).sort();
      expect(viFooter).toEqual(enFooter);
    });
  });

  describe('CustomerHeader translations', () => {
    it('renders header labels in Vietnamese when locale is vi', () => {
      state.pathname = '/vi';
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <CustomerHeader />
        </NextIntlClientProvider>,
      );

      expect(screen.getAllByText('Trang chủ')[0]).toBeTruthy();
      expect(screen.getAllByText('Gửi hàng')[0]).toBeTruthy();
      expect(screen.getAllByText('Khuyến mãi')[0]).toBeTruthy();
      expect(screen.getAllByText('Tin tức')[0]).toBeTruthy();
      expect(screen.getAllByText('Hủy vé')[0]).toBeTruthy();
      expect(screen.getAllByText('Liên hệ')[0]).toBeTruthy();
      expect(screen.getByText('Tra cứu')).toBeTruthy();
      expect(screen.getAllByText('Đăng nhập')[0]).toBeTruthy();
    });

    it('renders header labels in English when locale is en', () => {
      state.pathname = '/en';
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CustomerHeader />
        </NextIntlClientProvider>,
      );

      expect(screen.getAllByText('Home')[0]).toBeTruthy();
      expect(screen.getAllByText('Send Freight')[0]).toBeTruthy();
      expect(screen.getAllByText('Promotions')[0]).toBeTruthy();
      expect(screen.getAllByText('News')[0]).toBeTruthy();
      expect(screen.getAllByText('Cancel Ticket')[0]).toBeTruthy();
      expect(screen.getAllByText('Contact')[0]).toBeTruthy();
      expect(screen.getByText('Lookup')).toBeTruthy();
      expect(screen.getAllByText('Log In')[0]).toBeTruthy();
    });
  });

  describe('CustomerFooter translations', () => {
    it('renders footer labels in Vietnamese when locale is vi', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <CustomerFooter />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Dịch vụ')).toBeTruthy();
      expect(screen.getByText('Liên kết hữu ích')).toBeTruthy();
      expect(screen.getByText('Trụ sở hoạt động')).toBeTruthy();
    });

    it('renders footer labels in English when locale is en', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CustomerFooter />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Services')).toBeTruthy();
      expect(screen.getByText('Useful Links')).toBeTruthy();
      expect(screen.getByText('Headquarters')).toBeTruthy();
    });
  });

  describe('HeroSection translations', () => {
    it('renders search form labels in Vietnamese when locale is vi', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <HeroSection
            activeSearchTab="BUY"
            setActiveSearchTab={vi.fn()}
            selectedProvince="Hà Nội"
            setSelectedProvince={vi.fn()}
            selectedDistrict="Hải Phòng"
            setSelectedDistrict={vi.fn()}
            selectedType=""
            setSelectedType={vi.fn()}
            selectedPrice=""
            setSelectedPrice={vi.fn()}
          />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Đặt vé')).toBeTruthy();
      expect(screen.getByText('Gửi hàng')).toBeTruthy();
      expect(screen.getByText('Một chiều')).toBeTruthy();
      expect(screen.getByText('Khứ hồi')).toBeTruthy();
      expect(screen.getByText('Điểm đi')).toBeTruthy();
      expect(screen.getByText('Điểm đến')).toBeTruthy();
      expect(screen.getByText('Ngày đi')).toBeTruthy();
      expect(screen.getByText('Số ghế')).toBeTruthy();
      expect(screen.getByText('Tìm chuyến')).toBeTruthy();
    });

    it('renders search form labels in English when locale is en', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <HeroSection
            activeSearchTab="BUY"
            setActiveSearchTab={vi.fn()}
            selectedProvince="Hà Nội"
            setSelectedProvince={vi.fn()}
            selectedDistrict="Hải Phòng"
            setSelectedDistrict={vi.fn()}
            selectedType=""
            setSelectedType={vi.fn()}
            selectedPrice=""
            setSelectedPrice={vi.fn()}
          />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Book Tickets')).toBeTruthy();
      expect(screen.getByText('Send Freight')).toBeTruthy();
      expect(screen.getByText('One-way')).toBeTruthy();
      expect(screen.getByText('Round-trip')).toBeTruthy();
      expect(screen.getByText('Departure')).toBeTruthy();
      expect(screen.getByText('Destination')).toBeTruthy();
      expect(screen.getByText('Departure Date')).toBeTruthy();
      expect(screen.getByText('Tickets')).toBeTruthy();
      expect(screen.getByText('Find Trips')).toBeTruthy();
    });
  });
});

