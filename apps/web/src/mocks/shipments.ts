import type { Shipment } from '@/types/customer';

export const mockShipments: Shipment[] = [
  { id: 'shipment-001', trackingCode: 'VG-26090101', receiver: 'Trần Minh Anh', route: 'TP. Hồ Chí Minh → Đà Lạt', status: 'in-transit', amount: 85000, updatedAt: 'Hôm nay, 09:40' },
  { id: 'shipment-002', trackingCode: 'VG-26082402', receiver: 'Lê Hoàng Nam', route: 'Đà Nẵng → TP. Hồ Chí Minh', status: 'delivered', amount: 120000, updatedAt: '24/08/2026' },
];
