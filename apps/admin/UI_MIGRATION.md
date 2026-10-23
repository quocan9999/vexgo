# Admin UI migration ledger

## Admin shell — 23/10/2026

Status: **MIGRATING — implementation and representative browser review; pending user review**.

- Owner: `features/super-admin-layout/components/super-admin-layout.tsx` and `features/super-admin-layout/admin-shell.css`; removed shell-only legacy rules from `styles/admin-components.css`.
- All existing SuperAdminLayout consumers receive the shell presentation. Navigation permission predicates, tenant/platform scope, link destinations, authentication and collapse preference storage are preserved. Desktop and mobile render the same permission-filtered navigation composition.
- Canonical Button for shell actions; canonical Sheet for mobile navigation (focus containment, Escape/backdrop, return focus, body scroll lock). Desktop fixed sidebar and mobile Sheet share one navigation composition. Desktop breakpoint closes any mobile overlay.
- Header shows authenticated scope, section and account; logout executes immediately without confirmation, with pending state, duplicate-request guard and bottom-right error toast. Added skip link. No backend, API, env, database, seed or feature DTO changes.
- Geometry: 252px desktop / 76px rail, mobile Sheet 320px maximum; header 76px desktop / 64px mobile; scroll region 16px below divider, 44px navigation rows. Content grid children can shrink so wide tables scroll within their own container.
- Pre-edit GitNexus impact: CRITICAL, 22 direct consumers / 49 impacted symbols / 42 flows. The index remains stale and contains incomplete file paths; source inspection corroborated shell consumers. Graph results are not runtime verification.
- Browser review using the existing tenant session: desktop 1440×900, mobile 375×667; /vehicles and /vehicle-types load, /revenue-reports navigation updates header and closes mobile menu. Sidebar collapse persists after reload. Mobile Sheet Tab wraps inside, Escape returns focus to Mở menu; the earlier logout confirmation was reviewed before the user requested its removal. Resizing an open mobile menu to desktop closes it. No logout or domain mutation was executed.
- Remaining checks: platform Super Admin / restricted staff sessions, actual logout success/failure and pending behavior are not runtime verified. No integration/E2E/UI/component test suites run by request. Final scoped checks and screenshot evidence recorded at handoff.

Final checks: Admin TypeScript, scoped ESLint, production build and `git diff --check` PASS. Browser tablet 1024×768: sidebar/main offset 76px, document width 1009px within the 1024px viewport; wide vehicle table scrolls inside its container. Mobile navigation End key reaches the final permission item (scrollTop approximately 126px). Temporary viewport override reset after review.

GitNexus detect_changes returned zero mapped symbols for four tracked changed files before the final documentation update; the stale index and untracked shell stylesheet prevent treating that as proof of no impact. Pre-edit CRITICAL impact and inspected consumers remain the relevant scope evidence.

Evidence folder: `C:/Users/trinh/.codex/visualizations/admin-shadcn-shell/` (desktop.jpg, tablet.jpg, mobile.jpg, mobile-navigation.jpg). The final build is running at Admin 3005. Changes remain uncommitted for user review.

## Feedback decision — 23/10/2026

- User approved the pilot direction with operation notifications changed to bottom-right toast. Shared host: `src/components/ui/sonner.tsx`, mounted once in the root layout; features call `toast` from `sonner`.
- `/vehicles` create/edit/status success now emits once from the parent callback; removed page and detail success banners. Request failures for save/status use error toast; linked field errors and contextual load/permission states stay inline.
- Toast duration 5 seconds, close button, mobile inset 16px, desktop inset 24px. Legacy routes adopt the rule as they migrate; they are not all converted by this change.
- Follow-up checks: TypeScript, scoped ESLint, production build and `git diff --check` PASS. No test suites run. The new toast has not yet been visually checked at both required viewports or verified through a real mutation; these checks remain pending. Earlier pilot browser checks below predate this feedback change.

## Vehicles pilot — 23/10/2026

Status: **USER APPROVED — presentation and bottom-right toast**. This is a complete presentation slice for `/vehicles`, not a claim that all Admin routes or mutation flows have been verified.

### Canonical components and consumers

| Pattern | Canonical path under `src/` | Migrated consumers | Remaining legacy |
| --- | --- | --- | --- |
| Button | `components/ui/action-button.tsx` | Resource actions, pagination, form, detail and confirmation in vehicles | `components/ui/button.tsx` and its other consumers |
| Badge | `components/ui/status-badge.tsx` | `ResourceStatusBadge` in vehicle list/cards/detail | `ui/badge.tsx`, `AdminStatusBadge` and other consumers |
| Input / Field / Label | `components/ui/input.tsx`, `field.tsx`, `label.tsx` | Vehicle create/edit and resource search | Feature-native fields elsewhere |
| Select | `components/ui/select.tsx` | Vehicle filters, mobile sort and create/edit | Existing data filters and native selects elsewhere |
| Sheet / confirmation | `components/ui/sheet.tsx`, `alert-dialog.tsx`; compositions in `components/admin/resource-ui.tsx` | Vehicle create/edit/detail/status confirmation, including nested edit/confirm | Native `AdminDialogPrimitive` and wrappers in other workflows |
| Table / Card | `components/ui/table.tsx`, `card.tsx` | Vehicle desktop table and mobile cards | Feature tables/cards and `admin-resource-*` CSS elsewhere |
| Alert / Skeleton / list state | `components/ui/alert.tsx`, `skeleton.tsx`; Resource compositions | Vehicle loading/error/empty/success states | Existing shared/feature states elsewhere |
| Filters | `components/data-filters/resource-filters.tsx` | Vehicle toolbar and mobile sorting | `data-filters.tsx` / labeled/date filter compositions elsewhere |
| Pagination | `ResourcePagination` in `components/admin/resource-ui.tsx` | Vehicles | Existing `AdminPagination` consumers elsewhere |
| Header | Existing `AdminPageHeader` contract with Resource action buttons | Vehicles | Header geometry retained; shell migration is later |

There is one new canonical implementation per primitive. Legacy files are retained for unmigrated consumers, not newly approved alternatives. `action-button.tsx` and `status-badge.tsx` avoid changing all legacy imports in this pilot. Once those consumers are migrated, consolidate paths/re-exports and remove obsolete implementations in a separate reviewed change. No new adapter with its own styling/focus engine is introduced.

Registry sources and the MIT notice are recorded in `src/components/ui/SHADCN_NOTICE.md`. Existing dependencies suffice; no package/version/lockfile changes are required.

### Scope and preservation

- `VehicleFormDialog`, list/table/mobile cards, detail, nested edit and status confirmation use the new components.
- Tenant identity, permission checks, service methods, payloads, queries, API routes, validators and database schema remain unchanged.
- Displayed timestamps keep their timestamp meaning; their visible date portion uses `DD-MM-YYYY`. There are no date-only vehicle DTO fields to switch in this slice. Other date-only endpoint migrations remain pending and need an endpoint/consumer ledger before changes.
- `.admin-ui` theme applies only to the migrated page and its portal-rendered surfaces. Legacy shell/feature styling stays available.
- Native button/input reset selectors now exclude `data-slot` components, so they cannot override primitive styling. Other native controls keep the existing reset.
- Removed obsolete vehicle list/form/detail styles from `vehicles.css`. Seat workspace rules, shared success notice used by that workspace and its spinner remain. New domain layout is in `vehicles-management.module.css`; shared pattern styling belongs to `admin-ui.css` and the primitives.
- No runtime mock data, API bypass, auth override, permission widening, env change, database migration or seed is introduced.

### Review and verification

Implementation checks and browser evidence are updated at handoff. Browser checks use the current tenant session; no vehicle was created, edited or moved to maintenance by the agent. Empty form submit was stopped by client validation. Mutation success/server rejection/pending dismissal and alternative role states still need user smoke checks.

Checks recorded in this implementation session:

- Admin TypeScript (`tsc --noEmit`): PASS.
- Scoped ESLint for the changed/new TSX components: PASS.
- Admin production build after the final geometry adjustments: PASS.
- `git diff --check`: PASS.
- Browser: real vehicle list loaded; maintenance filter returned `30F-128.50`; no-match search showed empty state and reset restored the list. Empty create form showed linked errors and focused `create-vehicle-license-plate`. Select worked inside sheet; Escape returned focus to the create trigger; Tab from close wrapped to the first field. Nested edit cancel returned focus to Edit; status confirmation initially focused Cancel and was canceled without mutation.
- Responsive observations: desktop CSS 1440×900, mobile CSS 375×668 (browser zoom rounds the requested height). On mobile the two main selects share a row, sorting shares a row with its direction button, first card begins around y=522, and the document does not overflow horizontally. A device with a real soft keyboard is still pending.
- Legacy read-only observation: `/vehicle-types` continued to load its original list. Source comparison retained all 56 seat-workspace/spinner/success-notice CSS rules unchanged. This does not claim a complete seat-workspace runtime regression.
- Graph pre-edit checks warned HIGH for vehicle form/display flows and CRITICAL for legacy pagination. Legacy pagination was not edited. Final graph change analysis returned no mapped symbols from its stale index; this is not evidence of no impact. Direct source/consumer review and scoped checks provide the implementation evidence above.

Local screenshots: `C:/Users/trinh/.codex/visualizations/admin-shadcn-vehicles/` (`desktop.jpg`, `mobile.jpg`, `form-mobile.jpg`, `confirmation.jpg`). Screenshots are review artifacts, not runtime fixtures or a complete regression suite.

Test suites: **unit/integration/E2E/UI component suites not run** for this presentation-only slice. Existing test assertions were not loosened or skipped. Browser interaction review is separate from those suites.

### User smoke checklist

1. Open `/vehicles` on Admin 3005 with API 4002. Check header, toolbar, rows/cards, sorting, filters, pagination and no horizontal page overflow.
2. Create a disposable vehicle with a valid tenant vehicle type; confirm success and list refresh. Try a duplicate plate and verify linked field error/focus.
3. Open detail → edit; save valid changes and confirm the detail/list refresh. Cancel/close/Escape should return focus correctly.
4. Open status confirmation; cancel first. On a disposable record, confirm maintenance/active and check success, request failure and no double submit.
5. During an actual pending save, close button/Escape/backdrop must not dismiss the form/confirmation.
6. At mobile width, inspect card content, filter wrapping, select options, sheet scroll and footer access; check on a real soft keyboard where available.
7. Check a read-only account cannot see create/update actions. API permission/tenant enforcement remains a backend responsibility.
8. Visit an unmigrated CRUD screen and the vehicle seat workspace to inspect legacy presentation after moving between routes.

Next: user reviews the pilot, then migrate shell/equivalent CRUD groups. Do not roll this presentation out to all routes merely because build passes.

## Header revision — 23/10/2026

- User requested a header redesign and removal of logout confirmation. Desktop now uses a workspace icon and horizontal scope/section breadcrumb; account identity has a navy avatar and a labeled outline logout action. Mobile retains two-line context and 44px icon action. No decorative search/notification controls were added.
- Logout calls the existing signOutAdmin directly; a ref prevents duplicate requests, pending state disables the button, and failure restores the action and shows the shared bottom-right toast. No auth API contract changed.
- Browser visual review: desktop and mobile; mobile actual CSS viewport 375×668 due browser zoom rounding, no horizontal overflow. Actual logout has not been executed against the shared user session. No test suites run. Production rebuild for this revision has not been run while the user's Next dev server is active.

## Header layout correction — 23/10/2026

- User screenshot showed the desktop breadcrumb stacked vertically and an unnecessarily tall header. Rebuilt header presentation in `components/admin-header.module.css` to isolate it from global shell/feature selectors. Removed superseded global header rules from `admin-shell.css`.
- Desktop: compact tenant badge, horizontal navigation breadcrumb, account identity and a separated ghost logout action. Header and page share the centered 1510px content width and inline padding. Mobile keeps two-line context with 44px menu/logout targets. Direct logout remains unchanged.
- Browser: desktop 1440×900 and wide 1920×900; header height 69px, breadcrumb flex direction row, and wide header scope/page title both start at x=363px. Mobile CSS viewport 375×668 (zoom rounding), header 65px, document width 356px with no horizontal overflow. Screenshots in `C:/Users/trinh/.codex/visualizations/admin-header-redesign/`: desktop-v2.png, wide-v2.png, mobile-v2.png.
- No domain mutation or real logout executed; production rebuild not run while the user's dev server is active. Earlier production build evidence predates the header revisions. No integration/E2E/UI/component test suites run.
