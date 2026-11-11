// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/payment',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import {
  getShipmentPaymentStatusPresentation,
  PaymentPriceBreakdownRows,
} from '@/features/payments/components/payment-page';

describe('Payments Deep i18n & Zero-Hardcoded-Vi (Phase R1)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('guarantees 100% key parity for payments namespace between vi and en dictionaries', () => {
    const viKeys = Object.keys(viMessages.payments || {}).sort();
    const enKeys = Object.keys(enMessages.payments || {}).sort();

    expect(viKeys.length).toBeGreaterThan(25);
    expect(enKeys.length).toBeGreaterThan(25);

    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

    expect(missingInEn, 'Missing keys in en for payments').toEqual([]);
    expect(missingInVi, 'Missing keys in vi for payments').toEqual([]);
  });

  it('translates payment status presentation according to locale', () => {
    // English
    expect(getShipmentPaymentStatusPresentation(true, 'paid', 'en').label).toBe('Paid');
    expect(getShipmentPaymentStatusPresentation(true, 'cancelled', 'en').label).toBe('Cancelled');
    expect(getShipmentPaymentStatusPresentation(true, 'expired', 'en').label).toBe('Expired');
    expect(getShipmentPaymentStatusPresentation(true, 'failed', 'en').label).toBe('Payment Failed');
    expect(getShipmentPaymentStatusPresentation(true, 'reconciliation-required', 'en').label).toBe('Needs Reconciliation');
    expect(getShipmentPaymentStatusPresentation(true, null, 'en').label).toBe('Pending Payment');
    expect(getShipmentPaymentStatusPresentation(false, null, 'en').label).toBe('Verifying');

    // Vietnamese
    expect(getShipmentPaymentStatusPresentation(true, 'paid', 'vi').label).toBe('Đã thanh toán');
    expect(getShipmentPaymentStatusPresentation(true, 'cancelled', 'vi').label).toBe('Đã hủy');
    expect(getShipmentPaymentStatusPresentation(true, 'expired', 'vi').label).toBe('Hết hạn');
    expect(getShipmentPaymentStatusPresentation(true, 'failed', 'vi').label).toBe('Thanh toán thất bại');
    expect(getShipmentPaymentStatusPresentation(true, 'reconciliation-required', 'vi').label).toBe('Cần đối soát');
    expect(getShipmentPaymentStatusPresentation(true, null, 'vi').label).toBe('Chờ thanh toán');
    expect(getShipmentPaymentStatusPresentation(false, null, 'vi').label).toBe('Đang xác minh');
  });

  it('renders PaymentPriceBreakdownRows in English with zero hardcoded Vietnamese', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PaymentPriceBreakdownRows
          originalTicketSubtotal={300000}
          discountAmount={50000}
          promotionCode="DISCOUNT50K"
          ticketSubtotal={250000}
          totalAmount={250000}
          hasVerifiedPaymentAmount={true}
          showCargoFee={true}
          cargoFeeText="30,000 VND"
          cargoFeeClassName="text-red-600"
          formatConfirmedAmount={(amt) => `${amt?.toLocaleString('en-US')} VND`}
          showTotal={true}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Original Fare')).toBeTruthy();
    expect(screen.getByText('Discount Code')).toBeTruthy();
    expect(screen.getByText('DISCOUNT50K')).toBeTruthy();
    expect(screen.getByText('Discount')).toBeTruthy();
    expect(screen.getByText('Fare after discount')).toBeTruthy();
    expect(screen.getByText('Cargo Fee')).toBeTruthy();
    expect(screen.getByText('Total Payable')).toBeTruthy();
    expect(screen.getByText('(Pay at station upon drop-off, not added to ticket fare)')).toBeTruthy();

    // ZERO-HARDCODED-VI ASSERTION
    const text = container.textContent || '';
    expect(text).not.toContain('Giá vé gốc');
    expect(text).not.toContain('Mã khuyến mãi');
    expect(text).not.toContain('Giảm giá');
    expect(text).not.toContain('Tổng tiền vé sau ưu đãi');
    expect(text).not.toContain('Cước hàng');
    expect(text).not.toContain('Tổng thanh toán');
    expect(text).not.toContain('Thanh toán tại bến');
  });

  it('renders PaymentPriceBreakdownRows in Vietnamese correctly', () => {
    const { container } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PaymentPriceBreakdownRows
          originalTicketSubtotal={300000}
          discountAmount={50000}
          promotionCode="DISCOUNT50K"
          ticketSubtotal={250000}
          totalAmount={250000}
          hasVerifiedPaymentAmount={true}
          showCargoFee={true}
          cargoFeeText="30.000đ"
          cargoFeeClassName="text-red-600"
          formatConfirmedAmount={(amt) => `${amt?.toLocaleString('vi-VN')}đ`}
          showTotal={true}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Giá vé gốc')).toBeTruthy();
    expect(screen.getByText('Mã khuyến mãi')).toBeTruthy();
    expect(screen.getByText('Giảm giá')).toBeTruthy();
    expect(screen.getByText('Tổng tiền vé sau ưu đãi')).toBeTruthy();
    expect(screen.getByText('Cước hàng')).toBeTruthy();
    expect(screen.getByText('Tổng thanh toán')).toBeTruthy();
    expect(screen.getByText('(Thanh toán tại bến khi gửi, không cộng vào tiền vé)')).toBeTruthy();
  });
});
