// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantDashboardHeader } from '../src/features/tenant-dashboard/components/tenant-dashboard-header';
import { TenantMetricsGrid } from '../src/features/tenant-dashboard/components/tenant-metrics-grid';
import { TenantUpcomingTrips } from '../src/features/tenant-dashboard/components/tenant-upcoming-trips';
import { TenantUrgentAlerts } from '../src/features/tenant-dashboard/components/tenant-urgent-alerts';
import type {
  OperationalMetrics,
  UpcomingTripItem,
  UrgentAlerts,
} from '../src/features/tenant-dashboard/types/tenant-dashboard';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Tenant Dashboard Frontend Components', () => {
  afterEach(() => {
    cleanup();
  });

  const mockMetrics: OperationalMetrics = {
    totalTripsToday: 12,
    preparingTrips: 5,
    runningTrips: 3,
    completedTrips: 4,
    cancelledTrips: 0,
    bookedTicketsToday: 184,
    totalSeatsToday: 240,
    loadFactorPercent: 77,
    totalShipmentsToday: 38,
    unassignedShipmentsToday: 4,
    estimatedRevenueToday: 46250000,
  };

  const mockTrips: UpcomingTripItem[] = [
    {
      tripId: 101,
      tripCode: 'CX-SG-DL-0801',
      departureDate: '08-11-2026',
      departureTime: '08:30',
      routeName: 'Sài Gòn - Đà Lạt',
      departureLocation: 'Bến xe Miền Đông',
      arrivalLocation: 'Bến xe Liên tỉnh Đà Lạt',
      licensePlate: '51B-123.45',
      vehicleTypeName: 'Limousine 34 phòng',
      bookedSeats: 28,
      totalSeats: 34,
      loadFactorPercent: 82,
      status: 'CHUA_KHOI_HANH',
    },
  ];

  const mockAlerts: UrgentAlerts = {
    pendingBookingsCount: 3,
    unassignedShipmentsCount: 4,
    departingSoonLowOccupancyCount: 1,
  };

  it('renders TenantMetricsGrid with formatted operational data', () => {
    render(<TenantMetricsGrid metrics={mockMetrics} />);

    expect(screen.getByText('Chuyến xe hôm nay')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('5 sắp chạy')).toBeDefined();
    expect(screen.getByText('77%')).toBeDefined();
    expect(screen.getByText('184 / 240 ghế')).toBeDefined();
    expect(screen.getByText('38')).toBeDefined();
    expect(
      screen.getByText('4 kiện chưa xếp lên chuyến', { exact: false }),
    ).toBeDefined();
    expect(screen.getByText('46.250.000 ₫')).toBeDefined();
  });

  it('renders TenantUpcomingTrips table correctly with route and license plate', () => {
    render(<TenantUpcomingTrips trips={mockTrips} />);

    expect(screen.getByText('Chuyến xe sắp khởi hành')).toBeDefined();
    expect(screen.getByText('08:30')).toBeDefined();
    expect(screen.getByText('Sài Gòn - Đà Lạt')).toBeDefined();
    expect(screen.getByText('51B-123.45')).toBeDefined();
    expect(screen.getByText('Limousine 34 phòng')).toBeDefined();
    expect(screen.getByText('82%')).toBeDefined();
    expect(screen.getByText('Chưa xuất bến')).toBeDefined();
  });

  it('renders TenantUpcomingTrips empty state when no trips are scheduled', () => {
    render(<TenantUpcomingTrips trips={[]} />);

    expect(
      screen.getByText('Không có chuyến xe nào sắp xuất bến'),
    ).toBeDefined();
  });

  it('renders TenantUrgentAlerts with pending action badges when issues exist', () => {
    render(<TenantUrgentAlerts alerts={mockAlerts} />);

    expect(screen.getByText('Việc cần xử lý ngay')).toBeDefined();
    expect(
      screen.getByText('3 vé giữ chỗ chờ thanh toán', { exact: false }),
    ).toBeDefined();
    expect(
      screen.getByText('4 kiện hàng chưa gán xe', { exact: false }),
    ).toBeDefined();
    expect(
      screen.getByText(
        '1 chuyến sắp chạy có tỷ lệ ghế < 30%',
        { exact: false },
      ),
    ).toBeDefined();
  });

  it('renders TenantUrgentAlerts positive state when zero alerts', () => {
    render(
      <TenantUrgentAlerts
        alerts={{
          pendingBookingsCount: 0,
          unassignedShipmentsCount: 0,
          departingSoonLowOccupancyCount: 0,
        }}
      />,
    );

    expect(screen.getByText('Vận hành ổn định')).toBeDefined();
  });

  it('renders TenantDashboardHeader with title, date, and live badge', () => {
    const onRefresh = vi.fn();
    const onAutoRefreshChange = vi.fn();

    render(
      <TenantDashboardHeader
        businessDate="08-11-2026"
        isRefreshing={false}
        lastUpdated={new Date('2026-11-08T08:30:00')}
        autoRefreshInterval={30}
        onRefresh={onRefresh}
        onAutoRefreshChange={onAutoRefreshChange}
      />,
    );

    expect(screen.getByText('Trung tâm Điều hành Nhà xe')).toBeDefined();
    expect(screen.getByText('Trực tiếp')).toBeDefined();
    expect(
      screen.getByText('Giám sát hoạt động vận tải & điều độ ngày 08-11-2026'),
    ).toBeDefined();
    expect(screen.getByText('30s')).toBeDefined();
  });
});
