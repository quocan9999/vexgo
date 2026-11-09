// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { ResourceRefreshAction, ResourceDetailAction, ResourcePagination } from '../src/components/admin/resource-ui';
import { AdminRbacRoleSelector } from '../src/components/admin/rbac/admin-rbac-role-selector';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

describe('Admin Web Comprehensive i18n Audit Fixes Verification', () => {
  describe('Khối 1: Shared UI Core Components (resource-ui)', () => {
    it('ResourceRefreshAction defaults to "Refresh" in English and "Làm mới" in Vietnamese', () => {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ResourceRefreshAction loading={false} onClick={() => {}} />
        </NextIntlClientProvider>
      );
      expect(screen.getByRole('button', { name: /refresh/i })).toBeDefined();
      unmount();

      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <ResourceRefreshAction loading={false} onClick={() => {}} />
        </NextIntlClientProvider>
      );
      expect(screen.getByRole('button', { name: /làm mới/i })).toBeDefined();
    });

    it('ResourceDetailAction defaults to "View Details" in English and "Xem chi tiết" in Vietnamese', () => {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ResourceDetailAction href="/test" />
        </NextIntlClientProvider>
      );
      expect(screen.getByText('View Details')).toBeDefined();
      unmount();

      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <ResourceDetailAction href="/test" />
        </NextIntlClientProvider>
      );
      expect(screen.getByText('Xem chi tiết')).toBeDefined();
    });

    it('ResourcePagination formats "Showing 1–3 of 3 companies" and "Page 1 / 1" in English', () => {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ResourcePagination
            currentPage={1}
            pageSize={10}
            totalItems={3}
            totalPages={1}
            summaryLabel="companies"
            onPageChange={() => {}}
          />
        </NextIntlClientProvider>
      );
      expect(screen.getByText(/showing/i)).toBeDefined();
      expect(screen.getByText(/of/i)).toBeDefined();
      expect(screen.getByText(/companies/i)).toBeDefined();
      expect(screen.getByText(/page/i)).toBeDefined();
      expect(screen.queryByText(/hiển thị/i)).toBeNull();
      unmount();

      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <ResourcePagination
            currentPage={1}
            pageSize={10}
            totalItems={3}
            totalPages={1}
            summaryLabel="nhà xe"
            onPageChange={() => {}}
          />
        </NextIntlClientProvider>
      );
      expect(screen.getByText(/hiển thị/i)).toBeDefined();
      expect(screen.getByText(/trong/i)).toBeDefined();
      expect(screen.getByText(/nhà xe/i)).toBeDefined();
      expect(screen.getByText(/trang/i)).toBeDefined();
    });
  });

  describe('Khối 2: RBAC Components i18n', () => {
    it('AdminRbacRoleSelector translates role descriptions and badges in English', () => {
      const roles = [
        {
          roleName: 'SUPER_ADMIN' as const,
          description: 'Quản trị hệ thống',
          scope: 'platform' as const,
          isProtected: true,
        },
        {
          roleName: 'NHA_XE_ADMIN' as const,
          description: 'Quản trị nhà xe',
          scope: 'tenant' as const,
          isProtected: false,
        },
      ];

      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <AdminRbacRoleSelector
            roles={roles}
            selectedRoleName="SUPER_ADMIN"
            onSelect={() => {}}
            radioName="rbac-roles"
            title="Select role to configure"
            titleId="rbac-role-title"
          />
        </NextIntlClientProvider>
      );

      // System Administrator description translated
      expect(screen.getAllByText('System Administrator').length).toBeGreaterThan(0);
      // Bus Operator Administrator description translated
      expect(screen.getAllByText('Bus Operator Administrator').length).toBeGreaterThan(0);
      // Protected Role badge translated
      expect(screen.getByText('Protected Role')).toBeDefined();
      // Operator badge translated
      expect(screen.getByText('Operator')).toBeDefined();
      // Platform badge
      expect(screen.getByText('Platform')).toBeDefined();
    });
  });

  describe('Khối 3 & 4: Tenant Dashboard & Trip Create Dictionaries', () => {
    it('verifies Tenant Metrics and Trip Create translations in English dictionary', () => {
      expect(enMessages.dashboard.tripsToday).toBe('Trips Today');
      expect(enMessages.dashboard.seatLoadFactor).toBe('Seat Occupancy Rate');
      expect(enMessages.dashboard.cargoShipments).toBe('Parcels & Shipments');
      expect(enMessages.dashboard.estimatedRevenue).toBe('Estimated Revenue');

      expect(enMessages.trips.createNewTrip).toBe('Create New Trip');
      expect(enMessages.trips.tripInfoTitle).toBe('Trip Information');
      expect(enMessages.trips.tripInfoSubtitle).toBe('Select route, operating vehicle, and departure time.');
      expect(enMessages.trips.colRoute).toBe('Route');
      expect(enMessages.trips.colVehicle).toBe('Vehicle');
      expect(enMessages.trips.autoCopyRouteTemplate).toBe('Auto-copy stops from route template');
      expect(enMessages.trips.enableCargoTransport).toBe('Accept cargo transport on this trip');
      expect(enMessages.trips.completeAndCreateTrip).toBe('Complete & Create Trip');
      expect(enMessages.trips.scheduledStopsRoute).toBe('Scheduled Pick-up / Drop-off Route');
      expect(enMessages.trips.noRouteSelectedTitle).toBe('No Route Selected');
    });
  });
});
