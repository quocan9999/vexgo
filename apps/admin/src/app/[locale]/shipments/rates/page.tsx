import type { Metadata } from 'next';
import { ShipmentRatesManagement } from '@/features/shipments/components/shipment-rates-management';

export const metadata: Metadata = {
  title: 'Bảng giá cước gửi hàng — VexGo Admin',
};

export default function ShipmentRatesPage() {
  return <ShipmentRatesManagement />;
}
