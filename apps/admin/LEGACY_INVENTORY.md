# Admin legacy inventory — 24/10/2026

Dashboard follow-up: after user authorization, the platform prototype was replaced with API-only company/administrator governance metrics. The old dashboard stylesheet/fixture were removed after source consumer inventory; shared page/header/panel/skeleton styles remain owned by admin-components.css. PLATFORM_DASHBOARD.md records the new scope and pending runtime verification. Historical inventory rows below describe the original baseline.

## Evidence and limits

- Baseline: `e330259`, after the user reported completing shell/header UI smoke. Individual scenario results were not supplied.
- Read-only static import/re-export traversal from 25 App Router page/layout entrypoints across 195 TS/TSX/CSS files reached 184 files. Counts describe file dependencies, not rendered components or runtime coverage.
- GitNexus query was consulted first; its index is three commits behind baseline and earlier refresh attempts stalled. Direct imports/JSX/reference searches supplement the graph. Missing edges are not proof of unused code.
- File traversal includes unused exports/branches of imported modules. Dynamic references, external consumers and tests require separate checks before deletion.
- No tests/browser checks, TypeScript, ESLint, build or `git diff --check` run. Integration/E2E/UI/component: NOT RUN BY REQUEST.

## Mounted legacy presentation

Follow-up implementation: session-error Retry and TripStatusBadge now use canonical primitives (see UI_MIGRATION.md). The rows below retain the audit baseline; these two replacements await user smoke. Old Button/Badge files remain referenced by disconnected legacy code and are not deleted in this slice.

| Owner | Actual consumer | Follow-up |
| --- | --- | --- |
| `components/ui/button.tsx` | Session error Retry in `features/admin-auth/components/admin-session-guard.tsx` | Replace old Button presentation with canonical action-button; preserve session initialization/retry. |
| `admin-status-badge.tsx` → `ui/badge.tsx` | `TripStatusBadge` exported by trip-detail-sheet, rendered by trip-seats-management | Use canonical badge; preserve all four status labels. Main trip detail already uses ResourceStatusBadge. |
| RestrictedAccount in admin-session-guard | Protected-route restricted/conflict/no-access states | Logout still uses native feature button and inline operation failure. Review canonical button/toast without changing authorization or redirects. Loading/access errors belong in content where appropriate. |
| admin-login-form + admin-auth.css | `/login` | Native fields/actions retain feature styles. Separate presentation slice should preserve password reveal, autofill, labels, submission and validation. Native markup alone is not an accessibility defect. |
| super-admin-dashboard + dashboard.css | Platform `/` | Existing dashboard retains feature cards/buttons/skeleton styles. Audit separately using its existing API. This does not authorize F13 or a tenant operational dashboard. |

The first two rows form the smallest next slice. Session guard is shared by protected routes: assess graph impact before edits, including negative access states.

## Retained legacy branches

Money-input follow-up: AdminMoneyInput now always uses canonical Input and retains its optional resource prop only for caller compatibility. The single formatting/caret engine is unchanged; this follow-up awaits user smoke.

RBAC follow-up: the role selector and permission matrix legacy branches and their exclusive stylesheet have now been removed. Existing shared-presentation test assertions were adapted to canonical ARIA state, retaining behavioral expectations; the tests were not run. Optional resource appearance props remain compatible with feature callers. Earlier notes about retaining RBAC for test consumers describe the prior audit stage.

Follow-up: DateRangeFilter and LabeledSelectFilter legacy appearance branches have been removed; resource presentation is now their only implementation, retaining the optional resource prop for existing callers. The baseline table below describes the original audit. RBAC legacy defaults remain due to direct component-test consumers; shared filter CSS still requires selector-level cleanup.

| Owner | Current source consumers | Removal condition |
| --- | --- | --- |
| data-filters.tsx | Five feature importers use DateRangeFilter/LabeledSelectFilter/types; all six DateRangeFilter JSX calls explicitly select resource appearance. Legacy FilterToolbar/SearchInput/SelectFilter are not imported by feature source. | Check exports/tests, then remove unused controls and date-range branch with exact CSS selectors. Preserve date behavior/wire contract. |
| labeled-select-filter.tsx | Three feature JSX calls, all resource appearance | Check test/re-export consumers before retiring legacy branch. |
| RBAC role selector and permission matrix | Three feature callers each, all resource appearance | Review exported helpers/test expectations before removing legacy defaults and label branches; retain permission semantics. |
| admin-money-input.tsx | Three promotion form calls, all resource appearance | Retire presentation branch only; preserve shared money parsing/formatting. |
| admin-result-summary.tsx | Only source importer is legacy FilterToolbar; also imported by a test | Module reachability does not mean this export is rendered. Remove with toolbar/test dependency. |

Live CRUD FilterToolbar/SearchInput/SelectFilter imports come from resource-filters.tsx. Identical names in the old module must not be mistaken for legacy feature usage. SingleDateFilter already uses canonical Button/Input/Field, without appearance branches.

## Disconnected source candidates — not deleted

Cleanup follow-up: promotion-detail-sheet.tsx and its exclusive promotions.module.css have now been removed after repository source/test reference searches. Shared wrappers listed below remain. The chain description records the audit baseline before this cleanup.

Seven shared files have no source importer:

- components/admin/admin-confirm-dialog.tsx
- components/admin/admin-detail-action.tsx
- components/admin/admin-form-dialog.tsx
- components/admin/admin-generated-code-field.tsx
- components/admin/admin-page-actions.tsx
- components/admin/admin-pagination.tsx
- components/admin/admin-table-skeleton.tsx

An additional disconnected chain is promotion-detail-sheet.tsx → admin-detail-sheet.tsx → admin-dialog-primitive.tsx. The legacy form/confirmation wrappers also import that primitive. The orphan promotion sheet imports promotions.module.css, the only CSS file outside the route dependency closure, and old Button/Badge. Preserve the live promotion management implementation when removing this chain.

Test dependencies remain: admin-crud-shared imports legacy actions/skeleton/result summary; feature-02-ui-regressions imports dialog primitive; admin-crud-pages and bus-company-permissions mock old wrappers. routes-write still asserts `admin-form-dialog`. These are source observations, not executed failures. Do not delete test dependencies blindly or weaken assertions to conceal drift.

## CSS ownership and cleanup boundaries

Cleanup follow-up: retired date/single-date/labeled-select/sort selectors have been removed from data-filters.module.css, including their arms in mixed selector groups. Retained toolbar/search/select selectors still support old exports/test consumers. The remaining RBAC stylesheet and global admin-components.css require separate ownership review.

- Root layout imports admin-components.css, dashboard.css and admin-auth.css. Import reachability does not prove every selector is used.
- data-filters.module.css and RBAC CSS remain imported by mixed modules; review individual branches/selectors before removal.
- admin-components.css contains old action/skeleton/dialog rules alongside live shared styles. Keep the file until selector-level consumers, constructed classes and media rules are checked.
- Retain canonical AdminPageHeader, Resource patterns, generated-code field, money engine, filters, Tooltip and Popover. An Admin prefix or feature stylesheet is not itself a deletion criterion.

## Ordered continuation

1. Migrate mounted session-error Retry and trip-seat status badge to canonical primitives, preserving behavior.
2. Retire unused appearance branches and disconnected components in small slices; account for test dependencies and exact CSS ownership.
3. Review login/restricted-session presentation, then existing platform dashboard presentation separately.
4. Refresh graph when tooling works. Deferred checks require user authorization; this inventory does not establish runtime PASS.
