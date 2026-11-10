// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/account/profile',
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
      accountId: 1,
      name: 'Nguyễn Văn A',
      phone: '0900000001',
      email: 'vana@vexgo.test',
      role: 'CUSTOMER',
      membershipTier: 'VANG',
      points: 1250,
    },
    accessToken: 'test-token',
    isAuthenticated: true,
    isHydrated: true,
    executeWithAuth: vi.fn(async (cb) => cb('test-token')),
    logout: vi.fn(),
  }),
}));

vi.mock('@/features/account/services/customer-tickets.api', () => ({
  customerTicketsApi: {
    getCustomerTickets: vi.fn(async () => ({
      data: [
        {
          id: 'ticket-1',
          code: 'VG-888999',
          trip: {
            from: 'Hà Nội',
            to: 'Hải Phòng',
            departureTime: '2026-11-20T08:00:00Z',
            busCompany: 'Hải Âu',
          },
          seats: ['A1', 'A2'],
          totalPrice: 240000,
          status: 'DA_XAC_NHAN',
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    })),
  },
}));

vi.mock('@/features/loyalty/services/loyalty.api', () => ({
  loyaltyApi: {
    getLoyaltySummary: vi.fn(async () => ({
      tier: 'VANG',
      points: 1250,
      nextTierThreshold: 2000,
      progressPercent: 62.5,
      transactions: [
        {
          id: 1,
          type: 'CONG_DIEM',
          points: 50,
          description: 'Tích điểm chuyến đi Hà Nội - Hải Phòng',
          createdAt: '2026-11-01T10:00:00Z',
        },
      ],
    })),
  },
}));

import { ProfileSidebar } from '@/features/account/components/profile-sidebar';
import CustomerActivityPage from '@/features/account/components/customer-activity-page';
import { PasswordForm } from '@/features/account/components/password-form';
import LoyaltyPage from '@/features/loyalty/components/loyalty-page';

describe('Customer Account, Auth & Loyalty Deep i18n (Phase C3)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('guarantees 100% key parity for auth, account, loyalty, and chat namespaces', () => {
    const namespaces = ['auth', 'account', 'loyalty', 'chat'] as const;

    for (const ns of namespaces) {
      const viNs = viMessages[ns as keyof typeof viMessages] as Record<string, unknown>;
      const enNs = enMessages[ns as keyof typeof enMessages] as Record<string, unknown>;

      expect(viNs).toBeDefined();
      expect(enNs).toBeDefined();

      const getKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
        let keys: string[] = [];
        for (const k in obj) {
          const full = prefix ? `${prefix}.${k}` : k;
          const val = obj[k];
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            keys = keys.concat(getKeys(val as Record<string, unknown>, full));
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

  it('renders ProfileSidebar in Vietnamese when locale is vi', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <ProfileSidebar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Thông tin tài khoản')).toBeTruthy();
    expect(screen.getByText('Vé của tôi')).toBeTruthy();
    expect(screen.getByText('Đơn gửi hàng')).toBeTruthy();
    expect(screen.getByText('Đặt lại mật khẩu')).toBeTruthy();
    expect(screen.getByText('Đăng xuất')).toBeTruthy();
  });

  it('renders ProfileSidebar in English when locale is en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ProfileSidebar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Account Profile')).toBeTruthy();
    expect(screen.getByText('My Tickets')).toBeTruthy();
    expect(screen.getByText('My Shipments')).toBeTruthy();
    expect(screen.getByText('Reset Password')).toBeTruthy();
    expect(screen.getByText('Log Out')).toBeTruthy();
  });

  it('renders CustomerActivityPage ticket filter tabs in Vietnamese', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <CustomerActivityPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Lịch sử mua vé')).toBeTruthy();
    expect(screen.getByText('Tất cả')).toBeTruthy();
    expect(screen.getByText('Sắp khởi hành')).toBeTruthy();
    expect(screen.getByText('Lịch sử chuyến')).toBeTruthy();
    expect(screen.getByText('Đặt vé mới')).toBeTruthy();
  });

  it('renders CustomerActivityPage ticket filter tabs in English', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CustomerActivityPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Ticket Purchase History')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('Past trips')).toBeTruthy();
    expect(screen.getByText('Book New Ticket')).toBeTruthy();
  });

  it('renders PasswordForm with bilingual labels and instructions', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PasswordForm />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/Mật khẩu cũ/)).toBeTruthy();
    expect(screen.getByText(/Mật khẩu mới/)).toBeTruthy();
    expect(screen.getByText(/Xác nhận mật khẩu/)).toBeTruthy();
    expect(screen.getByText('Hủy')).toBeTruthy();
    expect(screen.getByText('Xác nhận')).toBeTruthy();

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PasswordForm />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/Current Password/)).toBeTruthy();
    expect(screen.getByText(/New Password/)).toBeTruthy();
    expect(screen.getByText(/Confirm Password/)).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('renders LoyaltyPage in Vietnamese and English', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <LoyaltyPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Tiến trình thăng hạng')).toBeTruthy();
    expect(screen.getByText('Lịch sử điểm thưởng')).toBeTruthy();
    expect(screen.getByText('Đặc quyền hạng Vàng')).toBeTruthy();

    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LoyaltyPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Tier Progress')).toBeTruthy();
    expect(screen.getByText('Reward Points History')).toBeTruthy();
    expect(screen.getByText('Gold Tier Privileges')).toBeTruthy();
  });
});
