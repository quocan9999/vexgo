// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CreateBusCompanyDialog } from '../src/features/bus-companies/components/create-bus-company-dialog';
import { LuggagePackagesManagement } from '../src/features/shipments/components/luggage-packages-management';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/bus-companies',
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
      permissions: ['bus-company:create', 'bus-company:update', 'shipment:create', 'shipment:update'],
    },
  }),
}));

// Mock luggage rate service
vi.mock('../src/features/shipments/services/luggage-rate-service', () => ({
  getBusCompanyLuggageRates: () =>
    Promise.resolve({
      default: {
        packageS: 50000,
        packageSMaxKg: 5,
        packageM: 80000,
        packageMMaxKg: 10,
        packageL: 120000,
        packageLMaxKg: 20,
        packageXL: 180000,
        packageXLMaxKg: 35,
        motorcycleWave: 180000,
        motorcycleScooter: 220000,
        motorcycleBig: 250000,
        bicycle: 80000,
        fragileSurcharge: 20000,
        valuableSurcharge: 50000,
        maxFreeWeightKg: 7,
      },
      routes: {},
      availableRoutes: [
        {
          routeId: 101,
          origin: 'HCMC',
          destination: 'Da Lat',
          code: 'SG-DL',
          hasOverride: false,
        },
      ],
    }),
  updateBusCompanyLuggageRates: vi.fn(),
  DEFAULT_VEXGO_LUGGAGE_RATES: {
    packageS: 50000,
    packageSMaxKg: 5,
    packageM: 80000,
    packageMMaxKg: 10,
    packageL: 120000,
    packageLMaxKg: 20,
    packageXL: 180000,
    packageXLMaxKg: 35,
    motorcycleWave: 180000,
    motorcycleScooter: 220000,
    motorcycleBig: 250000,
    bicycle: 80000,
    fragileSurcharge: 20000,
    valuableSurcharge: 50000,
    maxFreeWeightKg: 7,
  },
}));

const VIETNAMESE_DIACRITICS_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe('Phase 5: System, RBAC, Services & Logistics Zero-Hardcoded-Vi Assertion Suite', () => {
  describe('Layer 1: Static Source Code Scanner (Phase 5 Files)', () => {
    const phase5Files = [
      'src/components/data-filters/data-filters.tsx',
      'src/components/data-filters/single-date-filter.tsx',
      'src/components/admin/resource-ui.tsx',
      'src/features/bus-companies/components/bus-companies-management.tsx',
      'src/features/bus-companies/components/bus-company-workspace.tsx',
      'src/features/bus-companies/components/create-bus-company-dialog.tsx',
      'src/features/bus-companies/components/edit-bus-company-dialog.tsx',
      'src/features/bus-companies/services/bus-company-service.ts',
      'src/features/admin-accounts/components/admin-accounts-management.tsx',
      'src/features/admin-accounts/components/admin-account-workspace.tsx',
      'src/features/admin-accounts/components/admin-account-form-dialog.tsx',
      'src/features/admin-accounts/components/admin-account-roles-dialog.tsx',
      'src/features/admin-accounts/hooks/use-admin-accounts.ts',
      'src/features/admin-accounts/services/admin-account-service.ts',
      'src/components/admin/rbac/admin-rbac-permission-matrix.tsx',
      'src/components/admin/rbac/admin-rbac-role-selector.tsx',
      'src/features/platform-rbac/components/platform-rbac-management.tsx',
      'src/features/platform-rbac/components/platform-rbac-scope-navigation.tsx',
      'src/features/platform-rbac/components/platform-tenant-rbac-management.tsx',
      'src/features/platform-rbac/components/platform-tenant-rbac-picker.tsx',
      'src/features/platform-rbac/services/platform-rbac-service.ts',
      'src/features/tenant-rbac/components/tenant-rbac-management.tsx',
      'src/features/tenant-rbac/services/tenant-rbac-service.ts',
      'src/features/revenue-reports/components/revenue-reports-dashboard.tsx',
      'src/features/revenue-reports/format.ts',
      'src/features/revenue-reports/hooks/use-revenue-report.ts',
      'src/features/revenue-reports/services/revenue-report-service.ts',
      'src/features/reviews/components/reviews-management.tsx',
      'src/features/reviews/hooks/use-reviews.ts',
      'src/features/reviews/services/reviews-service.ts',
      'src/features/support-chat/services/admin-support-chat.api.ts',
      'src/features/support-chat/hooks/use-admin-chat-socket.ts',
      'src/features/support-chat/components/admin-chat-messenger.tsx',
      'src/features/super-admin-dashboard/components/super-admin-dashboard.tsx',
      'src/features/super-admin-dashboard/services/dashboard-service.ts',
      'src/features/tenant-dashboard/components/tenant-dashboard-header.tsx',
      'src/features/tenant-dashboard/components/tenant-dashboard.tsx',
      'src/features/tenant-dashboard/components/tenant-metrics-grid.tsx',
      'src/features/tenant-dashboard/components/tenant-upcoming-trips.tsx',
      'src/features/tenant-dashboard/components/tenant-urgent-alerts.tsx',
      'src/features/tenant-dashboard/hooks/use-tenant-dashboard.ts',
      'src/features/tenant-dashboard/services/tenant-dashboard-service.ts',
      'src/features/shipments/components/luggage-packages-management.tsx',
      'src/features/shipments/components/shipment-create-view.tsx',
      'src/features/shipments/components/print/shipment-label.tsx',
      'src/features/shipments/components/print/shipment-receipt.tsx',
      'src/features/shipments/components/print/shipment-print-view.tsx',
      'src/features/shipments/components/shipment-scan-dialog.tsx',
      'src/features/shipments/components/shipment-operations.tsx',
      'src/features/shipments/components/shipments-management.tsx',
      'src/features/shipments/components/shipment-workspace.tsx',
      'src/features/shipments/components/shipment-rates-management.tsx',
      'src/features/shipments/components/shipment-rate-workspace.tsx',
      'src/features/shipments/components/shipment-rate-form-dialog.tsx',
      'src/features/shipments/hooks/use-shipments.ts',
      'src/features/shipments/hooks/use-shipment-rates.ts',
      'src/features/shipments/services/shipment-service.ts',
      'src/features/shipments/services/shipment-rate-service.ts',
      'src/features/shipments/services/shipment-lookup.ts',
      'src/features/shipments/services/shipment-operations.ts',
      'src/features/shipments/services/luggage-rate-service.ts',
      'src/features/shipments/utils/waybill-code.ts',
      'src/app/[locale]/shipments/create/page.tsx',
      'src/app/[locale]/shipments/rates/page.tsx',
      'src/app/[locale]/support-chat/page.tsx',
    ];

    for (const relativePath of phase5Files) {
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
    it('renders CreateBusCompanyDialog in English without any Vietnamese diacritics', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CreateBusCompanyDialog
            onClose={vi.fn()}
            onCreated={vi.fn()}
          />
        </NextIntlClientProvider>,
      );

      const text = document.body.textContent || '';
      expect(text.length).toBeGreaterThan(0);
      expect(VIETNAMESE_DIACRITICS_REGEX.test(text)).toBe(false);
    });

    it('renders LuggagePackagesManagement in English without any Vietnamese diacritics', async () => {
      const { findByText } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <LuggagePackagesManagement canUpdate={true} />
        </NextIntlClientProvider>,
      );

      await findByText('4 Standard Luggage Packages with Ticket');
      const text = document.body.textContent || '';
      expect(text.length).toBeGreaterThan(0);
      expect(VIETNAMESE_DIACRITICS_REGEX.test(text)).toBe(false);
    });
  });

  describe('Layer 3: Symmetrical Dictionary Validation (Phase 5 Namespaces)', () => {
    const namespaces = [
      'busCompanies',
      'adminAccounts',
      'rbac',
      'reviews',
      'supportChat',
      'revenueReports',
      'dashboard',
      'shipments',
    ] as const;

    for (const ns of namespaces) {
      it(`ensures all keys in vi.${ns} exist in en.${ns}`, () => {
        const viNs = (viMessages as Record<string, unknown>)[ns] as Record<string, unknown> || {};
        const enNs = (enMessages as Record<string, unknown>)[ns] as Record<string, unknown> || {};

        function checkKeys(viObj: Record<string, unknown>, enObj: Record<string, unknown>, prefix = '') {
          for (const key of Object.keys(viObj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            expect(enObj).toHaveProperty(key);
            if (typeof viObj[key] === 'object' && viObj[key] !== null) {
              checkKeys(viObj[key] as Record<string, unknown>, enObj[key] as Record<string, unknown>, fullKey);
            }
          }
        }

        checkKeys(viNs, enNs);
      });

      it(`ensures all keys in en.${ns} exist in vi.${ns}`, () => {
        const viNs = (viMessages as Record<string, unknown>)[ns] as Record<string, unknown> || {};
        const enNs = (enMessages as Record<string, unknown>)[ns] as Record<string, unknown> || {};

        function checkKeys(enObj: Record<string, unknown>, viObj: Record<string, unknown>, prefix = '') {
          for (const key of Object.keys(enObj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            expect(viObj).toHaveProperty(key);
            if (typeof enObj[key] === 'object' && enObj[key] !== null) {
              checkKeys(enObj[key] as Record<string, unknown>, viObj[key] as Record<string, unknown>, fullKey);
            }
          }
        }

        checkKeys(enNs, viNs);
      });
    }
  });
});
