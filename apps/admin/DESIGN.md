# VexGo Admin Design System

`DESIGN.md` is the source of truth for Admin typography, spacing, shared UI patterns, and responsive behavior. No feature route is a golden reference. Features may have different layouts when their workflows require them, while using the same tokens and shared component contracts.

## Migration status — 23/10/2026

The target is a unified shadcn/ui system using the existing `base-nova` configuration and Base UI foundation, customized for VexGo. This document defines the target contract; it does not claim existing CSS/components already implement it. The first complete migration slice is `/vehicles`. Review that slice before expanding to other routes.

Light theme is the initial migration scope. Existing `.dark` variables do not establish dark-mode support. Keep Inter, JetBrains Mono for exact identifiers, Lucide icons, blue primary actions and navy navigation. Do not add another primitive engine or replace working domain behavior just to match a library example.

Authority: current user scope and repository security/API rules → this design contract and registry → implementations meeting that contract → feature composition. Existing route screenshots and historical feature instructions are evidence, not design authority.

## Typography

- Font family: Inter through `--font-sans`, configured in the Admin root layout.
- Use JetBrains Mono through `--admin-font-mono` for visible, exact identifiers users copy or compare:
  - resource codes and visible IDs, including employee/customer/account IDs, vehicle type IDs, and citizen ID numbers;
  - ticket/booking/waybill references, vehicle plates, seat codes, and permission keys.
- Keep names, contact details, labels, dates, amounts, and explanatory text in Inter.
- Apply the semantic roles below across Admin. Table body text defaults to 13px.
- Primary line-height ratios are `1.2`, `1.35`, and `1.5`; role-specific ratios in the table keep section, helper, and compact table text aligned with the proposal.
- Use weight primitives 400, 500, 600, and 700. Prefer the role weight token when applying a semantic type role.
- Keep interface copy at 12px or larger. Brand wordmarks, compact identifying marks, and standalone icon glyphs may keep deliberate sizes.

| Role | Size | Line height | Weight |
| --- | ---: | ---: | ---: |
| Display | 32px; 28px at ≤900px; 24px at ≤700px | 1.2 | 700 |
| Page title | 28px; 24px at ≤700px | 1.2 | 700 |
| Section heading | 20px | 1.3 | 600 |
| Component title | 16px | 1.35 | 600 |
| Body | 14px | 1.5 | 400 |
| Secondary body | 13px | 1.45 | 400 |
| Form label | 13px | 1.35 | 600 |
| Helper / error | 12px | 1.4 | 400 / 500 |
| Table header | 12px | 1.35 | 600 |
| Table body | 13px | 1.45 | 400 |
| Button | 14px | 1.2 | 600 |
| Badge / caption | 12px | 1.35 | 600 / 500 |
| Dashboard metric | 24–32px by hierarchy | 1.2 | 600 / 700 |

Semantic typography variables live in `src/styles/admin-tokens.css` with the `--admin-type-<role>-size`, `-line-height`, and `-weight` pattern. The display role supports the login showcase heading. Brand wordmarks and identifying marks may keep a smaller deliberate size.

Letter spacing is reserved for optical heading tightening and uppercase labels. Remove incidental tracking from ordinary body copy and controls; use at most the shared tight heading value and uppercase label value.

## Spacing

Use the 4px spacing scale in rem units:

| Token | Value | Token | Value |
| --- | ---: | --- | ---: |
| `--admin-space-1` | 4px | `--admin-space-6` | 24px |
| `--admin-space-2` | 8px | `--admin-space-7` | 32px |
| `--admin-space-3` | 12px | `--admin-space-8` | 40px |
| `--admin-space-4` | 16px | `--admin-space-9` | 48px |
| `--admin-space-5` | 20px | `--admin-space-10` | 64px |

Semantic aliases map common Admin spacing to the scale:

| Alias | Desktop | Mobile |
| --- | ---: | ---: |
| Page inline | 32px | 16px |
| Page block | 32px | 24px |
| Section gap | 24px | 20px |
| Component gap | 16px | 16px |
| Field gap | 12px | 12px |
| Label–control gap | 8px | 8px |
| Toolbar / control gap | 12px | 8px |
| Page action padding | 8px / 16px | 8px / 16px |
| Card padding | 20px | 16px |
| Dialog padding | 24px | 16px |
| Table cell X / Y | 16px / 12px | Card fallback, 16px padding |

Aliases also cover summary, state, notice, control, sheet, form, and sidebar spacing. Use these aliases instead of adding new per-feature spacing values. Shared page action buttons use 8px vertical and 16px horizontal padding with content-sized width. Page-specific spacing exceptions are reserved for data visualization or a workspace with a distinct layout. The dashboard status chart keeps its responsive donut-to-legend composition gap; seat assignment keeps seat dimensions and grid geometry specific to that workflow.

Tiny local offsets may remain for optical alignment of inline icons and native controls. They do not define reusable layout spacing and should not be reused as gaps or padding.

## Token and component ownership

Within each migration slice, migrate design changes in this order:

1. Define or adjust primitive tokens and semantic aliases in `src/styles/admin-tokens.css`.
2. Apply them to shared primitives.
3. Apply them to shared components and shared patterns.
4. Migrate feature styles to the shared tokens and component contracts.

Then inspect affected consumers before removing legacy selectors, aliases or adapters. Do not change all runtime tokens globally before verifying the pilot. During transition, scope new theme mappings to the migrated container where necessary; portal-rendered popovers/dialogs must receive the same theme scope. Do not declare a migrated route complete while its overlays still use a different theme.

Shared shell and component styles belong in `src/styles/admin-components.css` or the owning shared component stylesheet. Feature stylesheets own domain layout and workspace details; they must not become dependencies of shared components.

Undefined custom properties may be mapped only when the existing intended value is identifiable. Current compatibility mappings preserve their prior rendering:

- `--admin-radius-card` maps to existing `--admin-radius-panel` (10px).
- `--admin-surface` maps to the existing app `--background` value.
- `--admin-surface-muted` maps to the existing `#f8fafc` fallback used by the seat workspace.
- The former `--admin-font-size-lg` use is represented by the semantic section-heading role.

The mappings above describe legacy compatibility. New components follow the semantic theme and geometry contract below; do not copy legacy geometry into a new component by default.

## Shared Admin patterns

Shared components under `src/components/admin/`, `src/components/ui/`, and `src/components/data-filters/` own reusable visual and accessibility behavior. Reuse the shared page header/actions, detail action, table skeleton, result summary, status badge, pagination, filter controls, detail sheet, form dialog, and confirmation dialog when the use case matches.

- Detail sheet action groups align to the end, wrap when needed, and use the shared action gap. Filter searches stop growing at their defined maximum, while select and date triggers keep a stable width as values and result counts change. Toolbars with many controls may use the compact density variant on desktop and wrap on narrower screens.
- Domain labels, API calls, validation, and business state remain with the feature.
- Extend a shared component when the same use case needs a missing option.
- A feature may use a dedicated workspace for a distinct workflow such as a seat map, dashboard, or editor; keep its typography and normal spacing on the shared system.
- No route or feature is a visual authority for the rest of Admin.

## Interaction and accessibility

- CRUD lists use a desktop table with a mobile card fallback where a table no longer reads well.
- Search and filters precede the result count; display the count in one location.
- Pagination communicates range, total, and current page. Navigation controls have accessible names.
- The desktop sidebar can collapse to a centered icon rail; preserve its preference across routes and keep compact navigation labels available to assistive technology. Tablet stays compact, and mobile uses the navigation drawer.
- Keep the sidebar brand and divider fixed above an independently scrollable menu. Use the 24px sidebar navigation offset below the divider; long menus must remain reachable by wheel, touch and keyboard on short viewports.
- Status labels use the shared badge pattern and map domain state in the feature.
- Forms have associated labels, invalid state, linked error descriptions, and clear submit feedback.
- Dialogs and sheets have an accessible title, contain focus while open, and support the shared Escape/backdrop behavior.
- Detail sheet headers show the title and close action. Category eyebrow labels belong to page headers.
- Icon-only buttons have an accessible name. Loading, success, and error states use appropriate live-region semantics.
- Nonessential animation respects `prefers-reduced-motion`.

## Responsive review

Review affected routes at 1440×900 and 375×667. Check header hierarchy, actions, filters, result count, loading/error/empty/success states, table/card text, detail sheets, dialogs, overflow, and touchable controls. Evaluate each route against this document and the shared component contract; do not compare it to a feature reference page.

## Semantic theme target

`src/styles/admin-tokens.css` owns the canonical Admin values; `src/app/globals.css` exposes them through shadcn semantic variables and Tailwind mappings. During implementation, define each value once and reference it through aliases. Do not maintain separate neutral shadcn and blue Admin themes inside the same migrated surface.

The following values are the light-theme target for the pilot, not a claim that runtime has already changed. Foreground/background pairs must be checked in their actual component states; ordinary text needs 4.5:1 contrast and meaningful control/focus boundaries need 3:1 where applicable.

| Role / shadcn semantic name | Target | Existing Admin alias / migration action |
| --- | --- | --- |
| `background` | `#f6f8fb` canvas | `--admin-canvas`; keep app canvas separate from cards |
| `foreground` | `#17243b` | `--admin-ink` |
| `card`, `popover` | `#ffffff` | `--admin-surface` becomes a surface alias, not canvas |
| `card-foreground`, `popover-foreground` | `#1c2e48` | `--admin-text-strong` |
| `primary` / `primary-foreground` | `#1e40af` / `#ffffff` | `--admin-blue`; hover `#18368f` |
| `secondary` / `secondary-foreground` | `#ffffff` / `#1c2e48` | Secondary/outline actions keep a visible border |
| `muted` / `muted-foreground` | `#f1f5f9` / `#5d6d84` | Muted surface and readable secondary copy |
| `accent` / `accent-foreground` | `#eff5ff` / `#1e40af` | `--admin-blue-soft`; hover/selection |
| `border` | `#e4e9f1` | `--admin-border`, separators |
| `input` | `#738096` | Visible interactive boundary; distinct from decorative separators |
| `ring` | `#1e40af` | 2px visible focus indicator with 2px offset where layout allows |
| `destructive` / `destructive-foreground` | `#a63732` / `#ffffff` | `--admin-danger` |
| `sidebar` / `sidebar-foreground` | `#14233d` / `#e2e8f0` | `--admin-navy` |
| `sidebar-accent` / foreground | `#263f64` / `#ffffff` | Active item also has marker/`aria-current` |
| `sidebar-primary` / foreground | `#1e40af` / `#ffffff` | Brand/action accent |
| `sidebar-border` / `sidebar-ring` | `#334155` / `#93c5fd` | Divider and focus on dark surface |
| `chart-1` | `#1e40af` | Revenue series; distinguish series with labels/line styles as needed |
| Success foreground / soft / border | `#166534` / `#f0f8f3` / `#d3eadc` | Explicit success tokens; do not reuse a low-contrast decorative green as small text |
| Warning foreground / soft / border | `#92400e` / `#fffbeb` / `#fde68a` | Explicit warning tokens |
| Danger foreground / soft / border | `#a63732` / `#fef2f2` / `#fecaca` | Error/critical state |
| Neutral foreground / soft / border | `#475569` / `#f1f5f9` / `#cbd5e1` | Neutral state, not every unrecognized domain enum |

Unneeded chart colors are added when a real chart needs multiple series, rather than inventing data or categories. Unknown CSS names such as `--admin-text-default` must be resolved by intended role; do not introduce an alias merely to silence an undefined-variable search.

## Geometry and density target

Keep the typography/spacing roles above. Size variants express context; using the same variant gives the same geometry across Button, Input, Select and date triggers.

| Variant | Control height | Text | Use |
| --- | ---: | ---: | --- |
| `sm` | 32px | 13px | Compact desktop row actions; preserve a usable hit target |
| `default` | 40px | 14px | Forms, page actions and ordinary desktop toolbars |
| `comfortable` | 44px | 14px | Touch-oriented controls and mobile main actions |
| Icon control | Same height and width as its size variant | Icon 16–20px | Accessible name required; no shrinking button to the glyph bounds |

- Control radius: 8px; card/panel and dialog/sheet inner corners: 12px; badge: pill. The existing 10px panel value is legacy until migrated.
- Default control horizontal padding: 12px; page actions: 16px. No arbitrary `min-width: 120px` for all actions; width follows label/content except explicit full-width mobile actions.
- Form labels remain 13px/600 and body text 14px. New chart axis labels are at least 12px; marker visuals and hit regions may have different sizes.
- Touch controls should normally have a 44×44px interactive area. Dense desktop exceptions must remain usable and be reviewed for spacing, focus and mobile adaptation.
- Button variants: default/primary, secondary, outline, ghost, destructive, link. Keep legacy prop names only through a documented adapter. `loading` exposes busy state and feedback; disabled without loading does not use progress cursor.
- Default density is standard. Compact density is for dense desktop data areas, not a global font reduction. Mobile uses comfortable main controls and wrapping/stacking toolbars.
- Surface depth is restrained: border and subtle shadow for cards; clear overlay/backdrop for modal surfaces. Do not add decoration to fill empty header space.

## Shared interaction contracts

| Pattern | Required behavior |
| --- | --- |
| Fields | Persistent label, required state, helper/error linkage, invalid state, compatible autocomplete; preserve values on failed submit |
| Validation | Keep inline errors; after failed submit focus the first invalid field or linked error summary for long forms; do not steal focus on every change |
| Select/filters | Label and selected value are clear; consistent sizes; support keyboard; no feature-specific copies; loading/options errors remain explicit |
| Tabs | IDs and tab–panel linkage, selected state, roving focus, ArrowLeft/Right and Home/End; keep API/data loading in feature |
| Dialog/Sheet/AlertDialog | Accessible title, focus containment/return, Escape/backdrop policy, scroll ownership, pending-dismiss protection; nested popup remains usable |
| Table/cards | Shared headers/sort/state/action styles; `aria-sort`; same labels, status mapping and authorized actions in desktop and mobile views |
| Pagination | One result summary per list context; current page/range/total, accessible previous/next actions; no independent feature visual variants |
| Status | Feature maps real API enum to Vietnamese label/tone. Never assume an unknown enum is a known successful or failed state |
| Feedback | Operation results use the shared Sonner host at bottom-right, once per result; no success banners in page/sheet flow. Keep linked inline field validation and contextual loading/error/empty/permission states. New and migrated screens follow this rule; legacy consumers move per migration ledger |
| Tooltip/chart | Hover/focus/touch access as appropriate; Escape dismiss; tooltip remains within viewport; retain keyboard and tabular alternatives for charts |
| Workspace | One intentional scroll owner per pane; short/mobile viewport and virtual keyboard must not hide essential actions |

Opening a create form is not a reason to change tenant scope, code generation, departure scheduling, settlement or refund rules. Preserve current behavior and fix domain issues only with their actual contract/evidence.

## Date-only contract and migration

User decision confirmed on 23/10/2026: **target date-only UI and DTO/API format is `DD-MM-YYYY`**, for example `23-10-2026`. Existing `YYYY-MM-DD` DTOs predate that decision and are migration work, not the permanent target. Full timestamps continue to use ISO 8601 with `Z` or offset. Month/quarter summaries may use `MM-YYYY` / `Quý N/YYYY` as period labels, not date-only API values.

- Maintain an endpoint-level migration ledger listing request/query/response fields, current format, target format, Admin/Customer consumers, change status and verification evidence before changing a wire contract.
- Move DTO validation, strict calendar parsing/serialization, service adapters, response mapping, API docs and all consumers of that endpoint together. Do not upgrade just the Admin display or just the DTO.
- Until an endpoint is migrated, keep its existing wire format and mark it pending. This is a transition rule, not approval to create new legacy contracts. New date-only contracts use the target format.
- Native `input[type=date]`, database DATE and internal date calculations may retain an internal representation suited to them; convert explicitly at boundaries. A native control's locale-dependent display alone does not guarantee the exact visible target format.
- Parse day/month/year explicitly, reject impossible dates and malformed padding, handle leap years, and compare normalized date values. Never rely on `new Date('DD-MM-YYYY')`, lexical sorting of that string, or guessing between formats.
- Keep the backend business timezone and timestamp semantics unchanged. Do not convert timestamps to date-only merely to match the UI format.
- Date filters use shared SingleDateFilter/DateRangeFilter compositions; their implementation can change during migration while maintaining the endpoint contract in the service layer.

## Component ownership and registry

`components/ui/` owns canonical shadcn primitives. `components/admin/` owns Admin compositions. `components/data-filters/` owns filter compositions. Features own API, permissions, state, validation rules, labels and domain-specific layouts. A wrapper is justified by a shared contract, not by a preference for another component name.

Registry states:

- **legacy**: existing implementation; retained for unmigrated consumers. This is not a claim that all its behavior is wrong.
- **planned**: target contract exists; implementation has not been verified.
- **migrating**: canonical replacement is in progress; list actual migrated consumers and remaining adapters.
- **approved**: implementation meets contract and has evidence for affected consumers, responsive states and keyboard behavior. Record evidence and approval; package installation alone is insufficient.

Initial baseline registry (before the pilot implementation below):

| Pattern | Current owner | Status | Target / pilot consumer |
| --- | --- | --- | --- |
| Button / Badge | `components/ui/button.tsx`, `badge.tsx` | legacy | Canonical shadcn variants; `/vehicles` |
| Input / Field / Label / Textarea / Select | Native markup in features | planned replacement | Canonical primitives + error contract; vehicle form/filter |
| Dialog engine | `admin-dialog-primitive.tsx` | legacy | Dialog/Sheet/AlertDialog primitives; verify close refs, pending state and nested filters |
| Form/detail/confirmation patterns | `AdminFormDialog`, `AdminDetailSheet`, `AdminConfirmDialog` | legacy | Shared compositions over the new engine; vehicle create/edit/detail/status actions |
| Filter toolbar/search/select/date | `components/data-filters/` | legacy | Keep appropriate composition API; implement new theme/size/keyboard contracts |
| Page header/create/refresh/detail actions | `components/admin/` | legacy | Preserve role and labels; use new primitives |
| Table/cards/sort/pagination | Shared CSS and feature markup + `AdminPagination` | legacy | Shared presentation contracts, feature columns/actions |
| Alert/Skeleton/empty/success | Shared skeleton + feature styles | legacy | Canonical state compositions; vehicle states |
| Money/generated code field | `AdminMoneyInput`, `AdminGeneratedCodeField` | legacy | Keep domain behavior, migrate underlying Input/Field/Button when consumed |
| Tabs / Tooltip | Feature implementations | planned replacement | Canonical primitives; customer/booking tabs and shared help |
| Shell/sidebar | `SuperAdminLayout` + `features/super-admin-layout/admin-shell.css` | migrating | Canonical Button, Sheet mobile navigation and ResourceConfirmation; preserve permission/tenant/navigation preference behavior; evidence in UI_MIGRATION.md |
| Chat / chart / seat map / RBAC matrix | Feature workspaces | legacy | Keep domain layout; migrate primitives in their phase |

For each pattern entering `migrating`, add canonical path, migrated and remaining consumer paths, adapter (if any), evidence and removal condition to this registry or its linked ledger. Adapter removal requires zero remaining consumers and verified replacement behavior. Do not maintain two styling or focus engines for the same migrated component.

### Vehicles pilot — user approved

Current migration ledger: [UI_MIGRATION.md](./UI_MIGRATION.md). `/vehicles` and `VehicleFormDialog` use canonical shadcn primitives and shared Resource patterns. The user approved the pilot presentation and bottom-right toast on 23/10/2026; remaining runtime verification limits are recorded in the ledger. This approval does not approve every Admin route. Existing `ui/button.tsx`, `ui/badge.tsx`, Admin dialog/filter/pagination patterns remain legacy for their other consumers; do not copy them into new features. New consumers use the canonical paths in the ledger. No endpoint date-only contract is switched by the vehicles pilot; its API timestamps remain ISO and the visible date portion uses `DD-MM-YYYY`.

### Shell geometry and navigation

- Desktop sidebar width 252px, collapsed/tablet rail 76px; tablet rail applies from 701–1180px. Mobile ≤700px uses a left Sheet up to 320px wide, leaving at least 32px of backdrop.
- Sidebar padding 24px top / 16px inline; 24px between brand and divider, then 16px before the scroll region. Navigation rows have a minimum 44px height, 8px control radius and 4px row gap. Navigation owns vertical scrolling; the brand remains visible.
- Header inner minimum height 68px desktop / 64px mobile, plus the 1px border; its centered 1510px maximum container and page-inline padding align with page content. Header styling is isolated in `features/super-admin-layout/components/admin-header.module.css`. Show authenticated scope, current section and account identity; truncate long text. Do not add a tenant switcher to tenant scope.
- Mobile Sheet uses the canonical focus/scroll-lock engine, closes on link selection, Escape/backdrop, and returns focus to the menu trigger. Returning to desktop closes the mobile overlay. Desktop collapse preference keeps its existing storage behavior.
- Logout executes immediately without confirmation (user decision). Disable the action while pending, guard repeated requests and use bottom-right error toast. No feature content or API authorization rules are changed by the shell migration.

## Rollout and completion gates

1. Documentation/contract foundation: this step; no runtime tokens or DTOs are changed by documentation alone.
2. Build only primitives required by `/vehicles`; migrate list/filter/mobile cards/create/edit/detail/confirmation and every relevant state as one slice.
3. Review the pilot with the user before expanding. Record concrete viewport/keyboard/state evidence and any pending checks; typecheck/build alone do not establish UI readiness.
4. Migrate shell and equivalent CRUD groups; then customer/booking/trip/shipment/promotion/RBAC workflows; then specialized chat/report workspaces. Keep dashboard data-source work separate; do not fabricate runtime data or add F13.
5. Remove legacy only after consumer inventory and review. Update this registry with actual status, not intended progress.

Within each implementation slice: inspect consumers/impact before edits, implement, run permitted scoped checks, review responsive and keyboard behavior, self-review, then report evidence and remaining limits. Test types follow current user authorization; this document does not authorize integration/E2E/UI test suites by itself. Do not claim unobserved role/runtime states passed. Date contract migration is separately tracked across both clients before any affected endpoint is switched.
