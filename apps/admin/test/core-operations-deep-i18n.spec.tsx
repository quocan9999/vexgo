// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';
import { ResourcePagination, ResourceRefreshAction } from '@/components/admin/resource-ui';
import { StationListTable } from '@/features/stations/components/station-list-table';
import type { Station } from '@/features/stations/types/station';

afterEach(cleanup);

function renderWithEnglishIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('Phase A1: Core Operations Deep i18n & Shared Resource UI', () => {
  describe('Dictionary keys completeness between vi and en', () => {
    it('synchronizes all vehicleTypes keys', () => {
      expect(enMessages.vehicleTypes.eyebrow).toBe('FLEET CATEGORY');
      expect(enMessages.vehicleTypes.colName).toBe('Type Name');
      expect(enMessages.vehicleTypes.colDescription).toBe('Description');
      expect(enMessages.vehicleTypes.colCreatedAt).toBe('Created At');
      expect(enMessages.vehicleTypes.colUpdatedAt).toBe('Updated At');
      expect(enMessages.vehicleTypes.defaultCargoCapacity).toBe('Default Cargo Capacity');
      expect(enMessages.vehicleTypes.motorbike).toBe('Motorbikes');
      expect(enMessages.vehicleTypes.bulkyCargo).toBe('Bulky Cargo');
      expect(enMessages.vehicleTypes.lightCargo).toBe('Light Cargo');
      expect(enMessages.vehicleTypes.dialogCreateTitle).toBe('Add Vehicle Type');
      expect(enMessages.vehicleTypes.dialogEditTitle).toBe('Edit Vehicle Type');
    });

    it('synchronizes all vehicles keys', () => {
      expect(enMessages.vehicles.eyebrow).toBe('FLEET MANAGEMENT');
      expect(enMessages.vehicles.colPlate).toBe('License Plate');
      expect(enMessages.vehicles.colOperator).toBe('Bus Operator');
      expect(enMessages.vehicles.colType).toBe('Vehicle Type');
      expect(enMessages.vehicles.colStatus).toBe('Status');
      expect(enMessages.vehicles.statusActive).toBe('Active');
      expect(enMessages.vehicles.statusMaintenance).toBe('Maintenance');
      expect(enMessages.vehicles.allTypes).toBe('All vehicle types');
      expect(enMessages.vehicles.allStatuses).toBe('All vehicle statuses');
    });

    it('synchronizes all routes keys', () => {
      expect(enMessages.routes.eyebrow).toBe('OPERATIONS MANAGEMENT');
      expect(enMessages.routes.colCode).toBe('Route Code');
      expect(enMessages.routes.colOrigin).toBe('Departure Point');
      expect(enMessages.routes.colDestination).toBe('Destination');
      expect(enMessages.routes.statusActive).toBe('In Service');
      expect(enMessages.routes.statusSuspended).toBe('Suspended');
      expect(enMessages.routes.durationMinutes).toBe('{minutes} mins');
    });

    it('synchronizes all stations keys', () => {
      expect(enMessages.stations.eyebrow).toBe('OPERATIONS MANAGEMENT');
      expect(enMessages.stations.colCode).toBe('Stop Code');
      expect(enMessages.stations.colName).toBe('Stop Name');
      expect(enMessages.stations.colType).toBe('Type');
      expect(enMessages.stations.colRegion).toBe('Region (Old ➔ New)');
      expect(enMessages.stations.colAddress).toBe('Detailed Address');
      expect(enMessages.stations.typeTerminal).toBe('Bus Terminal');
      expect(enMessages.stations.typeOffice).toBe('Office');
      expect(enMessages.stations.typeStop).toBe('Pickup/Drop-off');
      expect(enMessages.stations.deleteButton).toBe('Delete Stop');
    });

    it('synchronizes all trips keys', () => {
      expect(enMessages.trips.eyebrow).toBe('OPERATIONS MANAGEMENT');
      expect(enMessages.trips.colTrip).toBe('Trip');
      expect(enMessages.trips.colDepartureDate).toBe('Departure Date');
      expect(enMessages.trips.colDepartureTime).toBe('Departure Time');
      expect(enMessages.trips.colVehicle).toBe('Vehicle');
      expect(enMessages.trips.colAcceptsShipments).toBe('Accepts Cargo');
      expect(enMessages.trips.colCargoCapacity).toBe('Cargo Capacity');
      expect(enMessages.trips.statusScheduled).toBe('Scheduled');
      expect(enMessages.trips.statusInTransit).toBe('In Transit');
      expect(enMessages.trips.originLabel).toBe('Departure Point');
      expect(enMessages.trips.destinationLabel).toBe('Destination');
    });

    it('synchronizes common shared actions and labels', () => {
      expect(enMessages.common.refresh).toBe('Refresh');
      expect(enMessages.common.viewDetails).toBe('View details');
      expect(enMessages.common.showing).toBe('Showing');
      expect(enMessages.common.of).toBe('of');
      expect(enMessages.common.prevPage).toBe('Previous page');
      expect(enMessages.common.nextPage).toBe('Next page');
      expect(enMessages.common.sortBy).toBe('Sort by');
      expect(enMessages.common.sortAscending).toBe('Ascending');
      expect(enMessages.common.sortDescending).toBe('Descending');
      expect(enMessages.common.clearSearch).toBe('Clear search');
      expect(enMessages.common.clearFilters).toBe('Clear filters');
    });
  });

  describe('Shared Component rendering with English labels', () => {
    it('renders ResourceRefreshAction with custom English label', () => {
      render(<ResourceRefreshAction loading={false} onClick={vi.fn()} label="Refresh" />);
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    });

    it('renders ResourcePagination with English pagination labels and format', () => {
      render(
        <ResourcePagination
          currentPage={2}
          onPageChange={vi.fn()}
          pageSize={10}
          summaryLabel="vehicle types"
          totalItems={25}
          totalPages={3}
          showingLabel="Showing"
          ofLabel="of"
          pageLabel="Page"
          prevPageLabel="Previous page"
          nextPageLabel="Next page"
          locale="en-US"
        />,
      );

      expect(screen.getByText(/Showing/)).toBeTruthy();
      expect(screen.getByText(/11–20/)).toBeTruthy();
      expect(screen.getByText(/of/)).toBeTruthy();
      expect(screen.getByText(/25/)).toBeTruthy();
      expect(screen.getByText(/vehicle types/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeTruthy();
    });
  });

  describe('StationListTable with English translations', () => {
    const mockStations = [
      {
        diemDonTraId: 101,
        maDiem: 'BX-MD',
        tenDiem: 'Bến xe Miền Đông',
        loaiDiem: 'BEN_XE' as const,
        diaChi: '292 Đinh Bộ Lĩnh, Phường 26, Bình Thạnh',
        soDienThoai: '19001234',
        diaDiemCu: { diaDiemId: 1, tenDiaDiem: 'TP. Hồ Chí Minh', code: 79 },
        diaDiemMoi: null,
      },
      {
        diemDonTraId: 102,
        maDiem: 'VP-LHP',
        tenDiem: 'VP Lê Hồng Phong',
        loaiDiem: 'VAN_PHONG' as const,
        diaChi: '233 Lê Hồng Phong, Phường 4, Quận 5',
        soDienThoai: '19005678',
        diaDiemCu: { diaDiemId: 1, tenDiaDiem: 'TP. Hồ Chí Minh', code: 79 },
        diaDiemMoi: null,
      },
    ] as unknown as Station[];

    it('renders translated table headers and type badges in English while preserving station names', () => {
      renderWithEnglishIntl(<StationListTable stations={mockStations} />);

      // Headers translated to English
      expect(screen.getByText('Stop Code')).toBeTruthy();
      expect(screen.getByText('Stop Name')).toBeTruthy();
      expect(screen.getByText('Type')).toBeTruthy();
      expect(screen.getAllByText('Region (Old ➔ New)').length).toBeGreaterThan(0);
      expect(screen.getByText('Detailed Address')).toBeTruthy();
      expect(screen.getAllByText('Hotline').length).toBeGreaterThan(0);

      // Station Types translated to English (desktop & mobile)
      expect(screen.getAllByText('Bus Terminal').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Office').length).toBeGreaterThan(0);

      // Station Vietnamese Names and Regions are strictly preserved
      expect(screen.getAllByText('Bến xe Miền Đông').length).toBeGreaterThan(0);
      expect(screen.getAllByText('VP Lê Hồng Phong').length).toBeGreaterThan(0);
      expect(screen.getAllByText('TP. Hồ Chí Minh').length).toBeGreaterThan(0);

      // Actions button translated to English
      expect(screen.getAllByText('View details').length).toBeGreaterThan(0);
    });

    it('renders translated empty state in English when stations list is empty', () => {
      renderWithEnglishIntl(<StationListTable stations={[]} />);
      expect(screen.getByText('No stop points configured in the system.')).toBeTruthy();
    });
  });
});
