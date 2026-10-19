# Phase 05 Handoff — Customer Web promotions

- Status: **DONE**.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`
- Branch: `feature/tenant-promotions`
- Starting commit: Phase 04 `ea73d2b`.
- Commit: included in the Phase 05 commit; SHA is in the final report.
- Scope: one-way customer checkout quote, persisted promotion snapshots in customer views, and linked shipment reference. No schema or migration changes.

## Delivered

- One-way checkout accepts one promotion code and calls `POST /api/v1/bookings/quote`. Guest identity checks wait for a phone number; edits to phone, trip, seats, or fare invalidate the current quote. Authenticated quote requests use the account session and omit editable `contactPhone`; the UI identifies the verified account phone returned by `/me`.
- A valid server quote shows original ticket subtotal, order-level discount, and discounted ticket subtotal. Cargo remains separate because the quote endpoint does not quote freight. Booking creation sends the code and continues to use the server-created booking/payment amount. A promotion rejection keeps the form and code visible, reports the server message, and does not navigate to QR or retry without the code.
- Payment reads the persisted booking response and displays its code and saved amounts once. Invoice, ticket lookup, and ticket detail display the saved promotion snapshot as an order-level discount; the ticket view does not multiply the discount by ticket count.
- Shipment lookup adds `bookingPromotionCode` only when a shipment is linked to a booking. The UI labels it as a reference and says it reduces ticket price only. Standalone shipments remain without promotion details, and freight fees are not reduced.
- The web project test script now includes the ticket lookup component test. The repository has no separate `/bookings/[id]/detail` page; the existing booking-code link opens `/invoice/[id]`, which reads the protected booking snapshot and serves as the customer booking detail view.

## Files changed

- `apps/api/src/shipments/shipments.service.ts`
- `apps/api/src/tickets/tickets.service.ts`
- `apps/api/test/unit/shipments/shipments.service.spec.ts`
- `apps/api/test/unit/tickets/tickets.service.spec.ts`
- `apps/web/package.json`
- `apps/web/src/features/account/services/bookings.api.ts`
- `apps/web/src/features/account/services/tickets.api.ts`
- `apps/web/src/features/booking/components/one-way-booking.tsx`
- `apps/web/src/features/payments/components/invoice-page.tsx`
- `apps/web/src/features/payments/components/payment-page.tsx`
- `apps/web/src/features/shipments/components/send-freight-page.tsx`
- `apps/web/src/features/shipments/services/shipments.api.ts`
- `apps/web/src/features/tickets/components/ticket-search-page.tsx`
- `apps/web/test/unit/booking/one-way-booking-flow.spec.tsx`
- `apps/web/test/unit/payments/invoice-page.spec.tsx`
- `apps/web/test/unit/payments/payment-page.spec.tsx`
- `apps/web/test/unit/tickets/ticket-search-page.spec.tsx`
- This handoff.

## Verification

- Web unit suite: **PASS**, 5 Vitest files / 84 tests; Node unit suite: 104 tests passed.
- Web typecheck: **PASS**.
- Web lint: **PASS**, 0 errors and 40 warnings.
- Web production build: **PASS**.
- API targeted unit tests: **PASS**, 2 files / 45 tests (`tickets.service.spec.ts`, `shipments.service.spec.ts`).
- API typecheck, lint, and build: **PASS**. API build generated Prisma Client from the unchanged schema.
- `git diff --check`: **PASS**.
- Browser smoke: **BROWSER SMOKE CHƯA XÁC MINH**. CUA reported no available browser surfaces, and local app ports 3010/4010 were not listening. No browser result is claimed.
- No migration or database write was performed in this phase.

## Self-review and residual risk

- Web quote amounts remain previews only; payment and invoice use the persisted server response. The booking quote does not include cargo fees, so checkout labels freight separately and the final server amount remains authoritative.
- There is no dedicated booking-detail route in the current Web app. The existing booking-code link goes to the invoice detail route, which displays the persisted code and order-level discount. This route reuse avoids adding a second customer detail surface.
- Browser responsive/keyboard smoke remains unverified because no browser surface was available. Component tests cover quote state, logged-in identity, stale quote revalidation, server rejection, payment, invoice, ticket, and linked/standalone shipment behavior.
- GitNexus `detect-changes --scope all` reports 16 tracked files, 21 symbols, 1 affected execution flow, and **medium** aggregate risk. The affected flow is `HandleSubmit → ApiError` (3 steps). No high/critical warning was reported.

## Repository state and next

- Expected untracked input archive at worktree root: `vexgo_feature10_promotions_specs_v3_overnight.zip`; do not stage it.
- No push, PR, or merge was performed. No source or database changes were made to the original repository.
- Proceed to Phase 06 using the promotion management master spec and its Phase 06 instructions only.
