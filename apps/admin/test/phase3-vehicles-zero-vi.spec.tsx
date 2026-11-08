// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VehicleFormDialog } from '../src/features/vehicles/components/vehicle-form-dialog';
import { VehicleTypeFormDialog } from '../src/features/vehicle-types/components/vehicle-type-form-dialog';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/vehicles',
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
      busCompanyId: 10,
      permissions: ['vehicle:create', 'vehicle:update', 'vehicle:delete', 'seat:create', 'seat:update', 'seat:delete'],
    },
  }),
}));

// Mock vehicle services
vi.mock('../src/features/vehicles/services/vehicle-service', () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  updateVehicleStatus: vi.fn(),
  deleteVehicle: vi.fn(),
  getVehicles: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleTypeFilterOptions: () =>
    Promise.resolve([
      { id: 1, label: 'Limousine 34 Beds' },
      { id: 2, label: 'Sleeper 40 Beds' },
    ]),
  getVehicleSeats: vi.fn(),
  createVehicleSeat: vi.fn(),
  updateVehicleSeat: vi.fn(),
  updateVehicleSeatLayout: vi.fn(),
  deleteVehicleSeat: vi.fn(),
  deleteVehicleSeatFloor: vi.fn(),
  VehicleApiError: class extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock vehicle type services
vi.mock('../src/features/vehicle-types/services/vehicle-type-service', () => ({
  createVehicleType: vi.fn(),
  updateVehicleType: vi.fn(),
  getVehicleTypes: vi.fn(),
  getVehicleTypeById: vi.fn(),
  VehicleTypeApiError: class extends Error {
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

describe('Phase 3: Vehicles & Fleet Zero-Hardcoded-Vi Assertion Suite', () => {
  describe('Layer 1: Static Source Code Scanner (Phase 3 Fleet Files)', () => {
    const phase3Files = [
      'src/features/vehicles/components/seat-layout-editor.tsx',
      'src/features/vehicles/components/seat-layout-utils.ts',
      'src/features/vehicles/components/vehicle-create-workspace.tsx',
      'src/features/vehicles/components/vehicle-form-dialog.tsx',
      'src/features/vehicles/components/vehicle-seats-management.tsx',
      'src/features/vehicles/components/vehicle-workspace.tsx',
      'src/features/vehicles/components/vehicles-management.tsx',
      'src/features/vehicles/hooks/use-vehicle-filter-options.ts',
      'src/features/vehicles/hooks/use-vehicles.ts',
      'src/features/vehicles/services/vehicle-service.ts',
      'src/features/vehicle-types/components/vehicle-type-form-dialog.tsx',
      'src/features/vehicle-types/components/vehicle-type-workspace.tsx',
      'src/features/vehicle-types/hooks/use-vehicle-types.ts',
      'src/features/vehicle-types/services/vehicle-type-service.ts',
      'src/app/[locale]/vehicles/create/page.tsx',
    ];

    it.each(phase3Files)(
      'asserts 0 Vietnamese hardcoded characters in %s',
      (relativeFilePath) => {
        const fullPath = path.resolve(__dirname, '..', relativeFilePath);
        expect(fs.existsSync(fullPath), `File not found: ${fullPath}`).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const violations: { line: number; text: string }[] = [];

        lines.forEach((lineText, idx) => {
          if (VIETNAMESE_DIACRITICS_REGEX.test(lineText)) {
            violations.push({ line: idx + 1, text: lineText.trim() });
          }
        });

        expect(
          violations,
          `Found ${violations.length} hardcoded Vietnamese line(s) in ${relativeFilePath}:\n` +
            violations.map((v) => `  L${v.line}: ${v.text}`).join('\n'),
        ).toHaveLength(0);
      },
    );
  });

  describe('Layer 2: Runtime DOM Scanner in English Locale (Zero-Hardcoded-Vi)', () => {
    it('renders VehicleFormDialog in create mode with zero Vietnamese in English DOM', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VehicleFormDialog
            busCompanies={{
              status: 'success',
              options: [{ id: 10, label: 'FUTA Bus Lines' }],
            }}
            onClose={vi.fn()}
            onRetryOptions={vi.fn()}
            onSaved={vi.fn()}
            vehicleTypes={{
              status: 'success',
              options: [
                { id: 1, label: 'Limousine 34 Beds' },
                { id: 2, label: 'Sleeper 40 Beds' },
              ],
            }}
          />
        </NextIntlClientProvider>,
      );

      expect(
        screen.getByRole('heading', { name: enMessages.vehicles.formDialogCreateTitle }),
      ).toBeDefined();
      expect(screen.getByText(enMessages.vehicles.formDialogCreateDesc)).toBeDefined();
      expect(screen.getByText(enMessages.vehicles.plateNumber)).toBeDefined();
      expect(screen.getByText(enMessages.vehicles.vehicleType)).toBeDefined();

      const renderedText = container.textContent || '';
      expect(
        VIETNAMESE_DIACRITICS_REGEX.test(renderedText),
        `Found unexpected Vietnamese diacritic in English VehicleFormDialog DOM: "${renderedText.slice(0, 300)}..."`,
      ).toBe(false);
    });

    it('renders VehicleFormDialog in edit mode with zero Vietnamese in English DOM', () => {
      const mockVehicle = {
        vehicleId: 101,
        licensePlate: '51B-999.88',
        busCompanyId: 10,
        busCompany: { busCompanyId: 10, name: 'FUTA Bus Lines', code: 'FUTA' },
        vehicleTypeId: 1,
        vehicleType: {
          vehicleTypeId: 1,
          name: 'Limousine 34 Beds',
          description: 'VIP Coach',
          seatCount: 34,
          floorCount: 2,
          motorbikeCapacityDefault: 2,
          bulkyCargoCapacityDefault: 10,
          lightCargoCapacityDefault: 20,
          busCompanyId: 10,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        status: 'HOAT_DONG' as const,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      };

      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VehicleFormDialog
            busCompanies={{
              status: 'success',
              options: [{ id: 10, label: 'FUTA Bus Lines' }],
            }}
            onClose={vi.fn()}
            onRetryOptions={vi.fn()}
            onSaved={vi.fn()}
            vehicle={mockVehicle}
            vehicleTypes={{
              status: 'success',
              options: [
                { id: 1, label: 'Limousine 34 Beds' },
                { id: 2, label: 'Sleeper 40 Beds' },
              ],
            }}
          />
        </NextIntlClientProvider>,
      );

      const expectedTitle = enMessages.vehicles.formDialogEditTitle.replace(
        '{plate}',
        mockVehicle.licensePlate,
      );
      expect(screen.getByRole('heading', { name: expectedTitle })).toBeDefined();
      expect(screen.getByText(enMessages.vehicles.formDialogEditDesc)).toBeDefined();

      const renderedText = container.textContent || '';
      expect(
        VIETNAMESE_DIACRITICS_REGEX.test(renderedText),
        `Found unexpected Vietnamese diacritic in English Edit Vehicle Dialog DOM: "${renderedText.slice(0, 300)}..."`,
      ).toBe(false);
    });

    it('renders VehicleTypeFormDialog in create mode with zero Vietnamese in English DOM', () => {
      const { container } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VehicleTypeFormDialog
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        </NextIntlClientProvider>,
      );

      expect(
        screen.getByRole('heading', { name: enMessages.vehicleTypes.dialogCreateTitle }),
      ).toBeDefined();
      expect(screen.getByText(enMessages.vehicleTypes.dialogCreateDesc)).toBeDefined();
      expect(screen.getByText(enMessages.vehicleTypes.typeName)).toBeDefined();
      expect(screen.getByText(enMessages.vehicleTypes.description)).toBeDefined();

      const renderedText = container.textContent || '';
      expect(
        VIETNAMESE_DIACRITICS_REGEX.test(renderedText),
        `Found unexpected Vietnamese diacritic in English VehicleTypeFormDialog DOM: "${renderedText.slice(0, 300)}..."`,
      ).toBe(false);
    });
  });

  describe('Layer 3: Symmetrical Dictionary Validation', () => {
    it('verifies all Phase 3 keys exist symmetrically in vi.json and en.json', () => {
      const vehicleKeys = [
        'vehiclesTitle',
        'vehiclesSubtitle',
        'createVehicle',
        'editVehicle',
        'plateNumber',
        'vehicleType',
        'seatCount',
        'floorCount',
        'vehicleStatus',
        'active',
        'maintenance',
        'statusActive',
        'statusMaintenance',
        'backToVehicles',
        'identificationTitle',
        'identificationSubtitle',
        'seatStats',
        'seatStatsDesc',
        'lowerSeats',
        'upperSeats',
        'totalSeatsLabel',
        'visualSeatLayout',
        'visualSeatLayoutDesc',
        'columnsCount',
        'removeUpperDeck',
        'addUpperDeck',
        'vehicleFront',
        'driverPosition',
        'passengerDoorArrow',
        'addSeat',
        'removeSeat',
        'deckRemovalTitle',
        'deckRemovalConfirm',
        'saveVehicle',
        'saving',
        'vehicleDetails',
        'vehicleDetailsTitle',
        'deleteVehicle',
        'deleteVehicleConfirmTitle',
        'deleteVehicleConfirmDesc',
        'manageSeats',
        'editSeat',
        'seatNumberLabel',
        'updateSeatSuccess',
        'deleteSeatSuccess',
        'formDialogCreateTitle',
        'formDialogEditTitle',
        'formDialogCreateDesc',
        'formDialogEditDesc',
        'networkError',
        'loadDetailsError',
        'loadSeatsError',
        'saveError',
        'deleteError',
      ];

      const vehicleTypeKeys = [
        'vehicleTypesTitle',
        'vehicleTypesSubtitle',
        'createVehicleType',
        'editVehicleType',
        'typeName',
        'description',
        'totalSeats',
        'dialogCreateTitle',
        'dialogEditTitle',
        'dialogCreateDesc',
        'dialogEditDesc',
        'defaultCargoCapacity',
        'motorbike',
        'bulkyCargo',
        'lightCargo',
        'descAndTime',
        'networkError',
      ];

      vehicleKeys.forEach((key) => {
        expect(
          (viMessages.vehicles as Record<string, unknown>)[key],
          `vi.vehicles.${key} missing`,
        ).toBeDefined();
        expect(
          (enMessages.vehicles as Record<string, unknown>)[key],
          `en.vehicles.${key} missing`,
        ).toBeDefined();
      });

      vehicleTypeKeys.forEach((key) => {
        expect(
          (viMessages.vehicleTypes as Record<string, unknown>)[key],
          `vi.vehicleTypes.${key} missing`,
        ).toBeDefined();
        expect(
          (enMessages.vehicleTypes as Record<string, unknown>)[key],
          `en.vehicleTypes.${key} missing`,
        ).toBeDefined();
      });
    });
  });
});
