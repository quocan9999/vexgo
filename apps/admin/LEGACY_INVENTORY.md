# Admin legacy inventory — 24/10/2026

## Bàn giao hiện tại — 25/10/2026

**Cập nhật cuối:** các đoạn chưa chạy kiểm tra bên dưới là lịch sử checkpoint cleanup. Bước chốt đã PASS typecheck/lint/build Admin và API, 116 backend unit tests được chọn và git diff --check. Local UI/component/integration/E2E/browser và HTTP/SQL runtime chưa chạy. Bàn giao hiện hành: [ADMIN_UI_HANDOFF.md](ADMIN_UI_HANDOFF.md).

- Phần triển khai chuyển hệ component Admin đã hoàn tất trong scope các màn được người dùng duyệt: primitives shadcn base-nova/Base UI, Resource patterns, shell/header, forms và dashboard Super Admin dùng dữ liệu API thật.
- Người dùng đã báo smoke 11 form, smoke RBAC và duyệt dashboard Super Admin. Không suy rộng thành PASS mọi viewport, API, DB hoặc toàn bộ regression suite.
- Cleanup cuối xóa 13 file component legacy và stylesheet filter không còn consumer trực tiếp; giữ các layout styles còn được sử dụng. Các test liên quan đã đổi sang contract canonical, chưa chạy.
- Graph trước commit: 153 symbols, 10 processes, risk HIGH; kết quả đầy đủ (không partial/truncated). Index cũ vẫn nối đến implementation trước migration; đối chiếu source/test hiện tại không còn import module đã xóa. Đây là phân tích ảnh hưởng, không phải kiểm chứng runtime.
- Tests, browser automation, TypeScript, ESLint, build và git diff --check: NOT RUN BY REQUEST. Chưa đủ bằng chứng chốt technical verification hoặc không có regression.
- Không cần mở thêm vòng redesign cho các route đã duyệt. Việc tiếp theo là chạy các kiểm tra đã hoãn khi người dùng yêu cầu, sửa lỗi thực tế nếu có, rồi cập nhật kết quả tại đây. Migration date-only DTO/API legacy là hạng mục riêng, không tự thay wire contract trong cleanup UI.
## Latest checkpoint — canonical test contracts

- Migrated shared CRUD tests to real Resource actions/skeleton/pagination; preserved CI gate assertions. Replaced the old toolbar-total assumption with the canonical pagination total/range contract, including first/last/empty page behavior.
- Page composition tests now target canonical Resource exports. Refresh fixtures contain actual loaded rows so they can detect a regression that hides populated results, rather than using empty lists under a populated-test name.
- Feature 02 tests use real Sheets for close, vehicle detail typography and modal focus-boundary wrapping; role-based queries replace legacy markup/CSS assertions. JSDOM guard focus simulates browser Tab traversal and is explicitly not a browser keyboard test. No primitive/focus engine is mocked; geometry is supplied for the DOM environment.
- Route form tests use real dialog controls, preserve generated-code/tenant/edit-context expectations and leave write-service assertions in place. Shipment confirmation asserts canonical alertdialog semantics and excludes any parent modal ancestor.
- Sidebar sizing source-contract test now inspects the actual canonical Button size and its mobile/desktop variants, rather than an obsolete global CSS owner. Its source assertions are not viewport measurements.
- Removed the six remaining test-dependent legacy files (actions, skeleton, summary, dialog focus engine and ui/button), old FilterToolbar and its stylesheet. Pruned 57 additional global legacy CSS rules and four unused animation definitions. Live page/header/panel/native-focus/sr-only/reduced-motion styles remain.
- Direct import/reference review finds no source/test imports of deleted legacy modules. Other historical tests may still require migration; this source cleanup does not establish a passing complete suite. Tests/browser, TypeScript, ESLint, build and git diff --check remain NOT RUN BY REQUEST.

Next completion gate: review the changed test source, then run the deferred checks only when requested. No further route redesign is needed for this cleanup.

## Earlier cleanup checkpoint

### Wrapper and filter retirement

- User approved the platform dashboard after 5565f3d and requested legacy cleanup. This is UI acceptance, not automatic API/DB/test verification.
- Removed seven unconsumed files: admin-generated-code-field, admin-form-dialog, admin-pagination, admin-status-badge, admin-confirm-dialog, admin-detail-sheet and legacy ui/badge. Removed two obsolete mocks of those sheet/confirmation wrappers from bus-company-permissions; no assertions changed.
- Removed unused SearchInput and SelectFilter implementations from data-filters.tsx. Live feature controls continue to import resource-filters.tsx; DateRangeFilter, SingleDateFilter/LabeledSelectFilter re-exports and date/types remain.
- Pruned 30 filter CSS rules and 40 global CSS rules tied to removed owners, preserving selector arms for retained owners. Shared page/header/panel styles, canonical primitives and their tokens are unchanged.
- Retained test-dependent legacy code: admin-dialog-primitive (focus-trap test), admin-detail-action/admin-page-actions/admin-table-skeleton plus ui/button (shared CRUD tests), admin-result-summary and old FilterToolbar/CSS (shared result-summary test). These are test-only dependency chains, not mounted route requirements. Do not delete/relax these tests merely to erase legacy files.
- Known test migration debt: routes-write still asserts the historical admin-form-dialog class; feature-02-ui-regressions still targets legacy focus-trap implementation and historical markup/CSS. No test execution or PASS is claimed. This cleanup does not fix all historical test drift.
- Graph snapshots still describe pre-migration consumers (including HIGH/CRITICAL results for old badge/search/select). Direct repository source/test references were the deletion gate; no graph zero was treated as proof of no impact.

Remaining work: migrate retained test contracts to canonical behaviors, then retire the remaining test-only implementations and review the rest of global legacy resource/dialog CSS. Do not remove live layout styles or claim migration technically verified before the deferred checks are requested and run.

## Historical baseline and earlier follow-ups

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
