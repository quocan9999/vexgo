// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FarePriceFormDialog } from '../src/features/fare-prices/components/fare-price-form-dialog';
import { PromotionFormDialog } from '../src/features/promotions/components/promotion-form-dialog';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/fare-prices',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock permissions hook
vi.mock('@/features/admin-auth/hooks/use-admin-permissions', () => ({
  useAdminPermissions: () => ({
    can: () => true,
    hasAny: () => true,
    hasAll: () => true,
    user: { id: 1, role: 'SUPER_ADMIN' },
  }),
}));

// Mock admin session
vi.mock('@/features/admin-auth/hooks/use-admin-session', () => ({
  useAdminSession: () => ({
    status: 'authenticated',
    session: {
      accountId: 1,
      user: { id: 1, username: 'admin', role: 'SUPER_ADMIN' },
      roles: ['SUPER_ADMIN'],
      busCompanyId: 10,
      permissions: ['fare-price:create', 'fare-price:update', 'promotion:create', 'promotion:update'],
    },
  }),
}));

// Mock services
vi.mock('../src/features/fare-prices/services/fare-price-service', () => ({
  createFarePrice: vi.fn(),
  updateFarePrice: vi.fn(),
  getFarePriceById: vi.fn(),
  getFarePriceRouteOptions: () => Promise.resolve([{ id: 1, label: 'Sai Gon - Da Lat' }]),
  getFarePriceVehicleTypeOptions: () => Promise.resolve([{ id: 1, label: 'Limousine 34' }]),
  FarePriceApiError: class extends Error {
    code?: string;
    details: { field: string; message: string }[];
    constructor(message: string, code?: string, details = []) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock('../src/features/promotions/services/promotion-service', () => ({
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  getPromotionById: vi.fn(),
  PromotionApiError: class extends Error {
    code?: string;
    details: { field: string; message: string }[];
    constructor(message: string, code?: string, details = []) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

const VIETNAMESE_DIACRITICS_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe('Phase 4: Commercial, Bookings & Customers Zero-Hardcoded-Vi Assertion Suite', () => {
  describe('Layer 1: Static Source Code Scanner (Phase 4 Commercial & Customers Files)', () => {
    const phase4Files = [
      'src/app/[locale]/booking-management/page.tsx',
      'src/features/booking-management/components/booking-management.tsx',
      'src/features/booking-management/components/booking-management-detail.tsx',
      'src/features/booking-management/services/booking-management-format.ts',
      'src/features/booking-management/services/booking-management-query.ts',
      'src/features/booking-management/services/booking-management-service.ts',
      'src/features/fare-prices/services/fare-price-service.ts',
      'src/features/fare-prices/hooks/use-fare-prices.ts',
      'src/features/fare-prices/components/fare-prices-management.tsx',
      'src/features/fare-prices/components/fare-price-workspace.tsx',
      'src/features/fare-prices/components/fare-price-form-dialog.tsx',
      'src/features/promotions/services/promotion-service.ts',
      'src/features/promotions/hooks/use-promotions.ts',
      'src/features/promotions/components/promotions-management.tsx',
      'src/features/promotions/components/promotion-form-dialog.tsx',
      'src/features/customers/services/customer-service.ts',
      'src/features/customers/hooks/use-customers.ts',
      'src/features/customers/hooks/use-customer-tickets.ts',
      'src/features/customers/hooks/use-customer-shipments.ts',
      'src/features/customers/hooks/use-customer-transactions.ts',
      'src/features/customers/components/customers-management.tsx',
      'src/features/customers/components/customer-workspace.tsx',
      'src/features/customers/components/customer-tickets-tab.tsx',
      'src/features/customers/components/customer-shipments-tab.tsx',
      'src/features/customers/components/customer-transactions-tab.tsx',
    ];

    for (const relativePath of phase4Files) {
      it(`must contain zero hardcoded Vietnamese strings in ${relativePath}`, () => {
        const fullPath = path.resolve(__dirname, '..', relativePath);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const violations: { line: number; text: string }[] = [];

        lines.forEach((line, index) => {
          if (VIETNAMESE_DIACRITICS_REGEX.test(line)) {
            violations.push({ line: index + 1, text: line.trim() });
          }
        });

        if (violations.length > 0) {
          const detail = violations
            .map((v) => `  L${v.line}: ${v.text}`)
            .join('\n');
          expect.fail(
            `Found ${violations.length} hardcoded Vietnamese occurrences in ${relativePath}:\n${detail}`,
          );
        }

        expect(violations).toHaveLength(0);
      });
    }
  });

  describe('Layer 2: Runtime DOM Scanner in English Locale', () => {
    it('renders FarePriceFormDialog in English without any Vietnamese diacritics', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <FarePriceFormDialog
            onClose={vi.fn()}
            onRetryRouteOptions={vi.fn()}
            onRetryVehicleTypeOptions={vi.fn()}
            onSaved={vi.fn()}
            routeOptions={{
              status: 'success',
              options: [{ id: 1, label: 'Sai Gon - Da Lat' }],
            }}
            vehicleTypeOptions={{
              status: 'success',
              options: [{ id: 1, label: 'Limousine 34' }],
            }}
          />
        </NextIntlClientProvider>,
      );

      const text = document.body.textContent || '';
      expect(text.length).toBeGreaterThan(0);
      expect(VIETNAMESE_DIACRITICS_REGEX.test(text)).toBe(false);
    });

    it('renders PromotionFormDialog in English without any Vietnamese diacritics', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <PromotionFormDialog
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        </NextIntlClientProvider>,
      );

      const text = document.body.textContent || '';
      expect(text.length).toBeGreaterThan(0);
      expect(VIETNAMESE_DIACRITICS_REGEX.test(text)).toBe(false);
    });
  });

  describe('Layer 3: Symmetrical Dictionary Validation (Phase 4 Namespaces)', () => {
    const namespaces = ['bookings', 'farePrices', 'promotions', 'customers'] as const;

    for (const ns of namespaces) {
      it(`ensures all keys in vi.${ns} exist in en.${ns}`, () => {
        const viNs = (viMessages as Record<string, any>)[ns] || {};
        const enNs = (enMessages as Record<string, any>)[ns] || {};

        function checkKeys(viObj: any, enObj: any, prefix = '') {
          for (const key of Object.keys(viObj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            expect(enObj).toHaveProperty(key);
            if (typeof viObj[key] === 'object' && viObj[key] !== null) {
              checkKeys(viObj[key], enObj[key], fullKey);
            }
          }
        }

        checkKeys(viNs, enNs);
      });

      it(`ensures all keys in en.${ns} exist in vi.${ns}`, () => {
        const viNs = (viMessages as Record<string, any>)[ns] || {};
        const enNs = (enMessages as Record<string, any>)[ns] || {};

        function checkKeys(enObj: any, viObj: any, prefix = '') {
          for (const key of Object.keys(enObj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            expect(viObj).toHaveProperty(key);
            if (typeof enObj[key] === 'object' && enObj[key] !== null) {
              checkKeys(enObj[key], viObj[key], fullKey);
            }
          }
        }

        checkKeys(enNs, viNs);
      });
    }
  });
});
