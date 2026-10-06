# VexGo Admin Design System

`DESIGN.md` is the source of truth for Admin typography, spacing, shared UI patterns, and responsive behavior. No feature route is a golden reference. Features may have different layouts when their workflows require them, while using the same tokens and shared component contracts.

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

Migrate design changes in this order:

1. Define or adjust primitive tokens and semantic aliases in `src/styles/admin-tokens.css`.
2. Apply them to shared primitives.
3. Apply them to shared components and shared patterns.
4. Migrate feature styles to the shared tokens and component contracts.

Shared shell and component styles belong in `src/styles/admin-components.css` or the owning shared component stylesheet. Feature stylesheets own domain layout and workspace details; they must not become dependencies of shared components.

Undefined custom properties may be mapped only when the existing intended value is identifiable. Current compatibility mappings preserve their prior rendering:

- `--admin-radius-card` maps to existing `--admin-radius-panel` (10px).
- `--admin-surface` maps to the existing app `--background` value.
- `--admin-surface-muted` maps to the existing `#f8fafc` fallback used by the seat workspace.
- The former `--admin-font-size-lg` use is represented by the semantic section-heading role.

Color and radius remain outside the typography and spacing system, except for those confirmed compatibility mappings.

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
- Status labels use the shared badge pattern and map domain state in the feature.
- Forms have associated labels, invalid state, linked error descriptions, and clear submit feedback.
- Dialogs and sheets have an accessible title, contain focus while open, and support the shared Escape/backdrop behavior.
- Icon-only buttons have an accessible name. Loading, success, and error states use appropriate live-region semantics.
- Nonessential animation respects `prefers-reduced-motion`.

## Responsive review

Review affected routes at 1440×900 and 375×667. Check header hierarchy, actions, filters, result count, loading/error/empty/success states, table/card text, detail sheets, dialogs, overflow, and touchable controls. Evaluate each route against this document and the shared component contract; do not compare it to a feature reference page.
