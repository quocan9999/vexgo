# Phase 04 Handoff — Booking quote and atomic promotion use

- Status: **DONE**.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`
- Branch: `feature/tenant-promotions`
- Base: `origin/develop` `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`.
- Starting commit: Phase 03 `53838afc723025783832201cb27e6cb01b2c7fb2`.
- Commit: commit chứa handoff này; SHA được báo sau khi commit.
- Scope: API quote, booking transaction, promotion usage ledger/snapshot, legacy validator retirement, and MySQL coverage. No migration or schema changes.

## Delivered

- `POST /api/v1/bookings/quote` now accepts optional auth and guest `contactPhone`, loads trip seats and fare from the database, returns decimal strings in `{ data }`, and never reserves quota or writes rows. Unsupported request fields such as client totals are rejected by the global validation pipe.
- A requested code is tenant scoped to the trip and fails closed for unknown, suspended, unavailable, not-started, expired, exhausted, already-used, below-minimum, or legacy-unconfigured promotions. Percentage and fixed discounts use Prisma Decimal and HALF_UP rounding to whole VND. The quote marks guest identity unchecked when the phone is absent.
- `POST /api/v1/bookings` resolves a guest phone or the signed-in customer's database profile and verified account phone. Contact phone cannot override a signed-in identity. The booking transaction locks the promotion row, rechecks status/date/quota/minimum/identity, and records one usage, one counter increment, and the booking discount snapshot in the same transaction.
- Locked promotion and usage reads use MySQL `FOR UPDATE` current reads. A first real race test exposed that a Prisma consistent read under MySQL REPEATABLE READ could see a stale quota after the row lock; the current-read implementation now returns exactly one success for last-use and same-phone races.
- Ticket discounts are allocated against original ticket prices in ascending `gheChuyenXeId` order with the rounding remainder assigned to the last ticket. Order/payment totals include the full cargo fee. Booking detail responses return the stored promotion code and discount snapshot.
- `POST /api/v1/promotions/validate` returns HTTP 410 `PROMOTION_VALIDATE_DEPRECATED`; it no longer calculates a discount from client-supplied totals. Payment expiry/cancellation logic was not changed and does not delete a promotion ledger or restore quota.

## Files changed

- `apps/api/src/bookings/bookings.controller.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/dto/booking-quote.dto.ts`
- `apps/api/src/promotions/promotions.controller.ts`
- `apps/api/src/promotions/promotions.service.ts`
- `apps/api/test/integration/bookings/booking-status-history.spec.ts`
- `apps/api/test/unit/bookings/bookings.service.spec.ts`
- `apps/api/test/unit/promotions/promotions.service.spec.ts`
- This handoff.

## Verification

- `npm run typecheck --prefix apps/api` — PASS.
- `npm run lint --prefix apps/api` — PASS.
- `npm run build --prefix apps/api` — PASS, including Prisma Client generation from the existing schema.
- `npm exec --workspace=@vexgo/api -- vitest run test/unit/promotions/promotions.service.spec.ts test/unit/bookings/bookings.service.spec.ts test/integration/promotions/promotions-api.spec.ts test/integration/bookings/booking-status-history.spec.ts` — PASS, 4 files / 68 tests.
- The booking integration suite used real MySQL at `127.0.0.1:3306`, database `vexgo_promotion`, app account `vexgo_promotion_app`. It verified quote no-side-effects, two-seat single consumption, payment amount, cargo fee unaffected, guest-to-registered reuse, verified-phone changes, last-use concurrency, same-phone concurrency, rollback after real ledger/counter writes, expiry without quota restoration, and HTTP 410 legacy behavior.
- `node prisma/verify-seed.mjs` — PASS after integration cleanup. Baseline remained 15 promotions, 27 bookings, 45 transactions; promotion use ledger and counter/snapshot checks reported zero mismatches. No migration was applied, and shadow/other databases were not used.
- `git diff --check` — PASS. Git emitted only its LF-to-CRLF advisory for three edited files.

## Self-review and residual risk

- GitNexus `detect-changes --scope all` reports 9 changed files, 16 symbols, 10 affected execution flows, and **high** aggregate risk because the change touches the central booking path. Exact pre-edit impacts for `getBookingQuote`, `createBooking`, `validatePromotion`, and `mapBooking` were LOW; the aggregate warning is retained here rather than treated as an all-clear. The full affected booking integration suite and both real MySQL concurrency paths passed.
- This phase did not add a coupon-specific partial-refund test. The existing ticket refund calculation uses `Ve.giaThucTe`; the coupon expiry/cancellation persistence path is covered. Phase 06 should run the broader payment/refund regression suite and report any remaining coupon/refund coverage gap.
- No known blocker for proceeding to Phase 05.

## Repository state and next

- Expected untracked input archive at worktree root: `vexgo_feature10_promotions_specs_v3_overnight.zip`; do not stage it.
- No push, PR, or merge was performed. No source or database changes were made to the original repository.
- Proceed to Phase 05 by reading `MASTER_SPEC.md`, this handoff, and only `spec/PHASE_05_CUSTOMER_WEB.md`.
