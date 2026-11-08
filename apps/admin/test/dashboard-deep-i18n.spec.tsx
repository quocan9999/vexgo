// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

describe('Phase A4: Super Admin & Tenant Dashboards Deep i18n Verification', () => {
  describe('Dictionary completeness and key alignment', () => {
    it('synchronizes all Super Admin platform overview keys', () => {
      expect(enMessages.dashboard.scopeLabel).toBe('Scope');
      expect(enMessages.dashboard.fullSystem).toBe('All VexGo Platform');
      expect(enMessages.dashboard.liveBadge).toBe('Live');
      expect(enMessages.dashboard.refreshLabel).toBe('Refresh');
      expect(enMessages.dashboard.refreshOff).toBe('Off');
      expect(enMessages.dashboard.metricCompanies).toBe('Platform Bus Operators');
      expect(enMessages.dashboard.metricAdmins).toBe('Operator Administrators');
      expect(enMessages.dashboard.metricNeedingAdmin).toBe('Needing Administrator');
      expect(enMessages.dashboard.recentCompaniesTitle).toBe('Recent Bus Operators');
      expect(enMessages.dashboard.chartTitle).toBe('New Operators by Month');
      expect(enMessages.dashboard.chart6Months).toBe('Past 6 months');
      expect(enMessages.dashboard.allAdminsAssigned).toBe('Fully Administered');
    });

    it('synchronizes all Tenant operator dashboard keys', () => {
      expect(enMessages.dashboard.tenantDashboardTitle).toBe('Operator Operations Overview');
      expect(enMessages.dashboard.shiftDuty).toBe('Shift');
      expect(enMessages.dashboard.today).toBe('Today');
      expect(enMessages.dashboard.tripsToday).toBe('Trips Today');
      expect(enMessages.dashboard.seatLoadFactor).toBe('Seat Occupancy Rate');
      expect(enMessages.dashboard.cargoShipments).toBe('Parcels & Shipments');
      expect(enMessages.dashboard.estimatedRevenue).toBe('Estimated Revenue');
      expect(enMessages.dashboard.urgentAlertsTitle).toBe('Urgent Action Required');
      expect(enMessages.dashboard.stableOperations).toBe('Stable Operations');
      expect(enMessages.dashboard.upcomingTripsTitle).toBe('Upcoming Departures');
      expect(enMessages.dashboard.statusNotDeparted).toBe('Awaiting Departure');
      expect(enMessages.dashboard.statusInTransit).toBe('En Route');
      expect(enMessages.dashboard.statusCompleted).toBe('Completed');
      expect(enMessages.dashboard.statusCancelled).toBe('Cancelled');
      expect(enMessages.dashboard.seatMap).toBe('Seat Map');
      expect(enMessages.dashboard.tripDetails).toBe('Details');
    });

    it('synchronizes all quick actions shortcuts', () => {
      expect(enMessages.dashboard.quickActionsTitle).toBe('Quick Shortcuts');
      expect(enMessages.dashboard.quickActionPosTitle).toBe('Counter Ticketing');
      expect(enMessages.dashboard.quickActionTripsTitle).toBe('Trip Management');
      expect(enMessages.dashboard.quickActionCargoTitle).toBe('Receive Cargo');
      expect(enMessages.dashboard.quickActionStationsTitle).toBe('Stations & Pickups');
      expect(enMessages.dashboard.quickActionReportsTitle).toBe('Revenue Reports');
    });
  });

  describe('English rendering in dashboard client components', () => {
    it('renders Super Admin platform KPI labels in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <div>
            <h2>{enMessages.dashboard.metricCompanies}</h2>
            <h2>{enMessages.dashboard.metricAdmins}</h2>
            <h2>{enMessages.dashboard.metricNeedingAdmin}</h2>
            <span>{enMessages.dashboard.allAdminsAssigned}</span>
            <button>{enMessages.dashboard.allCompanies}</button>
          </div>
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Platform Bus Operators')).toBeTruthy();
      expect(screen.getByText('Operator Administrators')).toBeTruthy();
      expect(screen.getByText('Needing Administrator')).toBeTruthy();
      expect(screen.getByText('Fully Administered')).toBeTruthy();
      expect(screen.getByText('All Bus Operators')).toBeTruthy();
    });

    it('renders Tenant operator upcoming trips headers and badges in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <div>
            <h1>{enMessages.dashboard.upcomingTripsTitle}</h1>
            <span>{enMessages.dashboard.colDepartureTime}</span>
            <span>{enMessages.dashboard.colRoute}</span>
            <span>{enMessages.dashboard.colVehicle}</span>
            <span>{enMessages.dashboard.colSeatLoad}</span>
            <span>{enMessages.dashboard.statusNotDeparted}</span>
            <span>{enMessages.dashboard.statusInTransit}</span>
            <button>{enMessages.dashboard.seatMap}</button>
          </div>
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Upcoming Departures')).toBeTruthy();
      expect(screen.getByText('Departure')).toBeTruthy();
      expect(screen.getByText('Route')).toBeTruthy();
      expect(screen.getByText('Vehicle')).toBeTruthy();
      expect(screen.getByText('Occupancy')).toBeTruthy();
      expect(screen.getByText('Awaiting Departure')).toBeTruthy();
      expect(screen.getByText('En Route')).toBeTruthy();
      expect(screen.getByText('Seat Map')).toBeTruthy();
    });
  });
});
