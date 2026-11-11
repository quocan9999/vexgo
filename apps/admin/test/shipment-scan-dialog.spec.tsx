// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShipmentScanDialog } from '@/features/shipments/components/shipment-scan-dialog';
import * as shipmentLookup from '@/features/shipments/services/shipment-lookup';
import type { ShipmentSummary } from '@/features/shipments/types/shipment';

const mockMatchedShipment: ShipmentSummary = {
  shipmentId: 10,
  waybillCode: 'GH-HN-SG-001',
  status: 'MOI_TAO',
  sentAt: '2026-11-04T08:00:00.000Z',
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
  trip: null,
  totalFee: 80000,
};

describe('ShipmentScanDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders scanner dialog when open is true', () => {
    render(
      <ShipmentScanDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectShipment={vi.fn()}
      />,
    );

    expect(screen.getByText('Quét mã & Tìm phiếu gửi hàng')).not.toBeNull();
    expect(screen.getByText('Máy quét / Nhập mã')).not.toBeNull();
    expect(screen.getByText('Camera quét QR')).not.toBeNull();
    expect(
      screen.getByPlaceholderText(/VD: GH-HN-SG-001 hoặc quét barcode/i),
    ).not.toBeNull();
  });

  it('finds shipment by waybill and calls onSelectShipment when code matches', async () => {
    const onSelectShipment = vi.fn();
    const onOpenChange = vi.fn();

    vi.spyOn(shipmentLookup, 'findShipmentByWaybill').mockResolvedValue(
      mockMatchedShipment,
    );

    render(
      <ShipmentScanDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectShipment={onSelectShipment}
      />,
    );

    const input = screen.getByPlaceholderText(
      /VD: GH-HN-SG-001 hoặc quét barcode/i,
    );
    fireEvent.change(input, { target: { value: 'gh-hn-sg-001' } });

    const submitBtn = screen.getByRole('button', { name: /Tìm vận đơn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(shipmentLookup.findShipmentByWaybill).toHaveBeenCalledWith(
        'GH-HN-SG-001',
      );
      expect(onSelectShipment).toHaveBeenCalledWith(10);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays not found error message when waybill does not exist in company', async () => {
    const onSelectShipment = vi.fn();
    const onOpenChange = vi.fn();

    vi.spyOn(shipmentLookup, 'findShipmentByWaybill').mockResolvedValue(null);

    render(
      <ShipmentScanDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectShipment={onSelectShipment}
      />,
    );

    const input = screen.getByPlaceholderText(
      /VD: GH-HN-SG-001 hoặc quét barcode/i,
    );
    fireEvent.change(input, { target: { value: 'UNKNOWN-WAYBILL-999' } });

    const submitBtn = screen.getByRole('button', { name: /Tìm vận đơn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Không tìm thấy phiếu gửi hàng trong nhà xe của bạn.',
        ),
      ).not.toBeNull();
    });

    expect(onSelectShipment).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('shows error when entered code does not match waybill pattern', async () => {
    const onSelectShipment = vi.fn();

    render(
      <ShipmentScanDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectShipment={onSelectShipment}
      />,
    );

    const input = screen.getByPlaceholderText(
      /VD: GH-HN-SG-001 hoặc quét barcode/i,
    );
    // Waybill minimum length is 6 characters
    fireEvent.change(input, { target: { value: '12' } });

    const submitBtn = screen.getByRole('button', { name: /Tìm vận đơn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Mã vận đơn không đúng định dạng chuẩn.'),
      ).not.toBeNull();
    });

    expect(onSelectShipment).not.toHaveBeenCalled();
  });
});
