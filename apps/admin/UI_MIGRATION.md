# Admin UI migration ledger

## Feedback decision — 23/10/2026

- User approved the pilot direction with operation notifications changed to bottom-right toast. Shared host: `src/components/ui/sonner.tsx`, mounted once in the root layout; features call `toast` from `sonner`.
- `/vehicles` create/edit/status success now emits once from the parent callback; removed page and detail success banners. Request failures for save/status use error toast; linked field errors and contextual load/permission states stay inline.
- Toast duration 5 seconds, close button, mobile inset 16px, desktop inset 24px. Legacy routes adopt the rule as they migrate; they are not all converted by this change.
- Follow-up checks: TypeScript, scoped ESLint, production build and `git diff --check` PASS. No test suites run. The new toast has not yet been visually checked at both required viewports or verified through a real mutation; these checks remain pending. Earlier pilot browser checks below predate this feedback change.

## Vehicles pilot — 23/10/2026

Status: **MIGRATING — pending user visual review**. This is a complete presentation slice for `/vehicles`, not a claim that all Admin routes or mutation flows have been verified.

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
