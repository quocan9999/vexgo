# PHASE 01 HANDOFF — Quota, usage ledger, and seed

- Status: **DONE**; schema, migration, seed, verifier, and MySQL integration checks are complete.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`
- Branch: `feature/tenant-promotions`
- Starting commit: `e92fbcb665a5d15e8133ebcb266b9ef519f3a731` (Phase 00)
- New migration: `20261015184828_add_promotion_quota_usage_ledger`
- Scope stayed within Phase 01: no API, RBAC, Admin UI, Customer Web, payment, or booking behavior was implemented.

## Changes

- `KhuyenMai.maKhuyenMai`, `denNgay`, and `soLuotToiDa` are required; `soLuotDaSuDung` defaults to 0.
- Added MySQL enforced checks for a positive quota, a usage counter in `[0, soLuotToiDa]`, and non-negative booking/ledger discount snapshots.
- Added `SuDungKhuyenMai` with one record per booking, unique promotion/phone and promotion/customer keys, restrict foreign keys, and a decimal discount snapshot.
- Added `PhieuDatVe.soTienGiamKhuyenMai DECIMAL(18,2) NOT NULL DEFAULT 0`.
- Updated the 15 promotion fixtures to use `DAT_VE` + `NHAP_MA`, valid dates, supported statuses, and positive quotas. Seed updates preserve `soLuotDaSuDung` when rerun.
- Updated `verify-seed.mjs` for the new status/date/quota rules, ledger/counter consistency, and booking discount snapshots.
- Added `apps/api/test/integration/promotions/promotion-schema.spec.ts` against the real local MySQL app database. Test data is enclosed in rolled-back transactions.

## Database and safety evidence

- Used the existing shared MySQL container `vexgo-mysql-1` at `127.0.0.1:3306`; did not create a MySQL container or volume.
- Created and used only `vexgo_promotion` and `vexgo_promotion_shadow`. The app account has DML privileges on the app database only; the separate migrator account has schema privileges only on those two databases. No credentials are recorded here.
- Before migration, the app database was empty apart from its applied migration history; the shadow database was empty. No reset, truncate, or migration-history rewrite was performed.
- `migrate deploy` applied the 27th migration. A second `migrate deploy` reported no pending migrations. The seed command ran twice and `verify-seed.mjs` passed after both runs.
- A PowerShell escaping issue briefly created two empty schemas named `exgo_promotion` and `exgo_promotion_shadow`. They were confirmed empty and created by that immediately preceding batch, then removed with their grants before the correct target schemas were created. Final metadata checks found only the two required Feature 10 schemas; no other database was changed.

## Verification

- `prisma format --schema=prisma/schema.prisma` — PASS.
- `prisma validate --schema=prisma/schema.prisma` — PASS.
- `prisma generate --schema=prisma/schema.prisma` — PASS (also completed by the seed bootstrap build).
- API Nest build through `prisma db seed` — PASS.
- `vitest run test/integration/promotions/promotion-schema.spec.ts test/unit/promotions/promotions.service.spec.ts` — PASS, 6 tests on MySQL 8.4.
- `node prisma/verify-seed.mjs` — PASS after the initial seed and after the repeat seed; baseline remains 15 promotions, 27 bookings, 45 transactions, 0 promotion usage records, and 0 counter/ledger mismatches.
- `prisma migrate status --schema=prisma/schema.prisma` — PASS, database schema up to date.
- `git diff --check` — PASS.

## Self-review and compatibility notes

- Reviewed the generated migration before deployment. Existing migration files were left unchanged; the new migration adds the quota checks as SQL because Prisma schema declarations do not express these MySQL checks.
- The database generated a non-unique `khachHangId` index required by its foreign key; the integration test checks its presence along with the three unique ledger indexes.
- `soDienThoaiChuanHoa` is nullable. This follows the frozen Phase 00 contract: a signed-in account without a verified phone is identified by `khachHangId`, so storing a shared placeholder phone would create false unique conflicts. This intentionally differs from the Phase 01 line that says the phone is non-null.
- The migration makes legacy promotion code/end-date fields required and adds a required quota without a backfill. This was safe on the new, empty Feature 10 database; applying it to a populated database with legacy nulls requires the documented target-database reset/reseed procedure, not a fabricated quota or date.
- GitNexus impact for `seedPromotions` and the seed/verifier entry points was LOW with exact local callers. The schema file impact returned `UNKNOWN` with zero callers; that is not a low-risk result. SQL, generated DDL, MySQL metadata, and integration tests were reviewed directly.

## Next

Proceed to Phase 02 — tenant promotion API and permissions — from the Phase 01 commit. Re-run impact on the current local index before changing API symbols; keep all mutation and queries scoped to the Feature 10 worktree and database.
