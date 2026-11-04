// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShipmentPrintView } from '@/features/shipments/components/print/shipment-print-view';
import * as shipmentService from '@/features/shipments/services/shipment-service';
import type { ShipmentDetail } from '@/features/shipments/types/shipment';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('type=label'),
}));

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

const mockDetail: ShipmentDetail = {
  shipmentId: 10,
  waybillCode: 'GH-HN-SG-001',
  status: 'MOI_TAO',
  sentAt: '2026-11-04T08:00:00.000Z',
  dropoffDeadline: '2026-11-07T08:00:00.000Z',
  note: 'Giao giờ hành chính',
  sender: {
    fullName: 'Trần Văn Gửi',
    phoneNumber: '0911222333',
  },
  receiver: {
    fullName: 'Lê Thị Nhận',
    phoneNumber: '0988777666',
  },
  originPoint: {
    pointId: 1,
    name: 'Bến xe Miền Tây',
    code: 'BXMT',
    address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM',
  },
  destinationPoint: {
    pointId: 2,
    name: 'Bến xe Giáp Bát',
    code: 'BXGB',
    address: 'Km6 Đường Giải Phóng, Giáp Bát, Hoàng Mai, Hà Nội',
  },
  carrier: {
    id: 1,
    name: 'Nhà Xe Phương Trang',
  },
  cargoItems: [
    {
      cargoId: 1,
      name: 'Kiện quần áo',
      typeName: 'Hàng thông thường',
      quantity: 2,
      weightKg: 5,
      declaredValue: 500000,
      dimensions: null,
      description: null,
    },
  ],
  cargoFeeDetails: [],
  history: [],
  totalFee: 80000,
  feeSummary: {
    mainFee: 80000,
    serviceFee: 0,
    discountAmount: 0,
    totalFee: 80000,
    freightPayer: 'NGUOI_GUI',
    paidAmount: 0,
    estimatedFee: 80000,
  },
  trip: null,
  paymentStatus: 'CHO_THANH_TOAN',
};

describe('ShipmentPrintView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading state then displays shipment label', async () => {
    vi.spyOn(shipmentService, 'getShipmentById').mockResolvedValue(mockDetail);

    render(<ShipmentPrintView shipmentId={10} />);

    expect(screen.getByText('Đang tải dữ liệu in ấn...')).not.toBeNull();

    await waitFor(() => {
      expect(screen.getAllByText('GH-HN-SG-001').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Tem dán kiện/)).not.toBeNull();
    expect(screen.getByText(/Biên nhận/)).not.toBeNull();
    expect(screen.getByRole('button', { name: /In ngay/ })).not.toBeNull();
    // Watermark notice for MOI_TAO
    expect(
      screen.getAllByText(/CƯỚC DỰ KIẾN – CHƯA TIẾP NHẬN/i).length,
    ).toBeGreaterThan(0);
  });

  it('switches between label view and receipt view', async () => {
    vi.spyOn(shipmentService, 'getShipmentById').mockResolvedValue(mockDetail);

    render(<ShipmentPrintView shipmentId={10} />);

    await waitFor(() => {
      expect(screen.getAllByText('GH-HN-SG-001').length).toBeGreaterThan(0);
    });

    // Switch to receipt
    const receiptTabBtn = screen.getByRole('button', {
      name: /Biên nhận \(K80\)/i,
    });
    fireEvent.click(receiptTabBtn);

    expect(screen.getByText(/PHIẾU BIÊN NHẬN GỬI HÀNG/i)).not.toBeNull();
    expect(screen.getByText(/Trần Văn Gửi/i)).not.toBeNull();
    expect(screen.getByText(/Lê Thị Nhận/i)).not.toBeNull();
  });

  it('handles cancelled shipment by disabling print and displaying warning', async () => {
    vi.spyOn(shipmentService, 'getShipmentById').mockResolvedValue({
      ...mockDetail,
      status: 'DA_HUY',
    });

    render(<ShipmentPrintView shipmentId={10} />);

    await waitFor(() => {
      expect(screen.getAllByText('GH-HN-SG-001').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Đơn hàng đã bị hủy/i)).not.toBeNull();
    const printBtn = screen.getByRole('button', { name: /In ngay/ });
    expect((printBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays error state when fetching shipment fails', async () => {
    vi.spyOn(shipmentService, 'getShipmentById').mockRejectedValue(
      new Error('Không tìm thấy phiếu gửi hàng.'),
    );

    render(<ShipmentPrintView shipmentId={999} />);

    await waitFor(() => {
      expect(
        screen.getByText('Không tìm thấy phiếu gửi hàng.'),
      ).not.toBeNull();
    });
  });
});
