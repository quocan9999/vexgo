# Super Admin dashboard contract — 24/10/2026

## Purpose

Platform governance: company coverage, operator administration and onboarding. This is not a tenant revenue/dispatch dashboard. No ticket/shipment/revenue rankings, invented growth percentages, payment commissions or unmeasured system-health claims.

## API

- GET `/api/v1/super-admin/dashboard/overview`, no body/query. Success `{ data: DashboardOverview }`; existing global error envelope.
- Existing access-token and authorization guards enforce pure SUPER_ADMIN principal scope plus BOTH `bus-company:read` and `admin-account:read`. Tenant accounts, mixed/conflicting principals and customers cannot read platform aggregates. UI checks are convenience only.
- Read-only aggregates from existing NhaXe, NhanVien, TaiKhoan and role relations; no schema/migration, new writer or seed change. Read transaction with RepeatableRead provides one consistent snapshot across counts/lists/chart.
- generatedAt is the server snapshot time, timeZone is configured BUSINESS_TIME_ZONE (existing fallback Asia/Ho_Chi_Minh). Monthly labels/boundaries are decided by backend; timestamps ISO with offset/Z. Period labels are MM-YYYY, not date-only request fields.

## Metric definitions

- companies.total: all company records; active: HOAT_DONG; suspended: TAM_NGUNG; other: remaining statuses.
- administrators.total: unique employee accounts with NHA_XE_ADMIN and only roles from existing TENANT_PRINCIPAL_ROLES. One employee per account is guaranteed by schema.
- administrators.active: that population with account HOAT_DONG and employee DANG_LAM_VIEC. This measures account/employment eligibility, not online sessions or company activity.
- companies.needingAdministrator: active companies with no administrator meeting the active definition above. Includes companies with missing, locked, nonworking or scope-conflicting administrator accounts.
- onboarding: six business calendar months including current month; counts company createdAt in each half-open month, capped at generatedAt. Current month is explicitly partial. Zero months remain visible.
- attentionCompanies: first five companies from needingAdministrator population, oldest createdAt first then id. Count is full population, not list length.
- recentCompanies: newest five by createdAt then id; activeAdministratorCount uses the same eligibility filter. Unknown statuses are shown explicitly, not silently called active/suspended.
- No account PII or customer account totals are returned. Links lead to existing platform management pages; no unsupported record deep link or fictional workflow is added.

## UI

One divided summary surface with three metric groups: companies (active/suspended breakdown inline), administrator accounts, and companies needing administrators. Recent company table/mobile cards and a six-month chart share the main content row. Exact chart counts remain visible, current month is highlighted and full month/year remains in accessible labels. Follow-up detail appears only when the need count is positive; at zero, only a concise confirmation remains in the summary. Repeated bottom navigation and redundant explanatory copy were removed. Snapshot time is compact beside Refresh, with full date/timezone available in the time element. Existing canonical Card/Button/Badge/Table/Resource states, Inter and blue/navy identity. No new chart library or API semantics.

Loading never displays fake zero totals. Empty records show true zero/empty state. Failed initial load shows an error/retry; failed refresh retains and explicitly labels the older snapshot. API-only source; mock env switch/fixture fallback removed.

## Verification status

Implementation/source review only. Tests, browser, TypeScript, ESLint, build and git diff --check are skipped per standing user request. No API/DB/browser runtime PASS is claimed. User smoke required with Super Admin and relevant permissions, empty data, refresh/error, long names, mobile and short viewport. Automatic security/timezone regression verification remains outstanding.
