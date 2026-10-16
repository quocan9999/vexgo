# Phase 06 Handoff — Final regression

- Status: **FEATURE 10 READY TO CLOSE**.
- Date: 2026-10-16.
- Baseline: `origin/develop` `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`.
- Worktree / branch: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10` / `feature/tenant-promotions`.
- Commit: this final regression follow-up includes this handoff and `FINAL_HANDOFF.md`; report the resulting HEAD SHA outside this commit.
- Scope: final tests, test synchronization fixes, browser smoke, seed/migration verification, and handoff. No feature behavior, schema, or migration changed in this phase.

## Regression results

- API unit suite: **PASS**, 52 files / 690 tests. The 4 time-sensitive `TripsService` tests now freeze the clock before their fixed 2026-10-15 departure fixtures.
- Admin suite: **PASS**, 51 files / 370 tests. Three asynchronous assertions now wait for API-backed detail/permission content before asserting it.
- Customer Web tests: **PASS**, 104 Node tests and 5 Vitest files / 84 tests.
- A parallel all-app test invocation once caused the booking coupon assertion to hit its 10-second async wait while API/Admin suites were also running. The exact coupon test passed alone (1/1), and the complete Web suite passed when rerun by itself (104 + 84); no product code change was needed.
- Feature 10 MySQL integration set: **PASS**, 5 files / 79 tests against `vexgo_promotion`. It covers promotion tenant/permission behavior, booking identity and transaction rollback/concurrency, payment/webhook behavior, and shipment/ticket public lookup limits.
- Prisma migration-only tests: **PASS**, 2 files / 6 tests when run against the permitted `vexgo_promotion_shadow` database. The limited app account does not have `CREATE`, so these tests must not be pointed at the app database.
- `npm exec -- prisma migrate status`: **PASS**, 28 migrations found and the app schema is up to date.
- `node prisma/verify-seed.mjs`: **PASS**. Seed counts, tenant constraints, promotion quota/ledger/booking snapshots, amounts, and cross-domain invariants show no mismatch.
- Lint: API/Admin **PASS**; Web **PASS** with 0 errors and 40 warnings.
- Typecheck: API/Admin/Web **PASS**.
- Production builds: API/Admin/Web **PASS**.
- `git diff --check`: **PASS** before final documentation staging; rerun after staging/commit.

## Wider-suite environment note

- The earlier API-wide run reported 1,602 passed, 6 failed, and 16 skipped. The six failures were migration test cases that attempted DDL with the restricted app DB user; all six passed when isolated on the allowed shadow DB. No additional database was created.
- `booking-ticket-status-history-db.spec.ts` requires `BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL` for a separate `vexgo_booking_ticket_status_history_*_test` database. That third database is outside the authorized Feature 10 DB pair, so it was not created or used. The Feature 10 booking/payment/ticket/shipment integration suite and the API unit suite pass.

## Browser smoke

- Chromium headless smoke used the actual worktree servers: API health on 4010, Customer Web on 3010, Admin on 3011. API health, Customer `/` and `/trips`, and Admin `/login` returned HTTP 200.
- Playwright runs at 1440×900 and 375×667 recorded no page errors or horizontal overflow for Customer home/trips and Admin login/protected promotion route. The protected route redirected unauthenticated users to login as expected.
- Authenticated Admin promotion list and create form both rendered at both viewport sizes. The form was opened but not submitted, so the smoke did not write data. The dialog received initial focus; tab navigation stayed inside it and Escape closed it.
- No future trip existed in the seeded date window for a browser checkout run. Coupon quote/consume, one-use identity, rollback, and concurrency behavior were verified by the passing MySQL integration tests and UI tests instead.
- Temporary screenshots and JSON reports are outside the repository under `%LOCALAPPDATA%\Temp\vexgo-feature10-smoke`.

## Data, ports, and scope

- `DATABASE_URL` and `MIGRATION_URL` resolve to `127.0.0.1:3306/vexgo_promotion`; `SHADOW_DATABASE_URL` resolves to `127.0.0.1:3306/vexgo_promotion_shadow`. The app user is scoped to the app database; the migration user is scoped to the two Feature 10 databases.
- The existing shared MySQL container remains on 3306; the existing Feature 10 phpMyAdmin-only container remains on 8090. They were not recreated. API/Web/Admin dev servers were stopped after smoke; 4010/3010/3011 are free.
- No other database, container, volume, or the root repository was modified. No `.env`, screenshots, logs, or the supplied ZIP is staged.
- No push, PR, or merge was performed.

## Self-review and remaining limitations

- Promotion consumption stays inside the booking transaction; quota and ledger are not restored by payment expiry/cancel/refund flows. The test matrix checks rollback, identity, tenant isolation, quota concurrency, one-use-per-order, and ticket-only discount with linked shipment reference.
- Guest phone identity remains self-asserted without OTP, as explicitly scoped by the MVP. Signed-in eligibility uses the account's customer identity and verified phone rather than an overridden contact phone.
- The full API aggregator has the environment-specific exceptions above; they are not represented as passing. Feature 10's affected unit, MySQL integration, migration-on-shadow, lint, typecheck, build, seed, and browser gates pass.
