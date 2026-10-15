# Phase 06 Handoff — Final regression

- Status: **FEATURE 10 NOT READY**.
- Baseline: `origin/develop` `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`.
- Worktree / branch: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10` / `feature/tenant-promotions`.
- Commit: this handoff and the shipment response expectation are included in the Phase 06 commit; SHA is in the final report.
- Scope: final regression, DB invariant check, local HTTP smoke, and remaining-gate report. No schema or migration changes.

## Acceptance and regression results

- Feature 10 checkout/payment/ticket/shipment UI: **PASS**. Web tests: 5 Vitest files / 84 tests, plus 104 Node unit tests. Web typecheck and production build passed. Web lint returned 0 errors and 40 warnings.
- API Phase 05 ticket/shipment unit tests: **PASS**, 2 files / 45 tests. API lint, typecheck, and build passed.
- API real-MySQL regression: **PASS**, 5 files / 79 tests, run with the worktree `.env` target restricted to `vexgo_promotion` at `127.0.0.1:3306` and app user `vexgo_promotion_app`. Coverage included tenant promotion permissions/isolation, booking identity and quote/create/rollback/concurrency, payment/webhook behavior, public shipment privacy/rate limit, and ticket lookup rate limit. Webhook requests were local integration tests; no provider was contacted.
- The first shipment integration run exposed an outdated standalone response expectation. The implementation intentionally returns `bookingPromotionCode: null`; the test now asserts that field. The complete 79-test integration set passed after the update.
- API full unit suite: **686/690 passed**. Four failures are in `test/unit/trips/trips.service.spec.ts`; fixtures use departure dates on 2026-10-15, while the environment date is 2026-10-16, so the service correctly filters them as departed. This is a stale time-dependent test fixture, outside the promotion changes; rerun after freezing or moving those fixture dates forward.
- Admin full suite: **369/370 passed**. `admin-accounts-management.spec.tsx` once failed because its synchronous detail assertion ran while the dialog still showed “Đang tải thông tin tài khoản…”. The same test passed in isolation (1 passed / 24 skipped). Admin lint, typecheck, and production build passed.
- `npm exec -- prisma migrate status`: **PASS**, 28 migrations found and schema up to date. No migration was added or applied.
- `node prisma/verify-seed.mjs`: **PASS**. Seed minimums, promotion counters/ledger/snapshots, booking totals, and shipment totals showed no invariant mismatch. A scoped read-only audit found zero remaining integration fixtures for booking, payment, shipment, or promotion tenant prefixes.
- `git diff --check`: **PASS**.

## CLI smoke and security

- API `GET /api/v1/health`, Customer `/`, and Admin `/login` each returned HTTP 200 on ports 4010, 3010, and 3011. The three worktree dev servers were stopped after the smoke attempt.
- **BROWSER SMOKE CHƯA XÁC MINH.** CUA listed no browser surfaces. Installed Edge/Chrome headless invocations exited without DOM output or screenshot artifacts. No viewport, keyboard, checkout, or Admin interaction is claimed as passed. The promotion UI component tests and production builds passed, but the browser gate remains open.
- Tenant isolation, promotion permission checks, guest/registered identity, public lookup privacy/rate limiting, booking rollback and concurrency, late webhook behavior, and promotion non-restoration on cancellation are covered by the existing Phase 04 integration suite and the Phase 06 targeted regression run.

## Self-review and remaining blockers

- The booking quote remains a server preview; payment and invoice display persisted server amounts. Cargo stays separate from ticket discount. Ticket discount is rendered at order level. Shipment lookup only exposes a linked booking code as a reference and never reduces freight fees.
- No test fixtures remained after integration cleanup. The application DB remained the isolated promotion DB; no other database was targeted.
- This phase is **NOT READY** because the browser responsive/keyboard smoke is unverified, and the broader API suite has four stale date-based failures. The Admin suite also had one intermittent loading assertion, although it passed in isolation.
- To close the remaining gates: fix/freeze the trip test dates and rerun the API unit suite; rerun the full Admin suite; run Edge/Chromium/Playwright smoke at 1440×900 and 375×667 when a working headless browser is available.

## Repository state

- Phase 05 commit: `63a22cb` (`feat(web): hiển thị khuyến mãi trong luồng khách hàng`).
- No push, PR, or merge was performed. The supplied archive `vexgo_feature10_promotions_specs_v3_overnight.zip` remains untracked and must not be staged.
- Final `git status`, branch SHA, and Phase 06 commit are recorded in the final agent report.
