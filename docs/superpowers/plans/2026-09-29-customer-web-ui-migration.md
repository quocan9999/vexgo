# Customer Web UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every user-visible page and interaction from `apps/frontend` into the existing `apps/web` architecture so `apps/web` can run independently and `apps/frontend` can be deleted afterward.

**Architecture:** Keep `apps/web/src/app` as thin App Router entries, place domain UI under `apps/web/src/features`, and consolidate shared layout/primitives under `apps/web/src/components`. Port only used assets and behavior, reuse the existing demo-session boundary, and isolate mock data/utilities so later NestJS API services can replace them without restructuring pages.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8, TypeScript 5, Tailwind CSS 4, Node test runner, GitNexus CLI.

**Spec:** `docs/superpowers/specs/2026-09-29-customer-web-ui-migration-design.md`

## Global Constraints

- `apps/web` remains the only Customer Web and continues to run at `http://localhost:3000`.
- Keep `next` and `eslint-config-next` at `16.3.5`, React/React DOM at `19.2.8`, Tailwind CSS 4, and the current `apps/web` Lucide version; do not downgrade to the source app.
- Do not create `apps/web/src/modules`, a second auth store, a second API client, or any import/symlink/runtime dependency from `apps/web` to `apps/frontend`.
- Preserve every source URL: `/`, `/login`, `/register`, `/about`, `/contact`, `/donate`, `/posts`, `/posts/[id]`, `/post-property/create`, `/my-posts`, `/profile`, `/profile/password`, `/loyalty`, `/tra-cuu-ve`, `/cancel-ticket`, `/invoice/[id]`, `/payment`, and `/send-freight`.
- Preserve existing `apps/web` routes such as `/trips`, `/booking`, `/tickets`, `/shipments`, and `/payments`; reuse shared feature components or explicit redirects instead of duplicated JSX.
- Keep VexGo branding in application metadata; do not copy the source app's BusWay metadata.
- Mock data is temporary UI data only. Backend business rules, API contracts, Prisma, and database code are outside this migration.
- Before editing an existing function/component, run GitNexus upstream impact and report HIGH/CRITICAL or unresolved UNKNOWN risk. Before every commit, run `node .gitnexus/run.cjs detect-changes --scope all --repo .`; partial/truncated output is not a clean result.
- Preserve unrelated user files and current untracked `apps/frontend`; do not delete it in this plan.

## Review Focus

- Direct visits and refreshes on every migrated dynamic/static URL must return the intended screen rather than a 404; Tasks 2–5 extend `customer-ui.e2e-spec.mjs` with route and marker assertions.
- Missing or malformed booking query parameters must fall back to a safe one-way/detail state instead of throwing; Task 4 adds utility and route regression cases.
- Mobile navigation and modal/dialog controls must remain keyboard-operable and expose accessible names; Tasks 2–5 preserve semantic controls and Task 6 performs the browser keyboard pass.
- Demo authentication must drive header/profile/logout consistently without introducing a second store; Task 3 tests pure session transitions plus authenticated/account route output.
- Deleting `apps/frontend` must not break dependency installation or `apps/web`; Task 6 searches all tracked target files and performs a source-withheld verification copy.

---

### Task 1: Migrate typed UI data and round-trip booking logic

**Files:**
- Create: `apps/web/src/features/posts/types/post.ts`
- Create: `apps/web/src/features/posts/data/post-fixtures.ts`
- Create: `apps/web/src/features/account/types/customer-activity.ts`
- Create: `apps/web/src/features/account/data/customer-activity-fixtures.ts`
- Create: `apps/web/src/features/booking/utils/round-trip-booking.ts`
- Create: `apps/web/test/unit/booking/round-trip-booking.spec.mjs`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: source shapes from `apps/frontend/src/modules/client/property/models/property.model.ts`, `property.data.ts`, `my-posts.model.ts`, and `my-posts.mock.ts`.
- Produces: `PropertyDemand`, `CustomerActivity`, fixture arrays, and `buildRoundTripBookingHref(input: RoundTripBookingInput): string` for Tasks 2–5.

- [ ] **Step 1: Add the failing booking URL tests and test script**

Add `"test": "node --test test/unit/**/*.spec.mjs"` and port the two existing expectations: both selected IDs are retained; IDs containing spaces/slashes are encoded. Add cases for empty `currentSearch` and an existing conflicting `outboundId`/`returnId` pair.

- [ ] **Step 2: Run the test to verify RED**

Run: `npm run test -w @vexgo/web`

Expected: FAIL because `apps/web/src/features/booking/utils/round-trip-booking.ts` does not exist.

- [ ] **Step 3: Implement the typed models, fixtures, and URL builder**

Port the source data without imports back to `apps/frontend`. `buildRoundTripBookingHref` must force `tripType=round-trip`, replace stale selected IDs, encode the path ID with `encodeURIComponent`, and serialize query values with `URLSearchParams`.

- [ ] **Step 4: Run unit tests and static checks**

Run: `npm run test -w @vexgo/web && npm run typecheck -w @vexgo/web`

Expected: all booking tests PASS and TypeScript exits 0.

- [ ] **Step 5: Analyze graph changes and commit**

Run: `node .gitnexus/run.cjs detect-changes --scope all --repo .`

Expected: complete, non-partial result with no unexplained HIGH/CRITICAL regression.

Commit:

```bash
git add apps/web/package.json apps/web/src/features/posts apps/web/src/features/account apps/web/src/features/booking apps/web/test/unit
git commit -m "feat(web): add customer UI migration models"
```

### Task 2: Port the visual foundation, customer shell, home, and public content

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/layout/customer-shell.tsx`
- Modify: `apps/web/src/components/layout/customer-header.tsx`
- Modify: `apps/web/src/components/layout/customer-footer.tsx`
- Modify: `apps/web/src/components/layout/support-widget.tsx`
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/action-dropdown.tsx`
- Create: `apps/web/src/components/ui/breadcrumb.tsx`
- Create: `apps/web/src/components/ui/confirm-dialog.tsx`
- Create: `apps/web/src/components/ui/modal.tsx`
- Create: `apps/web/src/components/ui/money-input.tsx`
- Create: `apps/web/src/components/ui/pagination.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/tabs.tsx`
- Create: `apps/web/src/features/home/components/home-page.tsx`
- Create: `apps/web/src/features/home/components/hero-section.tsx`
- Create: `apps/web/src/features/home/components/promotions-section.tsx`
- Create: `apps/web/src/features/home/components/popular-routes-section.tsx`
- Create: `apps/web/src/features/home/components/news-section.tsx`
- Create: `apps/web/src/features/home/components/ecosystem-section.tsx`
- Create: `apps/web/src/features/home/components/category-section.tsx`
- Create: `apps/web/src/features/home/components/latest-demand-section.tsx`
- Create: `apps/web/src/features/home/components/why-us-section.tsx`
- Create: `apps/web/src/features/home/components/cta-section.tsx`
- Create: `apps/web/src/features/content/components/about-page.tsx`
- Create: `apps/web/src/features/content/components/contact-page.tsx`
- Create: `apps/web/src/features/donation/components/donation-page.tsx`
- Modify: `apps/web/src/app/(public)/page.tsx`
- Modify: `apps/web/src/app/(public)/about/page.tsx`
- Modify: `apps/web/src/app/(public)/contact/page.tsx`
- Create: `apps/web/src/app/(public)/donate/page.tsx`
- Create: `apps/web/test/helpers/next-production-server.mjs`
- Create: `apps/web/test/e2e/customer-ui.e2e-spec.mjs`
- Copy used files from: `apps/frontend/public/images/` to `apps/web/public/images/`

**Interfaces:**
- Consumes: fixtures from Task 1 and `DemoSessionProvider` from the existing auth feature.
- Produces: the single `CustomerShell`, accessible shared primitives, and the VexGo-branded public experience used by every later route.

- [ ] **Step 1: Add failing public-route smoke assertions**

The production-server helper starts `next start` on an available test port after a build and waits for readiness. Assert `/`, `/about`, `/contact`, and `/donate` return 200 and contain source-UI markers; assert global metadata contains `VexGo` and not `BusWay`.

- [ ] **Step 2: Build and verify RED**

Run: `npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs`

Expected: FAIL because `/donate` is 404 and source-specific public markers are absent.

- [ ] **Step 3: Run pre-edit impact checks**

Run upstream impact for `RootLayout`, `CustomerShell`, `CustomerHeader`, `CustomerFooter`, `SupportWidget`, `Button`, `Input`, and `Badge`. Stop and report before editing if any risk is HIGH/CRITICAL; confirm UNKNOWN results with `rg`.

- [ ] **Step 4: Port tokens, primitives, layout, assets, and public pages**

Adapt source components to lowercase target filenames and existing `@/` aliases. Keep one header/footer/support implementation, use semantic controls and accessible dialog titles, and copy only images referenced by the migrated UI. Replace BusWay-visible brand strings with VexGo while retaining layout and interaction.

- [ ] **Step 5: Verify public routes and quality checks**

Run: `npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs && npm run lint -w @vexgo/web && npm run typecheck -w @vexgo/web`

Expected: public smoke assertions PASS; lint/typecheck/build exit 0.

- [ ] **Step 6: Analyze graph changes and commit**

Run: `node .gitnexus/run.cjs detect-changes --scope all --repo .`

Commit the listed files and copied images with `git commit -m "feat(web): port customer visual foundation"` only after a complete graph result.

### Task 3: Port authentication, profile, loyalty, and customer activity pages

**Files:**
- Modify: `apps/web/src/features/auth/demo-session.tsx`
- Create: `apps/web/src/features/auth/demo-session-state.ts`
- Modify: `apps/web/src/features/auth/components/login-form.tsx`
- Modify: `apps/web/src/features/auth/components/register-form.tsx`
- Create: `apps/web/src/features/auth/components/auth-page-shell.tsx`
- Create: `apps/web/src/features/account/components/profile-sidebar.tsx`
- Create: `apps/web/src/features/account/components/profile-form.tsx`
- Create: `apps/web/src/features/account/components/password-form.tsx`
- Create: `apps/web/src/features/account/components/customer-activity-page.tsx`
- Create: `apps/web/src/features/account/components/customer-activity-card.tsx`
- Create: `apps/web/src/features/account/components/customer-activity-table.tsx`
- Create: `apps/web/src/features/account/components/customer-activity-detail-dialog.tsx`
- Create: `apps/web/src/features/account/components/customer-activity-edit-dialog.tsx`
- Create: `apps/web/src/features/loyalty/components/loyalty-page.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`
- Create: `apps/web/src/app/(account)/profile/page.tsx`
- Create: `apps/web/src/app/(account)/profile/password/page.tsx`
- Create: `apps/web/src/app/(account)/my-posts/page.tsx`
- Create: `apps/web/src/app/(account)/loyalty/page.tsx`
- Modify: `apps/web/src/app/(auth)/auth/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/auth/register/page.tsx`
- Modify: `apps/web/src/app/(account)/account/profile/page.tsx`
- Modify: `apps/web/src/app/(account)/account/profile/password/page.tsx`
- Modify: `apps/web/src/app/(account)/account/loyalty/page.tsx`
- Modify: `apps/web/src/app/(account)/account/tickets/page.tsx`
- Modify: `apps/web/test/e2e/customer-ui.e2e-spec.mjs`
- Create: `apps/web/test/unit/auth/demo-session.spec.mjs`

**Interfaces:**
- Consumes: `CustomerShell` and primitives from Task 2; activity types/fixtures from Task 1.
- Produces: a single demo-session contract `{ user, signIn, signOut }`, pure `createDemoUser`/session-state transitions, both source-compatible and legacy route entries, and account feature components for later navigation.

- [ ] **Step 1: Add failing auth/account tests**

Assert the pure session state starts with the source demo user Nguyễn Văn Hùng, `signIn` updates customer identity, and `signOut` clears it. Extend E2E assertions for all twelve source and legacy auth/account URLs with screen-specific markers.

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @vexgo/web && npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs`

Expected: FAIL for missing source-compatible routes and missing source layouts while the pure session-state assertions fail until the new state module exists.

- [ ] **Step 3: Run pre-edit impact checks**

Run upstream impact for `DemoSessionProvider`, `useDemoSession`, `LoginForm`, `RegisterForm`, and `AccountSidebar`; resolve UNKNOWN with text search before edits.

- [ ] **Step 4: Implement the unified session and account UI**

Adapt source auth/profile/activity UI to `useDemoSession`; do not add Zustand. Keep session transitions in `demo-session-state.ts` so the provider remains a thin React adapter. Source-compatible routes render shared feature components, while existing `/auth/*` and `/account/*` entries reuse or redirect to the same implementation without JSX duplication.

- [ ] **Step 5: Run tests, lint, typecheck, and build**

Run: `npm run test -w @vexgo/web && npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs && npm run lint -w @vexgo/web && npm run typecheck -w @vexgo/web`

Expected: auth unit tests and auth/account E2E assertions PASS; static checks and build exit 0.

- [ ] **Step 6: Analyze graph changes and commit**

Run complete `detect-changes`, then commit with `git commit -m "feat(web): port customer account experience"`.

### Task 4: Port posts, trip detail, seat selection, and luggage flows

**Files:**
- Create: `apps/web/src/features/posts/components/post-search-form.tsx`
- Create: `apps/web/src/features/posts/components/post-filter-sidebar.tsx`
- Create: `apps/web/src/features/posts/components/post-card.tsx`
- Create: `apps/web/src/features/posts/components/post-list.tsx`
- Create: `apps/web/src/features/posts/components/post-detail.tsx`
- Create: `apps/web/src/features/posts/components/create-post-page.tsx`
- Create: `apps/web/src/features/booking/components/seat-map.tsx`
- Create: `apps/web/src/features/booking/components/one-way-booking.tsx`
- Create: `apps/web/src/features/booking/components/round-trip-booking.tsx`
- Create: `apps/web/src/features/booking/components/quote-dialog.tsx`
- Create: `apps/web/src/features/booking/components/luggage/luggage-form.tsx`
- Create: `apps/web/src/features/booking/components/luggage/luggage-item.tsx`
- Create: `apps/web/src/features/booking/components/luggage/luggage-step.tsx`
- Create: `apps/web/src/features/booking/components/luggage/luggage-summary.tsx`
- Create: `apps/web/src/app/(public)/posts/page.tsx`
- Create: `apps/web/src/app/(public)/posts/[id]/page.tsx`
- Create: `apps/web/src/app/(account)/post-property/create/page.tsx`
- Modify: `apps/web/src/app/(public)/trips/page.tsx`
- Modify: `apps/web/src/app/(public)/trips/[tripId]/page.tsx`
- Modify: `apps/web/test/e2e/customer-ui.e2e-spec.mjs`
- Create: `apps/web/test/e2e/seat-selection.e2e-spec.mjs`

**Interfaces:**
- Consumes: post fixtures/types and URL builder from Task 1; layout/primitives from Task 2.
- Produces: reusable post list/detail and booking components shared by `/posts*` and existing `/trips*` routes.

- [ ] **Step 1: Add failing route and booking regression tests**

Assert `/posts`, `/posts/1`, `/post-property/create`, `/trips`, and `/trips/1` render their expected markers. Port the existing one-way floor-label test and round-trip gray/blue/orange seat-state test. Add malformed/missing query cases that must render safely.

- [ ] **Step 2: Build and verify RED**

Run: `npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs apps/web/test/e2e/seat-selection.e2e-spec.mjs`

Expected: missing source routes return 404 and booking marker assertions fail.

- [ ] **Step 3: Run pre-edit impact checks**

Run upstream impact for existing `TripList`, `TripDetail`, `TripSearchForm`, `TripCard`, and `SeatPicker`; warn on HIGH/CRITICAL and confirm UNKNOWN with `rg`.

- [ ] **Step 4: Implement posts and booking UI**

Adapt source property-named UI into target `posts`/`booking` features, preserve all visible filters, one-way/round-trip selection, seat colors, passenger fields, pickup/drop-off details, price summary, quote dialog, and luggage step. Resolve invalid IDs to a controlled fallback/empty state rather than throwing.

- [ ] **Step 5: Run focused and full web verification**

Run: `npm run test -w @vexgo/web && npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs apps/web/test/e2e/seat-selection.e2e-spec.mjs && npm run lint -w @vexgo/web && npm run typecheck -w @vexgo/web`

Expected: all PASS with no runtime console errors from migrated screens.

- [ ] **Step 6: Analyze graph changes and commit**

Run complete `detect-changes`, then commit with `git commit -m "feat(web): port trip discovery and booking UI"`.

### Task 5: Port tickets, invoice, payment, shipment, and supporting dialogs

**Files:**
- Create: `apps/web/src/features/tickets/components/ticket-search-page.tsx`
- Create: `apps/web/src/features/tickets/components/cancel-ticket-page.tsx`
- Create: `apps/web/src/features/tickets/components/review-dialog.tsx`
- Create: `apps/web/src/features/payments/components/payment-page.tsx`
- Create: `apps/web/src/features/payments/components/invoice-page.tsx`
- Create: `apps/web/src/features/shipments/components/send-freight-page.tsx`
- Create: `apps/web/src/app/(public)/tra-cuu-ve/page.tsx`
- Create: `apps/web/src/app/(public)/cancel-ticket/page.tsx`
- Create: `apps/web/src/app/(public)/invoice/[id]/page.tsx`
- Create: `apps/web/src/app/(public)/payment/page.tsx`
- Create: `apps/web/src/app/(public)/send-freight/page.tsx`
- Modify: `apps/web/src/app/(public)/tickets/lookup/page.tsx`
- Modify: `apps/web/src/app/(public)/tickets/[ticketId]/cancel/page.tsx`
- Modify: `apps/web/src/app/(public)/invoices/[invoiceId]/page.tsx`
- Modify: `apps/web/src/app/(public)/payments/bank-transfer/page.tsx`
- Modify: `apps/web/src/app/(public)/shipments/new/page.tsx`
- Modify: `apps/web/test/e2e/customer-ui.e2e-spec.mjs`

**Interfaces:**
- Consumes: shared layout/primitives from Task 2, session from Task 3, and booking/post fixtures from Tasks 1 and 4.
- Produces: complete source-compatible service screens and shared components for existing English business routes.

- [ ] **Step 1: Add failing service-route tests**

Assert all ten source-compatible and legacy ticket/payment/invoice/shipment URLs return 200 and contain unique initial-state screen markers. Reserve cancel success, payment selection, and freight form interaction checks for the browser pass in Task 6 so the plan does not add a second DOM test stack solely for migrated presentation code.

- [ ] **Step 2: Build and verify RED**

Run: `npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs`

Expected: source-compatible routes are missing and their marker assertions fail.

- [ ] **Step 3: Run pre-edit impact checks**

Run upstream impact for existing `TicketLookupForm`, `TicketCard`, and each existing route component being extracted. Confirm all UNKNOWN results with source search.

- [ ] **Step 4: Implement service screens and shared aliases**

Port source UI into focused feature components. Both Vietnamese source paths and existing English domain paths must use the same component or explicit redirect. Preserve loading/disabled/success/error states and accessible modal/form behavior without introducing backend calls.

- [ ] **Step 5: Run focused and full web verification**

Run: `npm run test -w @vexgo/web && npm run build -w @vexgo/web && node --test apps/web/test/e2e/customer-ui.e2e-spec.mjs && npm run lint -w @vexgo/web && npm run typecheck -w @vexgo/web`

Expected: all service route markers PASS; lint, typecheck, and build exit 0. Browser interactions remain explicitly assigned to Task 6.

- [ ] **Step 6: Analyze graph changes and commit**

Run complete `detect-changes`, then commit with `git commit -m "feat(web): port customer service screens"`.

### Task 6: Remove target-side duplication, prove independence, and complete visual QA

**Files:**
- Modify: `apps/web/package.json` only if a dependency or final verification script is required
- Modify: `package-lock.json` only when `apps/web/package.json` changes
- Modify: `apps/web/test/e2e/customer-ui.e2e-spec.mjs`
- Modify: any migrated file identified by lint/typecheck/build/accessibility/visual QA; no unrelated refactor
- Do not modify or delete: `apps/frontend/**`

**Interfaces:**
- Consumes: every route/component/test produced by Tasks 1–5.
- Produces: a self-contained `@vexgo/web` workspace with no source-app dependency and a verified deletion handoff.

- [ ] **Step 1: Add the failing independence and navigation checks**

Add a repository test that scans `apps/web` source/config/manifest files and rejects `apps/frontend`, `@vexgo/frontend`, or relative traversal into the source app. Extend route smoke coverage to every source URL and important existing URL, including dynamic route samples and navigation href targets.

- [ ] **Step 2: Run tests and resolve any real failures**

Remove dead duplicate components, unused assets/imports, broken links, and unnecessary packages found by the test or static tools. Do not weaken route/independence assertions.

- [ ] **Step 3: Verify version and dependency integrity**

Run: `npm ls next react react-dom eslint-config-next tailwindcss lucide-react --workspace @vexgo/web --depth=0`

Expected: Next/ESLint config `16.3.5`, React/React DOM `19.2.8`, Tailwind 4, one compatible Lucide installation, and no invalid peer dependency.

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm run test -w @vexgo/web
npm run lint -w @vexgo/web
npm run typecheck -w @vexgo/web
npm run build -w @vexgo/web
node --test apps/web/test/e2e/*.e2e-spec.mjs
npm run test
npm run lint
npm run typecheck
npm run build
```

Expected: every command exits 0; report any pre-existing unrelated failure by exact command and output rather than hiding it.

- [ ] **Step 5: Perform visual and accessibility verification**

Run the production build and inspect representative screens at `1440x900` and `375x667`: home, login, posts, one-way detail, round trip, profile, my-posts, payment, cancel ticket, and send freight. Exercise mobile menu, keyboard focus, dialogs, Escape/backdrop behavior, reduced motion, and form feedback; fix only migration regressions.

- [ ] **Step 6: Prove deletion safety without deleting user data**

Copy the repository to a temporary directory excluding `.git`, `node_modules`, `.next`, and `apps/frontend`; install from the existing lockfile when cache/network policy permits, then run the `@vexgo/web` checks there. At minimum, use `rg` plus workspace/lockfile inspection to prove there is no target reference if a clean install is unavailable.

- [ ] **Step 7: Run final graph analysis and commit**

Run `node .gitnexus/run.cjs detect-changes --scope compare --base-ref HEAD~5 --repo .` and re-run if partial/truncated. Commit final cleanup and tests with `git commit -m "test(web): verify frontend-independent migration"`.

- [ ] **Step 8: Deliver the handoff**

Report the exact migrated route inventory, dependency/version result, automated verification output, visual viewport coverage, remaining mocks intended for later API work, and confirmation that `apps/frontend` was not deleted but can be removed after user review.
