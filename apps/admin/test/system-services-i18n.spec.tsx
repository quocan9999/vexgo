// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import viMessages from '../src/messages/vi.json';
import enMessages from '../src/messages/en.json';

describe('System & Customer Services i18n dictionaries (Phase 4)', () => {
  describe('BusCompanies namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.busCompanies.busCompaniesTitle).toBe('Quản lý nhà xe');
      expect(enMessages.busCompanies.busCompaniesTitle).toBe('Bus Company Management');

      expect(viMessages.busCompanies.createBusCompany).toBe('Thêm nhà xe');
      expect(enMessages.busCompanies.createBusCompany).toBe('Add Bus Company');

      expect(viMessages.busCompanies.companyCode).toBe('Mã nhà xe');
      expect(enMessages.busCompanies.companyCode).toBe('Company Code');
    });
  });

  describe('Vehicles and VehicleTypes namespace', () => {
    it('provides complete and matching keys for vehicles and types', () => {
      expect(viMessages.vehicles.vehiclesTitle).toBe('Danh sách xe');
      expect(enMessages.vehicles.vehiclesTitle).toBe('Vehicle Fleet');

      expect(viMessages.vehicles.createVehicle).toBe('Thêm xe');
      expect(enMessages.vehicles.createVehicle).toBe('Add Vehicle');

      expect(viMessages.vehicleTypes.vehicleTypesTitle).toBe('Quản lý loại xe');
      expect(enMessages.vehicleTypes.vehicleTypesTitle).toBe('Vehicle Type Management');

      expect(viMessages.vehicleTypes.createVehicleType).toBe('Thêm loại xe');
      expect(enMessages.vehicleTypes.createVehicleType).toBe('Add Vehicle Type');
    });
  });

  describe('Customers namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.customers.customersTitle).toBe('Quản lý khách hàng');
      expect(enMessages.customers.customersTitle).toBe('Customer Management');

      expect(viMessages.customers.customerCode).toBe('Mã khách hàng');
      expect(enMessages.customers.customerCode).toBe('Customer Code');

      expect(viMessages.customers.loyaltyPoints).toBe('Điểm tích lũy');
      expect(enMessages.customers.loyaltyPoints).toBe('Loyalty Points');
    });
  });

  describe('AdminAccounts and RBAC namespace', () => {
    it('provides complete and matching keys for accounts and permissions', () => {
      expect(viMessages.adminAccounts.adminAccountsTitle).toBe('Quản lý tài khoản Admin');
      expect(enMessages.adminAccounts.adminAccountsTitle).toBe('Admin Account Management');

      expect(viMessages.adminAccounts.createAccount).toBe('Thêm tài khoản');
      expect(enMessages.adminAccounts.createAccount).toBe('Add Account');

      expect(viMessages.rbac.rbacTitle).toBe('Phân quyền vai trò');
      expect(enMessages.rbac.rbacTitle).toBe('Platform RBAC Management');

      expect(viMessages.rbac.tenantRbacTitle).toBe('Phân quyền nhà xe');
      expect(enMessages.rbac.tenantRbacTitle).toBe('Tenant RBAC Management');
    });
  });

  describe('SupportChat and Reviews namespace', () => {
    it('provides complete and matching keys for chat and reviews', () => {
      expect(viMessages.supportChat.supportChatTitle).toBe('Chăm sóc khách hàng');
      expect(enMessages.supportChat.supportChatTitle).toBe('Customer Support Chat');

      expect(viMessages.supportChat.inbox).toBe('Hộp thư');
      expect(enMessages.supportChat.inbox).toBe('Inbox');

      expect(viMessages.reviews.reviewsTitle).toBe('Quản lý đánh giá & phản hồi');
      expect(enMessages.reviews.reviewsTitle).toBe('Reviews & Feedback Management');

      expect(viMessages.reviews.averageRating).toBe('Điểm đánh giá trung bình');
      expect(enMessages.reviews.averageRating).toBe('Average Rating');
    });
  });
});
