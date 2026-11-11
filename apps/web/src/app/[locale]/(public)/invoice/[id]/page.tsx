import InvoicePage from '@/features/payments/components/invoice-page';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InvoicePage params={params} />;
}
