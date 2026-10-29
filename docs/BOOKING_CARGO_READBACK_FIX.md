# Customer booking cargo readback

## Problem and resulting behavior

An attached-cargo booking is created with ticketSubtotal190000, shippingFee50000
and totalAmount240000. Customer booking list/detail did not load the shipment relation,
so mapBooking returned cargoFee0 and cargoItems[] while retaining totalAmount240000.
Mobile correctly rejected that inconsistent response and withheld the payment QR.

Both customer queries now include donGiaoDich.phieuGuiHang.hangHoas.loaiHangHoa,
matching the existing public-detail loader. The existing serializer returns the stored
fee and items without client estimates. No new endpoint, response field, pricing rule,
ownership rule, database schema or migration is introduced.

## Regression evidence

- New relational-query unit fake returns relations only when requested. Six cargo
  cases failed before the fix; after the fix all10 regression cases pass.
- Covers pending, paid, zero-fee shipment and ticket-only order through both readers;
  verifies the original ticket subtotal, discount, final ticket subtotal, cargo fee,
  final total and item/category data. Other-owner detail remains forbidden and the list
  remains constrained to the authenticated customer.
- All booking unit tests:84/84 passed. Booking/routes/vehicles targeted suite:127/127.
- All Backend unit tests:1008/1008 passed across80files.
- Typecheck and Nest build passed. Scoped type-aware oxlint:0errors, one preexisting
  unused-local warning for mapBooking's tickets variable; not removed in this fix.
- An initial broad API run used a stale generated Prisma client and failed unrelated
  routes/vehicle/chat paths; it was interrupted. After binding the matching generated
  client, relevant tests and the complete unit suite passed. Full API integration suite
  is not certified by the unit result.

## Real database verification and limits

Read-only probe against main local MySQL and the newly built service confirms QA
booking842 detail/list now return cargoFee50000 and the single5kg parcel. The DB
already contained the correct shipment25 and order860; no order, payment or item was
edited or recreated by the probe. The server expired/cancelled the unpaid QA booking
during investigation; amounts/items remain available for historical readback.

This probe invokes the real compiled service/Prisma query and is not an authenticated
HTTP test. The earlier phone attempt on old Backend had POST201 then authenticated
GET200 and exposed the mismatch. Do not pay the old cancelled order.

Follow-up on 2026-10-29: the user started the repaired API and reconnected the real
Android device. Fresh booking843 (order861, shipment26, one5kg parcel) returned
ticket190000 + cargo50000 = total240000 through the native checkout/readback.
Exactly one transaction was submitted in SePay Test Mode for240000. The provider
reported webhook success; real local MySQL and the compiled service subsequently
reported the booking/order/ticket paid with one matching cargo item. The phone
reached booking success, showed boarding QR and waybill, and opened a receipt with
the correct240000 total. No real bank transfer was made.

The ticket cancellation sheet correctly refused online cancellation because the
shipment remains active; it was dismissed without cancelling the order. During this
flow the Mobile success grand-total label exposed a separate binding error (showing
ticket190000 instead of order240000). A Mobile fix passed720Flutter tests and
was installed manually; its installed APK hash matched the built artifact. Existing
paid ticket843, boarding QR and receipt240000 were reopened successfully on v2.
The new Success label itself has widget regression coverage but was not revisited
on the native success route after installation.

## Scope and graph analysis

Branch fix/customer-booking-cargo-readback based on Backend develop d4ad3d1.
Production change is14added lines in bookings.service.ts plus the regression test.
GitNexus index for vexgo_web refreshed to d4ad3d1. Exact service-method impact reports
LOW, one direct controller caller each, module Bookings. Analyzer also warned that
global process traversal is truncated; it is not whole-system proof. Current source
and public loader were checked directly. Initial detect-changes could not bind the
new checkout. Before publication, this worktree was indexed separately and
detect-changes --scope all --repo . completed:3files,28symbols, low risk. The graph
reported0affected processes; global traversal warnings mean that count is not a
claim that all possible flows were exhaustively proven unaffected.

The user subsequently authorized commit/push and separate Backend/Mobile PRs.
No merge is performed by this publication step. Existing source/runtime
worktrees and the user's untracked seed script are preserved. QA evidence is outside
Git in mobile-qa-evidence/cargo-device-20261029; it contains private runtime material
and must not be published wholesale.
