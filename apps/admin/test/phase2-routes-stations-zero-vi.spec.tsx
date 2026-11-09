// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RouteFormDialog } from '../src/features/routes/components/route-form-dialog';
import { StationFormDialog } from '../src/features/stations/components/station-form-dialog';
import { StopListEditor } from '../src/features/stops/components/stop-list-editor';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/routes/1',
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
      user: { id: 1, username: 'admin', role: 'SUPER_ADMIN' },
      roles: ['SUPER_ADMIN'],
      permissions: ['route:create', 'route:update', 'route:delete'],
    },
  }),
}));

// Mock location service
vi.mock('@/features/locations/services/location-service', () => ({
  getLocations: () =>
    Promise.resolve([
      { id: '1', diaDiemId: 1, name: 'TP. Ho Chi Minh', isLegacy: true },
      { id: '2', diaDiemId: 2, name: 'Da Lat', isLegacy: true },
    ]),
}));

// Mock station service
vi.mock('@/features/stations/services/station-service', () => ({
  getStations: () =>
    Promise.resolve({
      data: [
        {
          diemDonTraId: 101,
          tenDiem: 'Western Bus Station',
          maDiem: 'BX-MD',
          loaiDiem: 'BEN_XE',
          trangThai: 'HOAT_DONG',
          diaChi: '395 Kinh Duong Vuong, Binh Tan',
        },
      ],
      meta: { page: 1, pageSize: 15, totalItems: 1, totalPages: 1 },
    }),
  getStationById: (id: number) =>
    Promise.resolve({
      diemDonTraId: id,
      tenDiem: 'Western Bus Station',
      maDiem: 'BX-MD',
      loaiDiem: 'BEN_XE',
      trangThai: 'HOAT_DONG',
      diaChi: '395 Kinh Duong Vuong, Binh Tan',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    }),
  createStation: vi.fn(),
  updateStation: vi.fn(),
  deleteStation: vi.fn(),
  StationApiError: class extends Error {},
}));

// Mock stops service
vi.mock('@/features/stops/services/stop-service', () => ({
  getRouteStops: () =>
    Promise.resolve([
      {
        diemDonTraId: 101,
        loaiDiem: 'DON',
        phutLech: 0,
        thuTu: 1,
        phuPhi: 0,
        phutCoMatTruoc: 15,
        nhanKhach: true,
        ghiChu: '',
      },
    ]),
  getTripStops: () =>
    Promise.resolve([
      {
        diemDonTraId: 101,
        loaiDiem: 'DON',
        phutLech: 0,
        thuTu: 1,
        phuPhi: 0,
        phutCoMatTruoc: 15,
        nhanKhach: true,
        ghiChu: '',
        veCount: 0,
      },
    ]),
  updateRouteStops: vi.fn(),
  updateTripStops: vi.fn(),
  StopApiError: class extends Error {},
}));

const VIETNAMESE_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe('Phase 2: Routes & Stations Deep i18n & Zero-Hardcoded-Vi Verification', () => {
  describe('Layer 1: Static Source Code Scanner (AST / Regex)', () => {
    const phase2Files = [
      'src/features/routes/components/route-workspace.tsx',
      'src/features/routes/components/route-form-dialog.tsx',
      'src/features/routes/components/routes-management.tsx',
      'src/features/routes/services/route-service.ts',
      'src/features/routes/utils/route-duration.ts',
      'src/features/stations/components/station-workspace.tsx',
      'src/features/stations/components/station-form-dialog.tsx',
      'src/features/stations/components/stations-management.tsx',
      'src/features/stations/components/station-list-table.tsx',
      'src/features/stations/services/station-service.ts',
      'src/features/stops/components/stop-list-editor.tsx',
      'src/features/stops/services/stop-service.ts',
    ];

    it.each(phase2Files)(
      'verifies zero unlocalized Vietnamese characters in %s',
      (relativeFile) => {
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
          `Found hardcoded Vietnamese text in ${relativeFile}:\n${viViolations.join('\n')}`,
        ).toEqual([]);
      },
    );
  });

  describe('Layer 2: Runtime DOM Scanner in English mode (locale="en")', () => {
    it('renders RouteFormDialog in English without Vietnamese diacritics', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <RouteFormDialog
            tenantBusCompanyId={1}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </NextIntlClientProvider>,
      );

      // Verify English dialog title and form labels
      expect(screen.getByRole('heading', { name: enMessages.routes.createRoute })).toBeDefined();
      expect(screen.getByText('Departure Point')).toBeDefined();
      expect(screen.getByText('Destination')).toBeDefined();
      expect(screen.getByText('Duration (minutes)')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Create route' })).toBeDefined();

      const allText = container.textContent || '';
      expect(
        VIETNAMESE_REGEX.test(allText),
        `DOM contains hardcoded Vietnamese in RouteFormDialog:\n${allText}`,
      ).toBe(false);
    });

    it('renders StationFormDialog in English without Vietnamese diacritics', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <StationFormDialog
            onClose={() => {}}
            onSaved={() => {}}
          />
        </NextIntlClientProvider>,
      );

      // Verify English dialog title and labels
      expect(screen.getByRole('heading', { name: enMessages.stations.createStation })).toBeDefined();
      expect(screen.getByText('Station Name')).toBeDefined();
      expect(screen.getByText(enMessages.stations.stationType)).toBeDefined();
      expect(screen.getByText('Administrative Area / Province (Legacy)')).toBeDefined();
      expect(screen.getByText(enMessages.stations.address)).toBeDefined();
      expect(screen.getByText(enMessages.stations.phone)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Add New' })).toBeDefined();

      const allText = container.textContent || '';
      expect(
        VIETNAMESE_REGEX.test(allText),
        `DOM contains hardcoded Vietnamese in StationFormDialog:\n${allText}`,
      ).toBe(false);
    });

    it('renders StopListEditor in English mode without Vietnamese diacritics', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <StopListEditor
            mode="route"
            targetId={1}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </NextIntlClientProvider>,
      );

      // Verify English modal title and action buttons
      expect(screen.getByRole('heading', { name: 'Configure Route Pattern' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Add Stop' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Sort by Time' })).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: 'Save Stops' })).toBeDefined();

      const allText = container.textContent || '';
      expect(
        VIETNAMESE_REGEX.test(allText),
        `DOM contains hardcoded Vietnamese in StopListEditor:\n${allText}`,
      ).toBe(false);
    });
  });

  describe('Layer 3: Symmetrical Dictionary Validation', () => {
    it('verifies all Phase 2 keys exist symmetrically in vi.json and en.json', () => {
      const routeKeys = [
        'routesTitle',
        'routeDetails',
        'routeDetailsTitle',
        'createRoute',
        'editRoute',
        'departurePoint',
        'arrivalPoint',
        'estimatedDuration',
        'durationMinutesLabel',
        'sampleRouteTitle',
        'configureStops',
        'sampleRouteDesc',
        'loadingStops',
        'noStopsPattern',
        'recordAndTimeline',
        'createdAtLabel',
        'updatedAtLabel',
        'suspendRoute',
        'activateRoute',
        'suspendTitle',
        'activateTitle',
        'suspendDescription',
        'activateDescription',
        'updatingStatus',
        'statusSuspendedSuccess',
        'statusActivatedSuccess',
        'updateSuccess',
      ];

      const stationKeys = [
        'stationsTitle',
        'stationDetails',
        'stationDetailsWithName',
        'createStation',
        'editStation',
        'deletePoint',
        'loadingDetails',
        'backToStations',
        'locationAndScale',
        'stationTypeLabel',
        'transitDestinationLabel',
        'addressDetailLabel',
        'contactAndGps',
        'phoneLabel',
        'recordAndTimeline',
        'createdAtLabel',
        'updatedAtLabel',
        'typeTerminal',
        'typeOffice',
        'typeStop',
        'typeTransit',
        'typeRest',
        'updateSuccess',
        'createSuccess',
      ];

      const stopKeys = [
        'defaultRouteTitle',
        'defaultTripTitle',
        'routeModalDesc',
        'tripModalDesc',
        'sortByTimeBtn',
        'saveRouteBtn',
        'addStopSelectPlaceholder',
        'addStopBtn',
        'validationAlertTitle',
        'emptyStopsTitle',
        'transitBadge',
        'ticketsSelectedBadge',
        'moveUpAria',
        'moveDownAria',
        'deleteStopAria',
        'roleCol',
        'rolePickup',
        'roleDropoff',
        'roleRest',
        'offsetCol',
        'surchargeCol',
        'presenceCol',
        'enableBoarding',
        'saveRouteStopsSuccess',
        'saveTripStopsSuccess',
      ];

      routeKeys.forEach((key) => {
        expect((viMessages.routes as Record<string, unknown>)[key], `vi.routes.${key} missing`).toBeDefined();
        expect((enMessages.routes as Record<string, unknown>)[key], `en.routes.${key} missing`).toBeDefined();
      });

      stationKeys.forEach((key) => {
        expect((viMessages.stations as Record<string, unknown>)[key], `vi.stations.${key} missing`).toBeDefined();
        expect((enMessages.stations as Record<string, unknown>)[key], `en.stations.${key} missing`).toBeDefined();
      });

      stopKeys.forEach((key) => {
        expect((viMessages.stops as Record<string, unknown>)[key], `vi.stops.${key} missing`).toBeDefined();
        expect((enMessages.stops as Record<string, unknown>)[key], `en.stops.${key} missing`).toBeDefined();
      });
    });
  });
});
