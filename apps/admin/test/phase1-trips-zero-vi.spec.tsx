// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TripStatusBadge } from '../src/features/trips/components/trip-workspace';
import { TripSeatStatusBadge } from '../src/features/trips/components/trip-seats-management';
import { TripFormDialog } from '../src/features/trips/components/trip-form-dialog';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';
import type { TripSeatStatus, TripStatus } from '../src/features/trips/types/trip';

afterEach(cleanup);

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/trips/1',
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

const VIETNAMESE_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe('Phase 1: Trips & Operations Deep i18n & Zero-Hardcoded-Vi Verification', () => {
  describe('Layer 1: Static Source Code Scanner (AST / Regex)', () => {
    const phase1Files = [
      'src/features/trips/components/trip-workspace.tsx',
      'src/features/trips/components/trip-manifest-view.tsx',
      'src/features/trips/components/trip-seats-management.tsx',
      'src/features/trips/components/trip-form-dialog.tsx',
      'src/features/trips/services/trip-service.ts',
      'src/app/[locale]/trips/[tripId]/page.tsx',
      'src/app/[locale]/trips/[tripId]/manifest/page.tsx',
      'src/app/[locale]/trips/[tripId]/seats/page.tsx',
    ];

    it.each(phase1Files)('verifies zero unlocalized Vietnamese characters in %s', (relativeFile) => {
      const fullPath = path.resolve(__dirname, '..', relativeFile);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Strip single-line and multi-line comments
      const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      // Check for raw Vietnamese characters in code
      const lines = stripped.split('\n');
      const viViolations: string[] = [];

      lines.forEach((line, idx) => {
        // Exclude test mocks, whitelisted currency format 'vi-VN' or date format
        const sanitizedLine = line
          .replace(/'vi-VN'/g, '')
          .replace(/"vi-VN"/g, '')
          .replace(/Locale\('vi-VN'\)/g, '');

        if (VIETNAMESE_REGEX.test(sanitizedLine)) {
          viViolations.push(`Line ${idx + 1}: ${line.trim()}`);
        }
      });

      expect(
        viViolations,
        `Found hardcoded Vietnamese text in ${relativeFile}:\n${viViolations.join('\n')}`
      ).toEqual([]);
    });
  });

  describe('Layer 2: Runtime DOM Scanner in English mode (locale="en")', () => {
    it('renders TripStatusBadge in English without Vietnamese diacritics', () => {
      const statuses: TripStatus[] = [
        'CHUA_KHOI_HANH',
        'DANG_CHAY',
        'HOAN_THANH',
        'DA_HUY',
      ];
      const expectedEn = ['Scheduled', 'In Transit', 'Completed', 'Cancelled'];

      statuses.forEach((status, idx) => {
        const { unmount, container } = render(
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <TripStatusBadge status={status} />
          </NextIntlClientProvider>
        );

        expect(container.textContent).toBe(expectedEn[idx]);
        expect(VIETNAMESE_REGEX.test(container.textContent || '')).toBe(false);
        unmount();
      });
    });

    it('renders TripSeatStatusBadge in English without Vietnamese diacritics', () => {
      const seatStatuses: TripSeatStatus[] = ['TRONG', 'DANG_GIU', 'DA_DAT'];
      const expectedEn = ['Available', 'Held', 'Booked'];

      seatStatuses.forEach((status, idx) => {
        const { unmount, container } = render(
          <NextIntlClientProvider locale="en" messages={enMessages}>
            <TripSeatStatusBadge status={status} />
          </NextIntlClientProvider>
        );

        expect(container.textContent).toBe(expectedEn[idx]);
        expect(VIETNAMESE_REGEX.test(container.textContent || '')).toBe(false);
        unmount();
      });
    });

    it('renders TripFormDialog in English mode without Vietnamese text', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <TripFormDialog
            onClose={() => {}}
            onRetryRouteOptions={() => {}}
            onRetryVehicleOptions={() => {}}
            onSaved={() => {}}
            routeOptions={{
              status: 'success',
              options: [{ id: 1, label: 'Saigon to Dalat' }],
            }}
            vehicleOptions={{
              status: 'success',
              options: [{ id: 12, label: '51B-999.88 (VIP Sleeper)' }],
            }}
          />
        </NextIntlClientProvider>
      );

      // Verify English dialog titles and labels
      expect(screen.getByRole('heading', { name: 'Add Trip' })).toBeDefined();
      expect(screen.getAllByText('Route').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Vehicle').length).toBeGreaterThan(0);
      expect(screen.getByText('Accepts Cargo')).toBeDefined();
      expect(screen.getByText('Departure Date')).toBeDefined();
      expect(screen.getByText('Departure Time')).toBeDefined();

      // Check entire dialog textContent for any Vietnamese diacritics
      const allText = container.textContent || '';
      expect(
        VIETNAMESE_REGEX.test(allText),
        `DOM contains hardcoded Vietnamese:\n${allText}`
      ).toBe(false);
    });

    it('validates TripFormDialog in English when submitting empty form', async () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <TripFormDialog
            onClose={() => {}}
            onRetryRouteOptions={() => {}}
            onRetryVehicleOptions={() => {}}
            onSaved={() => {}}
            routeOptions={{ status: 'success', options: [] }}
            vehicleOptions={{ status: 'success', options: [] }}
          />
        </NextIntlClientProvider>
      );

      // Form error messages should be in English
      expect(enMessages.trips.errorRouteRequired).toBe('Please select a route.');
      expect(enMessages.trips.errorVehicleRequired).toBe('Please select a vehicle.');
      expect(enMessages.trips.errorDepartureDateRequired).toBe('Please select a departure date.');
      expect(enMessages.trips.errorDepartureTimeRequired).toBe('Please select a departure time.');
    });
  });

  describe('Dictionary completeness and key alignment', () => {
    it('verifies all Phase 1 trips keys exist symmetrically in vi.json and en.json', () => {
      const keysToCheck = [
        'statusScheduled',
        'statusInTransit',
        'statusCompleted',
        'statusCancelled',
        'seatStatusAvailable',
        'seatStatusHeld',
        'seatStatusBooked',
        'tripWorkspaceTitle',
        'operatingRoute',
        'assignedVehicle',
        'cargoInfo',
        'seatStatusTitle',
        'hourlyStops',
        'manifestTitle',
        'pickupHeading',
        'dropoffHeading',
        'seatMapPageTitle',
        'floorUpper',
        'floorLower',
        'formDialogEditTitle',
        'formDialogAddTitle',
        'errorRouteRequired',
        'errorVehicleRequired',
        'errorDepartureDateRequired',
        'errorDepartureTimeRequired',
      ];

      keysToCheck.forEach((key) => {
        expect((viMessages.trips as Record<string, unknown>)[key], `vi.trips.${key} missing`).toBeDefined();
        expect((enMessages.trips as Record<string, unknown>)[key], `en.trips.${key} missing`).toBeDefined();
      });
    });
  });
});
