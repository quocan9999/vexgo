// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { ShipmentOperations } from '@/features/shipments/components/shipment-operations';
import type { ShipmentDetail } from '@/features/shipments/types/shipment';
import * as operations from '@/features/shipments/services/shipment-operations';
const shipment = {
  shipmentId: 1,
  status: 'MOI_TAO',
  paymentStatus: 'CHO_THANH_TOAN',
  trip: null,
  cargoItems: [{ cargoId: 2, name: 'Kiện sách', weightKg: 3 }],
  feeSummary: { freightPayer: 'NGUOI_GUI', outstandingAmount: 150000 },
  totalFee: 150000,
} as ShipmentDetail;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('counter operations', () => {
  it('confirms a changed backend price before acceptance and never collects payment as part of receiving', async () => {
    const request = vi
      .spyOn(operations, 'shipmentOperation')
      .mockRejectedValueOnce(
        new operations.ShipmentOperationError(
          'Đổi giá',
          'SHIPMENT_PRICE_CONFIRMATION_REQUIRED',
          150000,
          160000,
        ),
      )
      .mockResolvedValueOnce({});
    const updated = vi.fn();
    render(<ShipmentOperations shipment={shipment} onUpdated={updated} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Cân đo và tiếp nhận' }),
    );
    fireEvent.change(screen.getByLabelText('Khối lượng thực tế (kg)'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi nhận' }));
    await screen.findByText(/Cước thay đổi từ/);
    expect(updated).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith(1, 'accept', 'POST', {
      items: [{ cargoId: 2, weight: 4 }],
      note: undefined,
      confirmPriceChange: false,
    });
    fireEvent.change(screen.getByLabelText('Ghi chú (bắt buộc)'), {
      target: { value: 'Khách đồng ý sau cân lại' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Khách đồng ý cước mới — tiếp nhận' }),
    );
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(request).toHaveBeenLastCalledWith(1, 'accept', 'POST', {
      items: [{ cargoId: 2, weight: 4 }],
      note: 'Khách đồng ý sau cân lại',
      confirmPriceChange: true,
    });
  });
  it('records explicit cash amount without tying collection to delivery', async () => {
    const request = vi
      .spyOn(operations, 'shipmentOperation')
      .mockResolvedValue({});
    const updated = vi.fn();
    render(
      <ShipmentOperations
        shipment={{ ...shipment, status: 'DA_TIEP_NHAN' }}
        onUpdated={updated}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Ghi nhận thu tiền mặt' }),
    );
    fireEvent.change(screen.getByLabelText('Số tiền thực tế (đồng)'), {
      target: { value: '150000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi nhận' }));
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith(1, 'collect-payment', 'POST', {
      amount: 150000,
      note: undefined,
    });
  });
});
