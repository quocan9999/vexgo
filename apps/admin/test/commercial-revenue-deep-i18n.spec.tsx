// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

describe('Phase A2: Commercial & Revenue Deep i18n Verification', () => {
  describe('Dictionary completeness and key alignment', () => {
    it('synchronizes all bookings keys for booking management', () => {
      expect(enMessages.bookings.bookingsTitle).toBe('Booking & Ticket Management');
      expect(enMessages.bookings.tabBookings).toBe('Bookings');
      expect(enMessages.bookings.tabTickets).toBe('Tickets');
      expect(enMessages.bookings.colBookingCodeDate).toBe('Booking Code / Date');
      expect(enMessages.bookings.colCustomer).toBe('Customer');
      expect(enMessages.bookings.totalAmount).toBe('Total Amount');
      expect(enMessages.bookings.statusConfirmed).toBe('Confirmed');
      expect(enMessages.bookings.statusCancelled).toBe('Cancelled');
      expect(enMessages.bookings.statusPaid).toBe('Paid');
    });

    it('synchronizes all farePrices keys', () => {
      expect(enMessages.farePrices.farePricesTitle).toBe('Fare Price Management');
      expect(enMessages.farePrices.farePricesSubtitle).toBe('Configure ticket fares by route, vehicle type and period');
      expect(enMessages.farePrices.createFarePrice).toBe('Add Fare Price');
      expect(enMessages.farePrices.colRoute).toBe('Route');
      expect(enMessages.farePrices.colVehicleType).toBe('Vehicle Type');
      expect(enMessages.farePrices.colListedPrice).toBe('Listed Price');
      expect(enMessages.farePrices.colEffectiveDates).toBe('Effective Period');
      expect(enMessages.farePrices.colStatus).toBe('Status');
      expect(enMessages.farePrices.statusActive).toBe('Active');
      expect(enMessages.farePrices.statusSuspended).toBe('Suspended');
      expect(enMessages.farePrices.stateActive).toBe('Active');
      expect(enMessages.farePrices.statePending).toBe('Upcoming');
      expect(enMessages.farePrices.stateExpired).toBe('Expired');
    });

    it('synchronizes all promotions keys', () => {
      expect(enMessages.promotions.promotionsTitle).toBe('Promotions & Discounts');
      expect(enMessages.promotions.promotionsSubtitle).toBe('Manage discount codes and customer incentive campaigns');
      expect(enMessages.promotions.createPromotion).toBe('Add Promotion');
      expect(enMessages.promotions.colCode).toBe('Code');
      expect(enMessages.promotions.colName).toBe('Campaign Name');
      expect(enMessages.promotions.colDiscount).toBe('Discount');
      expect(enMessages.promotions.statusActive).toBe('Active');
      expect(enMessages.promotions.statusUpcoming).toBe('Upcoming');
      expect(enMessages.promotions.statusExpired).toBe('Expired');
      expect(enMessages.promotions.statusSuspended).toBe('Suspended');
    });

    it('synchronizes all shipments keys', () => {
      expect(enMessages.shipments.shipmentsTitle).toBe('Shipment List');
      expect(enMessages.shipments.shipmentsSubtitle).toBe('Manage parcel reception, dispatching, and waybill tracking');
      expect(enMessages.shipments.createShipment).toBe('Create Shipment');
      expect(enMessages.shipments.shipmentRates).toBe('Rate Tables');
      expect(enMessages.shipments.scanCode).toBe('Scan Code');
      expect(enMessages.shipments.colWaybill).toBe('Waybill Code');
      expect(enMessages.shipments.colSender).toBe('Sender');
      expect(enMessages.shipments.colRecipient).toBe('Recipient');
      expect(enMessages.shipments.colFee).toBe('Fee');
      expect(enMessages.shipments.statusCreated).toBe('Awaiting Drop-off');
      expect(enMessages.shipments.statusReceived).toBe('Received');
      expect(enMessages.shipments.statusInTransit).toBe('In Transit');
      expect(enMessages.shipments.statusDelivered).toBe('Delivered');
      expect(enMessages.shipments.statusCancelled).toBe('Cancelled');
      expect(enMessages.shipments.tabRouteFreight).toBe('Route Freight Rates');
      expect(enMessages.shipments.tabLuggage).toBe('Passenger Luggage');
    });

    it('synchronizes all reports keys', () => {
      expect(enMessages.reports.reportsTitle).toBe('Revenue Reports');
      expect(enMessages.reports.eyebrow).toBe('REVENUE REPORTS');
      expect(enMessages.reports.exportCsv).toBe('Export CSV');
      expect(enMessages.reports.filterPanelAria).toBe('Revenue report filters');
      expect(enMessages.reports.dateRangeLabel).toBe('Reporting Period');
      expect(enMessages.reports.groupByLabel).toBe('Group by');
      expect(enMessages.reports.groupDay).toBe('Day');
      expect(enMessages.reports.groupMonth).toBe('Month');
      expect(enMessages.reports.groupQuarter).toBe('Quarter');
      expect(enMessages.reports.netRevenueCard).toBe('Net Revenue');
      expect(enMessages.reports.ticketRevenueCard).toBe('Ticket Revenue');
      expect(enMessages.reports.cargoRevenueCard).toBe('Cargo Revenue');
      expect(enMessages.reports.refundAmountCard).toBe('Refunded Amount');
      expect(enMessages.reports.successfulPaymentsCard).toBe('Successful Payments');
      expect(enMessages.reports.volumeCardTitle).toBe('Tickets & Waybills Issued');
      expect(enMessages.reports.serviceTicket).toBe('Bus Tickets');
      expect(enMessages.reports.serviceStandaloneShipment).toBe('Standalone Cargo');
      expect(enMessages.reports.serviceAccompaniedShipment).toBe('Luggage with Ticket');
    });

    it('synchronizes all auth guard keys', () => {
      expect(enMessages.auth.checkingSession).toBe('Checking admin session…');
      expect(enMessages.auth.redirectingLogin).toBe('Redirecting to login…');
      expect(enMessages.auth.redirectingArea).toBe('Opening the appropriate area for your account…');
      expect(enMessages.auth.restrictedTitle).toBe('Account has no available administrative functions');
      expect(enMessages.auth.restrictedEyebrow).toBe('VEXGO · ADMIN ACCOUNT');
      expect(enMessages.auth.signOut).toBe('Sign Out');
      expect(enMessages.auth.signingOut).toBe('Signing out...');
    });
  });

  describe('English translations verify that static business terms are not left in Vietnamese', () => {
    it('verifies that key labels in Phase A2 modules do not have untranslated Vietnamese text in en.json', () => {
      const vietnameseMarks = [
        'Doanh thu', 'Báo cáo', 'Khuyến mãi', 'Giá vé', 'Đơn hàng', 'Vé xe',
        'Vận chuyển', 'Gửi hàng', 'Hoàn tiền', 'Thanh toán', 'Quản lý'
      ];

      for (const mark of vietnameseMarks) {
        expect(enMessages.reports.reportsTitle).not.toContain(mark);
        expect(enMessages.reports.exportCsv).not.toContain(mark);
        expect(enMessages.farePrices.farePricesTitle).not.toContain(mark);
        expect(enMessages.promotions.promotionsTitle).not.toContain(mark);
        expect(enMessages.shipments.shipmentsTitle).not.toContain(mark);
      }
    });
  });
});
