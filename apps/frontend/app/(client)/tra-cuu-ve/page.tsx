import { Metadata } from 'next';
import ClientLayout from '@/modules/client/common/layouts/ClientLayout';
import { TicketSearchClientPage } from '@/modules/client/ticket-search/pages/TicketSearchClientPage';

export const metadata: Metadata = {
  title: 'Tra cứu thông tin đặt vé - BUSWAY',
  description: 'Tra cứu thông tin đặt vé của bạn',
};

export default function TicketSearchPage() {
  return (
    <ClientLayout>
      <TicketSearchClientPage />
    </ClientLayout>
  );
}
