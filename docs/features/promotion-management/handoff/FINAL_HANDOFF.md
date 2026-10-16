# Feature 10 — Final handoff

- Status: **FEATURE 10 READY TO CLOSE**.
- Date: 2026-10-16.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`.
- Branch: `feature/tenant-promotions`.
- Baseline: `origin/develop` at `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`.
- Final SHA: commit containing this handoff; the agent report records the resulting HEAD SHA.
- Integration: local only. **No push, PR, or merge.**

## Phase commits

| Phase | Commit | Result |
|---|---|---|
| 00 — Baseline and contract | `e92fbcb` | Contract freeze and baseline audit |
| 01 — Schema, quota, ledger | `429f1f0` | Forward migration, usage ledger, seed and verifier |
| 02 — Promotions API and RBAC | `1f93a8f` | Tenant-scoped read/create/status API and permission checks |
| 03 — Admin UI | `53838af` | API-backed list, create, detail, status controls |
| 04 — Booking consumption | `ea73d2b` | Server quote and atomic quota/ledger consumption |
| 05 — Customer Web | `63a22cb` | One-way booking code entry and persisted discount display |
| 06 — Final regression | `fe3dce5` plus this final follow-up commit | Regression, environment exceptions, browser smoke and final report |

## Verification summary

- API unit suite: 52 files / 690 tests passed.
- Admin suite: 51 files / 370 tests passed.
- Customer Web: 104 Node tests and 5 Vitest files / 84 tests passed.
- Feature 10 real-MySQL integration set: 5 files / 79 tests passed on `vexgo_promotion`.
- Migration tests: 2 files / 6 tests passed on `vexgo_promotion_shadow`; migration status reports 28 migrations and an up-to-date schema.
- Seed verifier passed with no promotion counter, ledger, booking snapshot, amount, or tenant invariant mismatches.
- API/Admin/Web lint, typecheck, and production builds passed. Web lint reports 40 warnings and 0 errors.
- Chromium/Playwright smoke passed at 1440×900 and 375×667 for Customer home/trips and Admin login/promotions/create form. No page errors or horizontal overflow were recorded; Admin dialog focus, tab containment, and Escape-close were checked.

## Required environment caveat

- The API-wide aggregator is not reported as fully green: its six migration cases failed with the restricted app DB user's missing `CREATE` grant, then passed on the permitted shadow DB. A separate ticket status history DB suite expects a third database named by `BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL`; it was not created or used. Feature 10's affected unit and real-MySQL integration suites pass.
- No future seeded trip was available for browser checkout. Coupon checkout/identity/quota/rollback/concurrency paths are covered by real-MySQL integration tests and the UI tests.

## Database, ports, and final state

- App DB: `127.0.0.1:3306/vexgo_promotion`.
- Shadow DB: `127.0.0.1:3306/vexgo_promotion_shadow`.
- Shared MySQL remains on port 3306; existing Feature 10 phpMyAdmin-only container remains on 8090. No second MySQL container or volume was created.
- API/Web/Admin servers were stopped after smoke; their ports 4010/3010/3011 are free. phpMyAdmin/MySQL remain available on 8090/3306.
- No other database or root repository was modified. The supplied ZIP remains untracked and must not be committed. No secrets are included in this report.
- Final `git status`, commit SHA, and port check are recorded by the final agent response after commit.
