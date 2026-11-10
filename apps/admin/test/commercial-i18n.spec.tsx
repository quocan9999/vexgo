// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import viMessages from '../src/messages/vi.json';
import enMessages from '../src/messages/en.json';

describe('Commercial & Revenue i18n dictionaries (Phase 3)', () => {
  describe('Bookings namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.bookings.bookingsTitle).toBe('Quản lý đặt vé & Vé xe');
      expect(enMessages.bookings.bookingsTitle).toBe('Booking & Ticket Management');

      expect(viMessages.bookings.bookingCode).toBe('Mã đặt vé');
      expect(enMessages.bookings.bookingCode).toBe('Booking Code');

      expect(viMessages.bookings.ticketCode).toBe('Mã vé');
      expect(enMessages.bookings.ticketCode).toBe('Ticket Code');

      expect(viMessages.bookings.paid).toBe('Đã thanh toán');
      expect(enMessages.bookings.paid).toBe('Paid');

      expect(viMessages.bookings.cancelled).toBe('Đã hủy');
      expect(enMessages.bookings.cancelled).toBe('Cancelled');
    });
  });

  describe('Shipments namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.shipments.shipmentsTitle).toBe('Danh sách phiếu gửi hàng');
      expect(enMessages.shipments.shipmentsTitle).toBe('Shipment List');

      expect(viMessages.shipments.createShipment).toBe('Tạo đơn gửi hàng');
      expect(enMessages.shipments.createShipment).toBe('Create Shipment');

      expect(viMessages.shipments.waybillCode).toBe('Mã vận đơn');
      expect(enMessages.shipments.waybillCode).toBe('Waybill Code');

      expect(viMessages.shipments.statusDelivered).toBe('Đã giao hàng');
      expect(enMessages.shipments.statusDelivered).toBe('Delivered');
    });
  });

  describe('FarePrices namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.farePrices.farePricesTitle).toBe('Quản lý bảng giá vé');
      expect(enMessages.farePrices.farePricesTitle).toBe('Fare Price Management');

      expect(viMessages.farePrices.createFarePrice).toBe('Thêm bảng giá');
      expect(enMessages.farePrices.createFarePrice).toBe('Add Fare Price');

      expect(viMessages.farePrices.basePrice).toBe('Giá vé cơ bản');
      expect(enMessages.farePrices.basePrice).toBe('Base Price');
    });
  });

  describe('Promotions namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.promotions.promotionsTitle).toBe('Chương trình khuyến mãi');
      expect(enMessages.promotions.promotionsTitle).toBe('Promotions & Discounts');

      expect(viMessages.promotions.promotionCode).toBe('Mã khuyến mãi');
      expect(enMessages.promotions.promotionCode).toBe('Promotion Code');

      expect(viMessages.promotions.createPromotion).toBe('Thêm khuyến mãi');
      expect(enMessages.promotions.createPromotion).toBe('Add Promotion');
    });
  });

  describe('Reports namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.reports.reportsTitle).toBe('Báo cáo doanh thu');
      expect(enMessages.reports.reportsTitle).toBe('Revenue Reports');

      expect(viMessages.reports.totalRevenue).toBe('Tổng doanh thu');
      expect(enMessages.reports.totalRevenue).toBe('Total Revenue');

      expect(viMessages.reports.exportExcel).toBe('Xuất Excel');
      expect(enMessages.reports.exportExcel).toBe('Export Excel');
    });
  });
});
