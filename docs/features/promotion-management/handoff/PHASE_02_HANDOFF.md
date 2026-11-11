# PHASE 02 HANDOFF — Tenant promotions API & RBAC

- Status: **DONE**; tenant-scoped Admin list/detail/create/status endpoints and RBAC are implemented.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`
- Branch: `feature/tenant-promotions`
- Starting commit: `429f1f0373d9ea23ca65d52681364c44898d124f` (Phase 01)
- Commit SHA: the commit containing this handoff; report the resulting SHA after commit.
- Scope stayed within Phase 02: no Admin UI, Customer Web, booking consumption, payment, or new promotion business migration was implemented.

## Changes

- Added tenant-only `GET /api/v1/promotions`, `GET /:id`, `POST /`, and `PATCH /:id/status` operations. Each operation derives `nhaXeId` from the authenticated tenant principal; unknown or cross-tenant IDs return the same 404.
- Added DTO validation for API English field names, decimal strings, ISO date-only values, percentage cap, optional minimum ticket amount, and positive integer quota. Creation fixes scope/application mode on the server and initializes status to `HOAT_DONG`, following `CONTRACT_FREEZE.md`.
- Kept public `POST /api/v1/promotions/validate` isolated from the Admin controller and return `410 PROMOTION_VALIDATE_DEPRECATED`; the legacy service method used by the booking quote flow was left unchanged.
- Added `promotion:read`, `promotion:create`, and `promotion:update` tenant permissions. They are defaults for `NHA_XE_ADMIN`, not `NHAN_VIEN_KINH_DOANH`; the Admin permission type accepts them only for tenant sessions. Added a forward migration using `INSERT IGNORE` so existing per-tenant overrides are preserved.
- Expanded `verify-seed.mjs` to check the promotion permission defaults and reject assignments to other global roles.
- Added real HTTP/DB integration coverage for authentication, authorization, tenant isolation, duplicate code behavior, validation, status toggles, default role access, and tenant overrides.

## Database and safety evidence

- Deployed the forward-only migration `20261016110000_add_promotion_management_permissions` to the Feature 10 app database only; no existing migration was edited.
- `prisma migrate status --schema=prisma/schema.prisma` — PASS; all 28 migrations are applied to `vexgo_promotion` at `127.0.0.1:3306`.
- `node prisma/verify-seed.mjs` — PASS. Seed remains 15 promotions, 27 bookings, and 45 transactions; promotion counters, usage ledger, booking discount snapshots, and RBAC mappings have no mismatches.
- The shared MySQL container and volume were not recreated. No reset, drop, truncate, or changes to other databases were performed in this phase. No credentials are recorded here.

## Verification

- `npm run test --workspace=@vexgo/api -- test/integration/promotions/promotions-api.spec.ts test/integration/admin-rbac/tenant-role-permissions-db.spec.ts test/integration/admin-rbac/tenant-role-permissions.spec.ts test/unit/auth/permission-catalog.spec.ts test/unit/bookings/bookings.service.spec.ts` — PASS, 5 files / 52 tests.
- `npm run test --workspace=@vexgo/admin -- test/admin-access.spec.tsx` — PASS, 15 tests.
- `npm run typecheck --workspace=@vexgo/api` — PASS.
- `npm run lint --workspace=@vexgo/api` — PASS.
- `npm run typecheck --workspace=@vexgo/admin` — PASS (`next typegen` + `tsc --noEmit`).
- `npm run lint --workspace=@vexgo/admin` — PASS.
- `git diff --check` — PASS before handoff staging.
- The full Admin suite was attempted twice and was not consistently green: one run had two async UI assertions fail while their screens were still loading; a second run had one similar fare-price detail assertion fail. All three affected files passed when rerun individually. These files are outside this phase's diff. The failures are recorded as suite timing flakes; no unrelated tests or UI code were changed.

## Self-review and risk

- GitNexus `detect_changes(scope=all)` reported 117 changed symbols across 16 changed code files, 7 affected flows, `partial=false`, and `truncated=false`; overall risk is HIGH. The existing `CreateBooking → ValidatePromotion` flow is not among the changed flows because the booking-facing legacy method was kept unchanged.
- The shared Admin permission type has a CRITICAL impact surface (23 symbols, 35 processes, 3 modules in the impact report). The change adds only the three required permission literals; focused access tests verify tenant-only behavior, platform rejection, and no unrelated rights. The permission catalog and full project typechecks pass.
- The Phase 02 spec permits an initial paused status, while the frozen API contract requires new promotions to start `HOAT_DONG`; implementation follows the frozen contract. No assumptions change the booking or customer behavior in this phase.

## Next

Proceed to Phase 03 — Admin UI. Read `MASTER_SPEC.md`, this handoff, `apps/admin/AGENTS.md`, `apps/admin/DESIGN.md`, and only `spec/PHASE_03_ADMIN_UI.md`. Keep the UI connected to the real API and preserve the tenant permission checks. Do not push, create a PR, or merge.
