import InvoicePage from '@/features/payments/components/invoice-page';

export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <InvoicePage params={Promise.resolve({ id: invoiceId })} />;
}
