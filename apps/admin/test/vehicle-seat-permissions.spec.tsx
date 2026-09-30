// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VehicleSeatsManagement } from '@/features/vehicles/components/vehicle-seats-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const fixture = vi.hoisted(() => ({
  vehicle: {
    vehicleId: 12,
    licensePlate: '29A-123.45',
    status: 'HOAT_DONG' as const,
    busCompany: { busCompanyId: 10, code: 'FUTA', name: 'Phương Trang' },
    vehicleType: { vehicleTypeId: 7, name: 'Limousine', description: 'Xe cao cấp' },
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  },
  seats: [{
    seatId: 31,
    seatNumber: 'A1',
    position: 'Tầng dưới',
    vehicleId: 12,
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  }],
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/vehicles/services/vehicle-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/vehicles/services/vehicle-service')>(),
  getVehicleById: vi.fn(async () => fixture.vehicle),
  getVehicleSeats: vi.fn(async () => fixture.seats),
  createVehicleSeat: vi.fn(),
  updateVehicleSeat: vi.fn(),
  deleteVehicleSeat: vi.fn(),
}));

afterEach(() => cleanup());

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

async function renderSeatWorkspace() {
  render(<VehicleSeatsManagement vehicleId={12} />);
  await screen.findByRole('heading', { name: 'Ghế gốc của xe' });
}

describe('Vehicle seat action permissions', () => {
  it('keeps seat data readable while hiding all mutation actions without write permissions', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'seat:read']);
    await renderSeatWorkspace();

    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm ghế' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa ghế A1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa ghế A1' })).toBeNull();
  });

  it('renders only actions whose exact seat permission is present', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'seat:read', 'seat:create', 'seat:update']);
    const { rerender } = render(<VehicleSeatsManagement vehicleId={12} />);
    await screen.findByRole('heading', { name: 'Ghế gốc của xe' });

    expect(screen.getByRole('button', { name: 'Thêm ghế' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa ghế A1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xóa ghế A1' })).toBeNull();

    setEmployeeAdminTestSession(['vehicle:read', 'seat:read', 'seat:delete']);
    rerender(<VehicleSeatsManagement vehicleId={12} />);
    expect(screen.queryByRole('button', { name: 'Thêm ghế' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa ghế A1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Xóa ghế A1' })).toBeTruthy();
  });

  it('unmounts an open edit form when seat:update is revoked', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'seat:read', 'seat:update']);
    const { rerender } = render(<VehicleSeatsManagement vehicleId={12} />);
    await screen.findByRole('heading', { name: 'Ghế gốc của xe' });

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa ghế A1' }));
    expect(await screen.findByRole('dialog', { name: 'Chỉnh sửa ghế' })).toBeTruthy();

    setEmployeeAdminTestSession(['vehicle:read', 'seat:read']);
    rerender(<VehicleSeatsManagement vehicleId={12} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa ghế' })).toBeNull());
  });

  it('unmounts an open delete confirmation when seat:delete is revoked', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'seat:read', 'seat:delete']);
    const { rerender } = render(<VehicleSeatsManagement vehicleId={12} />);
    await screen.findByRole('heading', { name: 'Ghế gốc của xe' });

    fireEvent.click(screen.getByRole('button', { name: 'Xóa ghế A1' }));
    const confirm = await screen.findByRole('dialog', { name: 'Xóa ghế A1?' });
    expect(within(confirm).getByRole('button', { name: 'Xóa ghế' })).toBeTruthy();

    setEmployeeAdminTestSession(['vehicle:read', 'seat:read']);
    rerender(<VehicleSeatsManagement vehicleId={12} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xóa ghế A1?' })).toBeNull());
  });
});
