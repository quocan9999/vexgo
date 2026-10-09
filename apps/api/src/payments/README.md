# Payment settlement integration

## Current production writers

The `develop` base and this feature branch do not contain a production charge
callback, controller, or background job that confirms a provider charge. On
this branch, `PaymentsModule` registers and exports `PaymentSettlementService`,
but no production caller invokes `confirmPayment`. The service is currently the
single charge-settlement boundary added by this feature; it is exercised from
the API integration tests through Nest dependency injection.

The other successful-payment status writer is refund-only:
`RefundProcessorService.processRefund` claims records with
`loaiGiaoDich = HOAN_TIEN` and marks those refund records successful after the
refund provider responds successfully. It does not mark a charge or its order
as paid. Ticket cancellation creates a `HOAN_TIEN` record and cancels its
order; it does not confirm a charge.

The in-flight concurrency integration test uses a test-only payment transaction
that acquires the shared order lock. This exercises the lock protocol against
the real shipment cancellation endpoint. There is no production charge
entrypoint to drive that race test today.

## Contract for a future charge callback or job

Before calling `PaymentSettlementService.confirmPayment(paymentId)`, a future
provider adapter must verify the provider signature, transaction identity, and
confirmed charge status. Perform provider network calls before entering the
database transaction. Then call the settlement service; do not update charge
`ThanhToan` status or `DonGiaoDich` paid status directly in the callback/job.

`confirmPayment` is the local persistence and state-transition boundary. It
serializes against shipment cancellation by locking the shared `DonGiaoDich`
row, then validates and updates the payment and order in one transaction. It
does not verify provider signatures or contact a payment provider itself.
