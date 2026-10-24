# Auth and platform dashboard audit — 24/10/2026

Historical audit: the user later authorized implementation of the platform dashboard. The fixture-backed service described below has since been replaced by the platform-only API and canonical presentation. Current contract/evidence is in PLATFORM_DASHBOARD.md; this document retains the original audit findings.

## Scope and acceptance

- User reported successful smoke of all eleven sheet forms after ed47733 and requested the next migration slice.
- User confirmed the Super Admin dashboard is unfinished and uses fake data. It is excluded from functional completion of this migration. No dashboard implementation or API was added in this slice.
- Evidence is direct source review, supplemented by stale GitNexus queries. No browser/tests, TypeScript, ESLint, build or git diff --check run per user request. No runtime PASS claimed for the new auth slice.

## Findings and implementation

| Finding | Action |
| --- | --- |
| Login fields, password reveal and submit use native feature-specific control styling | Reused canonical Input, Field/FieldLabel and action-button; removed obsolete control rules from admin-auth.css. Kept the branded split layout and responsive composition. |
| Login failure is announced but does not receive keyboard focus | Existing inline error summary now receives focus when a new error is set. Native required validation, server error details and field links remain. Authentication failures stay in the form, not duplicated as toast. |
| Restricted-account logout uses old button and inline operation error | Canonical Button with busy/disabled state; logout error uses the shared bottom-right toast. Access explanation uses the existing centered session-state composition. |
| Platform overview can display fixture totals as if they were a live overview | Recorded as unfinished prototype; service/component/data sources remain unchanged per current scope. Before a later functional dashboard task, define real metrics, permissions, API contract and remove implicit mock fallback. |

## Preserved auth behavior

- Identifier trim, password value, autofill names, length limits, required fields, password reveal label/pressed state, service calls, session initialization, account scope and destination lookup remain.
- Restricted/conflict/no-access decisions and redirects in AdminSessionGuard remain unchanged. No auth service, API, permission or tenant boundary changed.
- Session verification errors retain their existing Retry and technical details. Their previous canonical Button change remains in place.
- Reduced motion for migrated controls is provided by the existing admin-ui rule; removed legacy-specific motion override had no remaining consumer.

## Dashboard data provenance

- `/` renders SuperAdminDashboard behind AdminSessionGuard.
- dashboard-service imports `data/overview.json`. Unless NEXT_PUBLIC_ADMIN_DATA_SOURCE equals api, getDashboardOverview returns that fixture with generatedAt replaced by the current timestamp.
- An optional API path is present for `/api/v1/super-admin/dashboard/overview`. Its presence is not evidence the endpoint exists or that its contract/runtime is verified. Env and runtime were not inspected or modified.
- Refreshing the prototype timestamp does not establish fresh business data. Dashboard presentation and mock fallback remain explicit outstanding work, not an approved full-stack feature or F13 implementation.

## User smoke for this slice

1. Open `/login` on desktop and mobile: labels/inputs/buttons fit; Tab focus is visible; reveal/hide password works without submitting.
2. Try incorrect credentials: inline error appears and receives focus; correct a field and retry; successful login still opens the permitted destination.
3. Confirm autofill and Enter submission work; submit shows pending/disabled state.
4. If a restricted/conflict account is available, inspect the access explanation and direct logout. Logout failure should toast once; do not alter account permissions or env solely to force this state.

Remaining migration cleanup: wrappers and global CSS with legacy/test consumers. Dashboard remains a separate unfinished feature. Auth presentation awaits user smoke.
