# VexGo Admin Design System

DESIGN.md is the source of truth for Admin typography, spacing, shared UI patterns, and responsive behavior. No feature route serves as a golden reference. Features may have different layouts when their workflows require them, while using the same tokens and shared component contracts.

## Typography

- Font family: Geist Sans through --font-sans, configured in the Admin root layout.
- Use the semantic roles below. Table body text defaults to 14px.
- Line heights are fixed rem values. Use the role's line-height token or an explicit rem value; do not use unitless line-height.
- Use weight primitives 400, 500, 600, and 700. Prefer the role weight token when applying a semantic type role.

| Role | Size | Fixed line height | Weight |
| --- | ---: | ---: | ---: |
| Display | 43px desktop; 32px at ≤900px; 28px at ≤700px | 52px / 40px / 34px | 700 |
| Page title | 28px desktop; 24px at ≤700px | 34px / 30px | 700 |
| Section heading | 20px | 26px | 600 |
| Component title | 16px | 22px | 600 |
| Body | 14px | 22px | 400 |
| Table body | 14px | 22px | 400 |
| Secondary body | 13px | 20px | 400 |
| Form label | 13px | 20px | 600 |
| Helper and error | 12px | 18px | 400 / 500 |
| Table header | 12px | 18px | 600 |
| Button | 14px | 20px | 600 |
| Badge | 12px | 16px | 600 |
| Caption | 12px | 18px | 400 |
| Eyebrow | 10px | 16px | 600 |
| Metric | 28px | 36px | 700 |
| Compact metric | 24px | 32px | 700 |

Semantic typography variables live in src/styles/admin-tokens.css with the --admin-type-<role>-size, -line-height, and -weight pattern. Branding marks and glyphs may retain a deliberate feature-specific size where the value describes a logo or icon rather than interface copy.

## Spacing

The primitive scale is a 4px grid in rem units:

| Token | Value | Token | Value |
| --- | ---: | --- | ---: |
| --admin-space-1 | 4px | --admin-space-9 | 36px |
| --admin-space-2 | 8px | --admin-space-10 | 40px |
| --admin-space-3 | 12px | --admin-space-11 | 44px |
| --admin-space-4 | 16px | --admin-space-12 | 48px |
| --admin-space-5 | 20px | --admin-space-13 | 52px |
| --admin-space-6 | 24px | --admin-space-14 | 56px |
| --admin-space-7 | 28px | --admin-space-15 | 60px |
| --admin-space-8 | 32px | --admin-space-16 | 64px |

Use semantic spacing aliases first: page insets, section and component gaps, toolbar and control gaps, form/field/label gaps, action/card gaps, card/state/notice/control padding, dialog/sheet padding, table cell insets, and sidebar insets. These aliases are defined in admin-tokens.css and include mobile adjustments.

Spacing describes gaps and padding. It does not define dimensions. Keep intentional geometry such as icon sizes, control heights, chart axes and plot geometry, seat-map cells, panel/sheet widths, and other fixed workspace dimensions separate from the spacing scale. Do not change those values just to make every number a spacing token.

## Token and component ownership

Implement design changes in this order:

1. Define or adjust primitive tokens and semantic aliases in src/styles/admin-tokens.css.
2. Apply those aliases to shared UI primitives.
3. Apply shared patterns in src/styles/admin-components.css or the colocated shared component stylesheet.
4. Migrate feature styles to the shared tokens and component contracts.

Do not bulk-replace arbitrary pixel values. Choose a semantic alias from the element's role; use a primitive token when no semantic alias fits. Preserve deliberate geometry and document a local exception when it is needed for a feature workspace.

Undefined custom properties may be mapped only when the existing intended value is identifiable. Current compatibility mappings preserve their prior rendering:

- --admin-radius-card maps to the existing --admin-radius-panel value (10px).
- --admin-surface maps to the existing app --background value.
- --admin-surface-muted maps to the existing #f8fafc fallback used by the seat workspace.
- The former --admin-font-size-lg use is now the semantic section-heading role; no legacy size alias remains.

Color, radius, and control geometry were outside this typography/spacing refresh. Their existing values are retained.

Shared shell and component styles belong in src/styles/admin-components.css or the owning shared component stylesheet. Feature stylesheets own domain layout and workspace details only; they must not become dependencies of shared components.

## Shared Admin patterns

Shared components under src/components/admin/, src/components/ui/, and src/components/data-filters/ own reusable visual and accessibility behavior. Reuse the shared page header/actions, detail action, table skeleton, result summary, status badge, pagination, filter controls, detail sheet, form dialog, and confirmation dialog when the use case matches.

- Domain labels, API calls, validation, and business state remain with the feature.
- Extend a shared component when the same use case needs a missing option.
- A feature may use a dedicated workspace for a distinct workflow such as a seat map, dashboard, or editor; keep its typography and spacing on the shared system.
- No route or feature is a visual authority for the rest of Admin.

## Interaction and accessibility

- CRUD lists use a desktop table with a mobile card fallback where a table no longer reads well.
- Search and filters precede the result count; display the count in one location.
- Pagination communicates range, total, and current page. Navigation controls have accessible names.
- Status labels use the shared badge pattern and map domain state in the feature.
- Forms have associated labels, invalid state, linked error descriptions, and clear submit feedback.
- Dialogs and sheets have an accessible title, contain focus while open, and support the shared Escape/backdrop behavior.
- Icon-only buttons have an accessible name. Loading, success, and error states use appropriate live-region semantics.
- Nonessential animation respects prefers-reduced-motion.

## Responsive review

Review affected routes at 1440×900 and 375×667. Check header hierarchy, actions, filters, result count, loading/error/empty/success states, table/card text, detail sheets, dialogs, overflow, and touchable controls. Evaluate each route against this document and the shared component contract; do not compare it to a feature reference page.
