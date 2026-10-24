# Admin UI migration ledger

## Vehicle seat workspace — 24/10/2026

Status: **MIGRATING — user approved the presentation on 24/10/2026; responsive and keyboard review pending**.

- `/vehicles/[id]/seats` now uses canonical Button, Badge, Card, Field/Input, Tabs, Skeleton, Sheet, confirmation, Resource state and bottom-right toast patterns. Vehicle identity, type and actual seat/group totals are organized into a responsive summary; list and stored-position views remain available.
- The vehicle seat API exposes only seat number and nullable position, not row/column coordinates. The UI groups by the stored position string and clearly says it is not a physical seat map; no coordinates or seat positions are fabricated.
- Existing get/create/update/delete services, permission predicates, duplicate-number handling, validation limits and request behavior are preserved. Success and general save-error notices use the shared toast; duplicate-number validation stays linked to its field and delete errors stay in the confirmation. Native dialogs and `features/vehicles/vehicles.css` were removed after confirming the seat route was their only consumer; no feature-specific CRUD primitive was added.
- GitNexus pre-edit impact was exact LOW for VehicleSeatsManagement, VehicleSeatFormDialog and SeatActions; direct route consumer is `app/vehicles/[vehicleId]/seats/page.tsx`. No shared symbols were edited.
- Admin on `localhost:3005` was stopped when the browser check was attempted (`ERR_CONNECTION_REFUSED`); it was not restarted. Desktop/mobile visual and keyboard review are pending until the user runs the app again. No domain mutations were performed.
- TypeScript, ESLint, build and `git diff --check` were skipped per user request. No tests were added or run; integration/E2E/UI/component tests NOT RUN BY REQUEST. No backend, API, DB, env, schema or seed changes. The user approved the presentation on 24/10/2026; responsive and keyboard review remain pending because Admin was stopped.

## Trip seat workspace — 24/10/2026

Status: **MIGRATING — user approved the presentation on 24/10/2026; responsive and keyboard review pending**.

- The /trips/[tripId]/seats page now composes the shared Admin page header, Button, Badge, Card, Skeleton and ResourceState. It presents trip context, four seat-count metrics, backend status filters and the read-only grouped inventory in a responsive layout.
- Existing getTripById/getTripSeats calls, trip:read permission, status query, response counts, retry behavior and seat status mapping are preserved. No trip or seat mutation action was added.
- Grouping uses only the stored seat position. Copy identifies this as a grouped list, not a physical layout; no row or column coordinates are inferred. Date-only display uses DD-MM-YYYY while the API contract remains unchanged.
- Removed the seat-workspace CSS rules and import. Retained the shared trip-seat summary styles because trip-detail-sheet.tsx still consumes them.
- GitNexus impact was exact LOW for TripSeatsManagement and TripSeatStatusBadge; callers are the trip seat page and its existing unit test. The Admin server remains stopped and was not restarted, so desktop/mobile visual and keyboard review are pending.
- TypeScript, ESLint, build and git diff --check were skipped per user request. No tests were added or run; integration/E2E/UI/component tests NOT RUN BY REQUEST. No backend, API, DB, env, schema or seed changes. The user approved the presentation on 24/10/2026; responsive and keyboard review remain pending because Admin was stopped. Changes remain uncommitted.

## Bus companies — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026; runtime checks remain unverified**.

- `/bus-companies` now uses shared Resource actions, states, skeleton, pagination, filters, Table/Card, detail Sheet and status AlertDialog. Desktop keeps sortable table columns; mobile has responsive cards and explicit sort controls. Successful create/edit/status changes use the shared bottom-right toast.
- Create/edit forms now use shared ResourceSheet plus Field, Input and Select primitives with their current inline validation contract. Pending submissions prevent dismissal; the details workspace and edit/create sheets retain their nested interaction.
- The create form displays `HOAT_DONG` as “Đang hoạt động” and `TAM_NGUNG` as “Tạm ngưng”; enum values sent to the API are unchanged.
- Existing hook/service, search/status/date filters, server-side sorting and pagination, Super Admin platform scope, permission checks, create/edit/status requests, pending guards and confirmation/error behavior are preserved. No backend, API, environment, database or schema changes.
- Removed `bus-companies.css` after removing its route-specific styles. Its `.table-error` rule was moved unchanged to `styles/admin-components.css` because the still-legacy `/admin-accounts` error state also consumes that global class.
- GitNexus impact for `BusCompaniesManagement` was exact LOW; direct callers are `/bus-companies` and the existing admin CRUD/permission tests. The user approved the route after reviewing the status-label correction. Runtime smoke and responsive/keyboard review remain unverified.
- No automated tests or validation checks were run per the standing user request; only manual source/diff review was done. TypeScript, ESLint, build and `git diff --check` were skipped; integration/E2E/UI/component tests NOT RUN BY REQUEST. No runtime behavior is claimed as verified. Changes remain uncommitted.

## Tenant RBAC — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /tenant-rbac uses canonical Card/Badge/Resource notices/states/refresh/confirmation and bottom-right operation toast. Preserved default/override/effective distinction, per-role drafts, empty override warning, self-lockout warnings, trusted-session reload and backend services/payload/permissions. Added synchronous pending guards for save/reset and disabled role selection while saving. No backend/env/DB/schema changes.
- Shared AdminRbacRoleSelector and AdminRbacPermissionMatrix accept appearance=resource; tenant-rbac, platform-rbac and platform tenant detail now opt in. Resource selector uses desktop RadioGroup cards, mobile LabeledSelectFilter; same onSelect callback. Resource matrix uses canonical Checkbox and group cards; labels translated for actual tenant resources/cancel/manage only in resource mode. Exact permission keys/scope/protection guards unchanged.
- Added ui/checkbox and ui/radio-group from official shadcn base-nova registry, with VexGo focus treatment; attribution updated. Context7 Base UI docs consulted for controlled callbacks/label wrapping. Shared components remain owner of presentation; no copied feature checkbox/radio engines. Legacy branches/CSS can be removed after both platform consumers migrate. Removed unreferenced tenant-rbac-management.module.css; shared legacy presentation CSS retained.
- Graph: TenantRbacManagement and save/reset/session-sync LOW; shared role selector/matrix and label/group helpers CRITICAL (six/seven impacted), warnings reported before edits. Index four commits behind; source inventory confirms three consumers and opt-in boundary. PermissionKeyList LOW. Browser caught a missing appearance argument in the label helper; fixed and reloaded successfully.
- Browser: six actual tenant roles and API permission configuration loaded. Changed vehicle-type:update in local draft, opened confirmation, observed own-role warning and Cancel focus, canceled and undid draft; Undo then disabled. No save/reset request submitted. Mobile role dropdown selected employee dispatcher; desktop ArrowRight from admin selected dispatcher and corresponding heading. Returned to admin. Desktop CSS 1440x900 and mobile 375x667/668 reviewed. Bounded permission-key lists remain keyboard-focusable; long keys wrap. Evidence C:/Users/trinh/.codex/visualizations/admin-shadcn-tenant-rbac/ (desktop.png, mobile.png, matrix-mobile.png, confirmation.png).
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Actual grants/reset, server errors, pending dismissal under latency, trusted-session sync after write, read-only/protected/platform roles and all keyboard paths remain unverified. No access-control runtime pass inferred from presentation. Changes remain uncommitted.

## Revenue reports — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /revenue-reports composes canonical Card, Table, Skeleton, Resource states/notice/refresh, Button and shared resource date/group filters. Removed bespoke toast/timer; CSV remains placeholder and uses global bottom-right toast. Preserved six KPI hierarchy, chart and both financial tables; chart geometry, exact BigInt scaling and tooltip/keyboard implementation unchanged.
- Default current month, period grouping, backend data/tenant scope, exact money formatting, reconciliation exclusion and all counts untouched. Daily labels now DD-MM-YYYY via existing formatter; YYYY-MM-DD wire contract unchanged. No backend/env/DB/schema changes or fabricated values.
- DateRangeFilter adds optional emptyValueLabel (default Tất cả ngày), consumed only here to accurately identify Tháng hiện tại / returned month when value=null. Other consumers keep current behavior; no state/date apply/clear changes. Removed unused dashboard CSS; retained domain KPI/chart layout. Financial tables intentionally retain horizontal scrolling on narrow viewports for cross-column comparison, with bounded 480px body and sticky headers.
- Graph: dashboard/content/loading/metric LOW; date formatter HIGH (six impacted), shared DateRangeFilter CRITICAL (ten), warnings reported before edits. Graph index reports four commits behind; source consumer inventory supplements graph. No change to the chart component source.
- Browser: default API range 01-10-2026–24-10-2026 returned zeros. Chart retained horizontal baseline; daily point 02-10-2026 showed net/gross/refund tooltip, grouping Tháng showed 10/2026 with same fields on mobile. Export showed placeholder notification via global toast host. Desktop CSS 1440x900 and mobile 375x667/668 reviewed; filter labels accurately identify default month. Evidence C:/Users/trinh/.codex/visualizations/admin-shadcn-revenue-reports/ (desktop.png, mobile.png, chart-desktop.png, chart-mobile.png).
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. No mutation executed. Nonzero/negative values, reconciliation warning, API failures/roles, explicit date-range apply and complete chart keyboard regression remain unverified. No financial accuracy/runtime mutation pass inferred. Changes remain uncommitted.

## Shipments — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /shipments list/filter/Table/mobile Card/pagination, detail Sheet with canonical information cards and fee Table, nested status confirmation with Field/Textarea use shared components. No new create/payment/cancel controls. Existing operational transitions and paid-order gate retained. Result feedback uses bottom-right toast; concurrent-change context remains in confirmation while actions stay locked.
- Preserved API services/hooks, tenant/permission checks, request/abort keys, cargo/fee values, freight payer, history actor/note and 409 refresh/lock behavior. Added synchronous pending ref guard against duplicate confirmation clicks and blocked Sheet dismissal during submission. No backend/env/DB/schema changes, no money calculations added.
- Shared display timestamp now explicit DD-MM-YYYY with existing local timezone behavior and invalid-value fallback retained. Existing trip departureDate YYYY-MM-DD is explicitly converted for display only; API contract unchanged and coordinated date-only migration remains pending.
- Graph: list LOW (one), detail LOW (two), timestamp HIGH (three); warning reported. Status callback UNKNOWN, confirmed JSX onClick consumer before editing. Index reports four commits behind; source inventory supplements graph. Removed shipments.css after no consumers/selectors remained. No shared component implementation changed in this slice.
- Browser: eight actual tenant shipments loaded. No-match search displayed the empty state and reset restored all eight records. First detail showed paid status, three cargo items, 80,000 VND total and two history events; start-transport confirmation initially focused Hủy and was canceled, no mutation submitted. Desktop CSS 1440x900 and mobile 375x667/668 reviewed; contact rows stacked within desktop columns to avoid splitting phone numbers. Mobile fee Table uses compact cell padding and wrapping header. Screenshots C:/Users/trinh/.codex/visualizations/admin-shadcn-shipments/ (desktop.png, mobile.png, detail-desktop.png, detail-mobile.png, fees-mobile.png).
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Actual transition success/toast, conflict/server failure, pending dismissal under latency, unpaid gate, restricted roles and multi-page data remain unverified. No API/DB mutation pass inferred from presentation. Changes remain uncommitted.

## Promotions — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /promotions list, toolbar, Table/mobile Card, pagination, create/edit Sheet and status confirmation use canonical components. Operation results/errors use bottom-right toast; field validation remains inline with first-invalid focus. Display dates use DD-MM-YYYY; native dates and API remain legacy YYYY-MM-DD pending coordinated DTO/consumer migration.
- Existing services/hooks, permission checks, request payloads, decimal-string validation, maximum percentage, mandatory percentage cap, code lock after use, usage limit constraints, duplicate/concurrent/unavailable errors and reactivation conditions retained. No backend/env/DB/schema changes.
- AdminMoneyInput accepts opt-in appearance=resource using canonical Input with the existing formatting, caret and decimal-string handler. Its only current production consumer is promotion form; legacy remains default for compatibility and can be removed after full consumer review. DateRangeFilter reuses existing resource adapter.
- Graph: management LOW (one impacted), form LOW (two); money input HIGH (three), warning reported. Index reports four commits behind; source consumer inventory supplements graph. PromotionDetailSheet UNKNOWN, confirmed by text search to have no current import/mount. It remains unchanged; CSS retained only for that legacy component, unused list selectors removed.
- Browser: five actual promotions loaded with active/upcoming/expired/suspended states. Empty create blocked seven fields and focused name. Percent 101 rejected; formatted cap 50.000,50 accepted in input without saving. Edit FUTA10 prefilled 10%, 50.000 VND cap, dates and 100 uses. Status confirmation initially focused Hủy; no status submission executed. Desktop 1440x900 and mobile 375x667/668 reviewed; table columns adjusted to avoid horizontal scrolling at desktop, mobile uses cards and full-height Sheet. Screenshots C:/Users/trinh/.codex/visualizations/admin-shadcn-promotions/ (desktop.png, mobile.png, form-mobile.png).
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. No mutation executed. Successful writes/toast, used-code lock under real data, server rejection/pending dismissal, date apply, sorting outcomes, multi-page and restricted roles remain unverified. Changes remain uncommitted.

## Booking and ticket details — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /booking-management/bookings/[id] and /booking-management/tickets/[id] compose canonical Card, Button, Resource states/notice/badges/pagination and responsive information rows. Header includes existing safe return link and refresh of detail/history. Removed unreferenced detail module CSS after consumer inventory.
- Preserved request/session keys, abort handling, tenant authorization including hiding detail after history 401/403, linked records, trip integrity warnings, partial cancellation, original payment and pending/succeeded/other refund groups, ticket allocations and history actor/source/override/reason. No service/backend/env/DB or money calculation changes.
- Shared timestamp formatter retains validation and Asia/Ho_Chi_Minh; display uses DD-MM-YYYY. Added legacy CHO_THAN_TOAN label. formatVnd remains unchanged, including revenue consumers. No date-only API migration.
- Pre-edit graph: page LOW; both detail content functions HIGH; information helpers/history CRITICAL. Shared timestamp/status formatter CRITICAL (12/14 impacted). Risks reported before edits; formatter consumers inspected.
- Browser: actual booking 28 loaded four tickets, one canceled and a 162,000 VND pending refund. Linked ticket 55 loaded matching refund and three history events. Desktop 1440x900 and mobile 375x667/668 reviewed; long codes wrap within cards. Evidence: C:/Users/trinh/.codex/visualizations/admin-shadcn-booking-detail/ (booking-desktop.png, ticket-desktop.png, ticket-mobile.png).
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. No mutation executed. Restricted roles, error/retry branches, multi-page history and complete return-query combinations are not runtime verified. Changes remain uncommitted.


## Booking management list — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /booking-management booking/ticket lists use canonical Tabs, Table/Card, Resource actions/states/pagination, search and status filter. Mobile cards retain links, quantities, partial cancellation and money labels. Mobile advanced filters collapse behind an aria-expanded toggle; search/status remain visible and an applied date filter is indicated on the toggle. Desktop keeps all filters visible. URL state, canonicalization, separate per-tab filters, debounce/session isolation, sort/page semantics and detail return paths remain unchanged.
- DateRangeFilter and LabeledSelectFilter accept opt-in appearance=resource, composed from canonical controls using existing state/callbacks. Default legacy presentation is preserved for revenue, promotions, account and bus-company consumers. Date range applies only a complete ordered legacy YYYY-MM-DD range as before; no DTO migration. Display timestamp adapter retains existing validation and Vietnam timezone, with explicit two-digit day/month and four-digit year. Legacy CHO_THAN_TOAN label is displayed as Chờ thanh toán without changing status values or filters. Exact money formatting and domain status mapping untouched.
- Graph pre-edit: list/page and all four table/card consumers LOW, sort header LOW. Shared DateRangeFilter CRITICAL (ten impacted) and LabeledSelectFilter HIGH (four); warnings reported before editing. Native tab handler removed after replacing its JSX consumers with canonical Tabs keyboard behavior. Removed unreferenced booking-management.module.css; detail module CSS remains legacy for its separate slice.
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Backend/env/DB/services unchanged; no new mutation controls. Detail routes are not migrated in this slice. Browser evidence recorded below; changes remain uncommitted.
- Browser: ten real booking records and 22 tickets loaded from existing API. ArrowRight switched Phiếu đặt vé to Vé and URL gained tab=tickets; panel label updated. Date-range popup rendered labeled native fields with Apply disabled for an empty range. Mobile advanced toggle expanded its controls; no-match ticket search showed empty state and reset restored the list. Desktop CSS 1440x900, mobile 375x667/668, document width 356px; first mobile card moved from about y=826 to y=496 after compact filters. Screenshot folder C:/Users/trinh/.codex/visualizations/admin-shadcn-booking-management/ (desktop.png, tickets-desktop.png, mobile.png).
- No mutation executed. Date range apply, page-size changes, sort-result ordering, multi-page navigation, restricted roles, server failures and detail return navigation are not runtime verified. Legacy shared filter consumers were preserved in source; no broad runtime regression claim.

## Support chat — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- /support-chat reuses AdminPageHeader and ResourceState for permission/loading presentation. Messenger consumes canonical Button/Input/Badge, Resource state/notice/confirmation, search and status filter. Domain layout remains a two-pane messaging workspace, with list/detail switching on mobile, owned by admin-chat-messenger.module.css.
- Reconciliation, socket handlers, tenant/API/auth scope, REST fallback, clientMessageId deduplication, transcript/read-ACK refs, older-message paging and typing behavior preserved. No service/hook/backend/env/DB changes. Read-only chat users see read-only composer context; backend remains authoritative for permissions.
- Native browser confirm replaced by ResourceConfirmation. Claim/close success and operation failure use bottom-right toast; message delivery/read/retry remains attached to the bubble. Load errors remain contextual. Removed misleading loaded-page status totals; inbox total still comes from existing API metadata.
- Pre-edit graph: AdminChatMessenger LOW (two), SupportChatContent LOW (one). Send/retry HIGH (three); claim/close UNKNOWN callback references confirmed in JSX before editing. No low-risk inference from unresolved callers.
- TypeScript, ESLint, build and git diff --check SKIPPED BY USER REQUEST. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Runtime evidence and limits recorded below. Changes remain uncommitted.
- Browser: desktop CSS 1440x900 and mobile 375x667/668 reviewed with four existing conversations. Actual history and closed/active presentation loaded; mobile back returns to inbox. Completion confirmation initially focuses Hủy and was canceled. Fixed inherited responsive Button height that overlapped conversation cards; final cards use h-auto at both breakpoints. Mobile document width 356px within 375px; compact detail header leaves approximately 199px transcript height. Evidence: C:/Users/trinh/.codex/visualizations/admin-shadcn-support-chat/desktop.png and mobile-detail.png.
- Runtime indicates Chưa kết nối realtime. No send/retry/claim/close executed; opening histories retains existing automatic read-receipt behavior. Realtime events, delivery retry/fallback, older paging, successful operation toast, permission variants and real pending dismissal remain unverified. No claim that socket/API/DB mutation flows passed.

## Customer activity workspace — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026**. Verification limits below remain applicable.

- Migrated /customers/[customerId] and transaction/ticket/shipment tabs to canonical Resource states, search, Table/Card, badges and pagination. Added shared ui/tabs.tsx adapted from official shadcn base-nova registry; Base UI owns tab/panel linkage, roving focus and keyboard behavior. Attribution updated. Shared data-filters/resource-sort.tsx composes existing SelectFilter/Button for mobile history sorting; no second sort engine.
- Existing services/hooks, lazy tab mounting, default transactions tab, API contracts, tenant/customer scope remain unchanged. Existing status mappings are retained, with the backend-used DA_THANH_TOAN value now explicitly labeled Đã thanh toán in transaction/ticket UI. Timestamp date labels and trip departure labels now use DD-MM-YYYY; date-only API remains legacy pending coordinated migration. No DB/env/backend/seed changes or new mutation controls.
- Graph pre-edit: workspace LOW (one), each history tab LOW (two), date formatters LOW (two/three). Removed customers.css after every remaining production consumer migrated. Workspace refresh now ignores aborted detail responses and displays refresh failures rather than silently hiding them behind cached customer data.
- TypeScript, ESLint, build and git diff --check: SKIPPED BY USER REQUEST. No automated test suites run. Integration/E2E/UI/component suites NOT RUN BY REQUEST. Browser evidence and remaining limits recorded below.
- Browser on 24/10/2026: existing tenant customer KH-000002 loaded a real transaction (500,000 VND), two tickets and an empty shipment history; overview showed actual account fields. ArrowRight + Enter selected Vé; End + Enter selected Tổng quan. Paid transaction now reads Đã thanh toán. Desktop CSS 1440x900 and mobile 375x667/668 reviewed; mobile document width 356px, tab list grid uses two columns without horizontal scrolling, tab targets approximately 44px high. Single-field history sorting has a static field label rather than a one-option dropdown. Screenshots: C:/Users/trinh/.codex/visualizations/admin-shadcn-customer-history/desktop.png and mobile.png.
- No mutation executed. Restricted roles, server failure/pending, multi-page histories, shipment records and mobile sort results remain unverified. No claim of full runtime regression. Changes remain uncommitted for user review.

## Customers — 23/10/2026

Status: **USER APPROVED — presentation approved on 23/10/2026**. Verification limits below remain applicable.

- Migrated /customers list, search/status filter, desktop Table, mobile Card, sorting, states, pagination and CustomerDetails Sheet to canonical components. Detail links to existing /customers/[id] activity workspace, which remains legacy for its own slice. No new customer mutation controls were added.
- Existing useCustomers, customer services, API contracts, permissions and tenant scope remain unchanged. Detail timestamp date portion uses DD-MM-YYYY without changing timestamp wire format. Browser review and limits are recorded below.
- Graph impact: CustomersManagement LOW (one), CustomerDetails LOW (two), timestampFormat LOW (three). Retained shared customers.css rules used by history workspace/tabs; removed unused detail-only styles and list section rule after consumer inspection.
- TypeScript, ESLint, production build and git diff --check: SKIPPED BY USER REQUEST. No test suites run. Integration/E2E/UI/component suites NOT RUN BY REQUEST. No DB/env/backend changes or mutations.
- Browser: real 15-customer dataset loaded; detail KH-000002 displayed API contact/account/timestamps and existing history link. Desktop CSS 1440x900 and mobile 375x667/668; mobile document width 356px. No-match search showed empty state and reset restored cards. Evidence: C:/Users/trinh/.codex/visualizations/admin-shadcn-customers/ (desktop.png, detail-desktop.png, mobile.png). Alternative roles, actual server failures, mobile sorting and history workspace runtime remain unverified. Changes remain uncommitted.

## Trips — 23/10/2026

Status: **USER APPROVED — presentation approved on 23/10/2026**. Verification limits below remain applicable.

- Consumers: trips-management.tsx, trip-form-dialog.tsx and trip-detail-sheet.tsx. Canonical Resource actions, Table/Card, filters, pagination, Sheet, nested edit and confirmation. Operation feedback uses bottom-right toast; validation remains inline and focuses the first invalid field. ResourceGeneratedCodeField replaces the legacy trip code field without changing preview/allocation behavior.
- SingleDateFilter now uses canonical Button/Input/Field with the existing Base UI Popover engine; trips is its only current production consumer. Existing date-filter wire values remain unchanged.
- Preserved services, hooks, tenant/permission checks, create/update payloads, automatic departure, completion/cancel rules, detail polling and lookup behavior. No backend/env/DB/seed changes. Date-only trips departureDate query/body/response remains legacy YYYY-MM-DD pending coordinated migration; visible list/detail date uses DD-MM-YYYY, native date controls remain locale dependent.
- Pre-edit graph: TripsManagement LOW (one), TripDetailSheet LOW (two), TripFormDialog HIGH (three), detail date formatters HIGH (three). TripStatusBadge CRITICAL (five) includes the seat workspace: legacy exported badge remains unchanged; migrated list/detail compose ResourceStatusBadge with the same domain labels. SingleDateFilter LOW (two). Warnings reported before changes.
- Removed dead trip CRUD CSS after inspecting consumers; retained seat workspace and shared seat-summary rules. /trips/[tripId]/seats is not migrated in this slice.
- Browser review: 38 real trips available; first page loads ten records; desktop 1440x900 and mobile 375x667/668. Empty create submit blocked all four required fields and focused route. Detail loaded real vehicle/cargo/seat summary; completion confirmation opened with Cancel focused and was canceled. No mutation executed. Mobile document width 356px within viewport 375px.
- TypeScript, ESLint, production build and git diff --check: SKIPPED BY USER REQUEST for this slice. No automated tests run; integration/E2E/UI/component suites NOT RUN BY REQUEST. No claim of verified mutation success/server errors/restricted roles or seat-workspace runtime regression.
- Evidence: C:/Users/trinh/.codex/visualizations/admin-shadcn-trips/. Changes remain uncommitted for user review.

## Fare prices — 23/10/2026

Status: **USER APPROVED — presentation approved on 23/10/2026**. Runtime verification limits below remain applicable.

- Migrated all three fare-price components: list/filter/table/mobile cards/sorting/pagination, create/edit, detail and status confirmation use canonical Resource patterns, Field/Input/Select, Table/Card and bottom-right toast. Removed unreferenced fare-prices.module.css. Existing hooks, API services, permissions, tenant scope and payloads are unchanged.
- Preserved positive integer VND validation, real calendar validation, date range validation, nullable end date, overlap/concurrent-update errors and lookup refresh branches. Current effective state comes from API. Edit keeps route/type/status immutable in its context summary.
- Date contract migration remains pending: GET/POST/PATCH /api/v1/fare-prices validFrom/validTo still use legacy YYYY-MM-DD. Native date input retains that internal representation; list/detail date labels display DD-MM-YYYY. A coordinated backend/Admin/Customer migration is required before changing wire format; native date input display is browser-locale dependent.
- Pre-edit graph: FarePriceFormDialog and detail date formatters HIGH (three impacted symbols each); management LOW (one), detail LOW (two). Warning reported before editing. UI presentation changes do not establish runtime business correctness.
- Checks: Admin TypeScript, scoped ESLint, production build and git diff --check PASS. No test suites added/run; integration/E2E/UI/component suites NOT RUN BY REQUEST.
- Browser: nine real fare prices loaded; empty submit linked errors and focused route; price 0 and 123.5 rejected; route/type Select worked inside Sheet; cancel returned focus to create; detail loaded actual price and dates; nested edit prefilled 360000 and 2026-09-01 with no editable relation/status fields; status confirmation opened and was canceled without mutation. Mobile CSS width 375px, document width 356px, no horizontal page overflow.
- Not runtime verified: date range input interaction, successful writes/toast, overlap/server rejection, actual pending dismissal, restricted roles and multi-page data. No create/update/status mutation executed. Screenshots: C:/Users/trinh/.codex/visualizations/admin-shadcn-fare-prices/desktop.png and mobile.png. Changes remain uncommitted for review.

## Routes — 23/10/2026

Status: **USER APPROVED — presentation approved on 23/10/2026**. Runtime verification limits below remain applicable.

- Consumers: `features/routes/components/routes-management.tsx` and `route-form-dialog.tsx`. List/filter/table/mobile cards/actions/skeleton/state/pagination, detail, nested edit and status confirmation now use canonical components. No backend, service, hook, parser, DTO, env, database or seed changes.
- Added canonical `components/admin/resource-generated-code-field.tsx`, consumed by route creation; accepts the same preview data and retry callback, renders a disabled Input with linked error. Existing `useBusinessCodePreview('routes', !editing)` remains the preview source; backend code allocation and request bodies are unchanged. Legacy `AdminGeneratedCodeField` remains for `trip-form-dialog.tsx` until its migration. Do not duplicate a code field in future features.
- Existing tenant ID and route:create/route:update guards, generated-code behavior, duration parser, string trimming and status mutation service are preserved. Status confirmation is retained; request errors/success use bottom-right toast, field validation stays inline with focus on the first invalid control. Timestamp wire format unchanged; visible date portion follows DD-MM-YYYY.
- Removed the unreferenced 148-line `features/routes/routes.css`. Feature content composes canonical components without adding route-specific control CSS. The list now also displays the already-returned updatedAt timestamp and details/mobile cards display existing durationMinutes (null explicitly shown as not configured).
- Pre-edit impact LOW: RoutesManagement one impacted page, RouteDetails two impacted, RouteFormDialog three impacted; RouteBadge/timestampFormat each three impacted. Final detect_changes over routes plus the earlier uncommitted vehicle-types slice reports CRITICAL (38 mapped symbols / 30 affected flows), including auth/API paths. Reviewed route form/context and mutation call sites: payload and services unchanged. No low-risk conclusion is inferred from isolated symbol counts or graph output.
- PASS: Admin TypeScript, scoped ESLint, production build, `git diff --check`. Build ran alongside Next 16 dev with isolated `.next/dev` output. No test suites added/run; no backend business logic changed. Integration/E2E/UI/component test suites: NOT RUN BY REQUEST.
- Browser review using the current tenant session: three real routes loaded; status filter Tạm ngưng returned FUTA-TX-0003; no-match search/reset restored list; code FUTA-TX-0004 loaded from preview API into disabled input; empty form and duration 0 blocked with linked errors/focus; status Select worked inside Sheet; Escape returned focus to Thêm tuyến; nested edit prefilled duration 420, canceled and returned focus to Edit; status confirmation initially focused Hủy and was canceled. Mobile Tab from close wraps to origin input. No actual create/update/status mutation executed.
- Visual geometry: desktop CSS 1440×900, mobile 375×667; no document horizontal overflow. Evidence: `C:/Users/trinh/.codex/visualizations/admin-shadcn-routes/` (desktop.png, mobile.png, form-desktop.png, form-mobile.png, confirmation.png). Native screenshot capture failed; screenshots were captured through the same tab's read-only CDP capability.
- NOT VERIFIED at runtime: successful writes/toast, generated-code retry/error, duplicate endpoints/server field rejection, pending dismissal under real latency, restricted-role sessions or multi-page data. Pending user smoke. Changes remain uncommitted; prior approved vehicle-types changes are preserved. Next slice after approval: `/fare-prices`.

## Vehicle types — 23/10/2026

Status: **USER APPROVED — presentation approved on 23/10/2026**. Runtime verification limits below remain applicable.

- Consumers: `features/vehicle-types/components/vehicle-types-management.tsx` and `vehicle-type-form-dialog.tsx`. Reuse canonical Resource actions, Sheet, states, skeleton, pagination, filters, Button, Table/Card and Field/Input. Added canonical `components/ui/textarea.tsx` from official shadcn base-nova registry with VexGo geometry/focus styling and notice attribution.
- List/table/mobile cards, sort controls, description and timestamps follow the shared contract. Detail includes existing API capacity values. Create/edit keeps the original fields and payload, tenant from authenticated session, create/update permission guards, duplicate-submit guard, trimmed strings, null description and integer capacity bounds 0–2147483647. No backend, service, hook, auth, database, env or date-only contract changes.
- Validation remains inline and linked; failed submit focuses the first invalid field. Server field validation is mapped back to fields; other request failures and create/update success use shared bottom-right toast once per result. No runtime mock data introduced.
- Nested edit lives inside the detail Sheet tree. Pending state prevents closing. Removed the unreferenced 507-line `features/vehicle-types/vehicle-types.css`; no shared stylesheet depends on it.
- Pre-edit graph impact: VehicleTypesManagement LOW (one direct page caller), VehicleTypeDetails LOW (two impacted), VehicleTypeFormDialog LOW (three impacted). Index has stale/incomplete paths; consumer source was corroborated. timestampFormat lookup returned UNKNOWN; its calls were checked in the same feature source.
- PASS: Admin `tsc --noEmit`, scoped ESLint, production build, `git diff --check`. Next 16.3.5 separates `.next/dev` from build output (confirmed in installed config); build ran without stopping the user's dev server.
- Browser review using existing tenant session: desktop CSS 1440×900 and mobile 375×667; three real records loaded; no-match search/reset; empty name submit and negative capacity submit blocked with linked errors and correct focus; Escape returns focus to create trigger; detail shows API capacities 1/5/45; nested edit prefilled and canceled, returning focus to Edit; mobile sort changed to Ngày tạo; Tab from Sheet close wraps to name. Mobile has no document overflow, and the last capacity input remains above sticky footer when focused.
- NOT VERIFIED at runtime: successful create/update, duplicate-name/server rejection, pending dismissal under real latency, alternate roles, multi-page dataset. No real data mutations executed. Integration/E2E/UI/component test suites: NOT RUN BY REQUEST. No new tests added because no backend business logic changed.
- Evidence: `C:/Users/trinh/.codex/visualizations/admin-shadcn-vehicle-types/` (desktop.png, mobile.png, edit-desktop.png, form-mobile.png). Presentation approved by the user; changes remain uncommitted. Next slice: `/routes`.

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

| Pattern                       | Canonical path under `src/`                                                                       | Migrated consumers                                                            | Remaining legacy                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Button                        | `components/ui/action-button.tsx`                                                                 | Resource actions, pagination, form, detail and confirmation in vehicles       | `components/ui/button.tsx` and its other consumers              |
| Badge                         | `components/ui/status-badge.tsx`                                                                  | `ResourceStatusBadge` in vehicle list/cards/detail                            | `ui/badge.tsx`, `AdminStatusBadge` and other consumers          |
| Input / Field / Label         | `components/ui/input.tsx`, `field.tsx`, `label.tsx`                                               | Vehicle create/edit and resource search                                       | Feature-native fields elsewhere                                 |
| Select                        | `components/ui/select.tsx`                                                                        | Vehicle filters, mobile sort and create/edit                                  | Existing data filters and native selects elsewhere              |
| Sheet / confirmation          | `components/ui/sheet.tsx`, `alert-dialog.tsx`; compositions in `components/admin/resource-ui.tsx` | Vehicle create/edit/detail/status confirmation, including nested edit/confirm | Native `AdminDialogPrimitive` and wrappers in other workflows   |
| Table / Card                  | `components/ui/table.tsx`, `card.tsx`                                                             | Vehicle desktop table and mobile cards                                        | Feature tables/cards and `admin-resource-*` CSS elsewhere       |
| Alert / Skeleton / list state | `components/ui/alert.tsx`, `skeleton.tsx`; Resource compositions                                  | Vehicle loading/error/empty/success states                                    | Existing shared/feature states elsewhere                        |
| Filters                       | `components/data-filters/resource-filters.tsx`                                                    | Vehicle toolbar and mobile sorting                                            | `data-filters.tsx` / labeled/date filter compositions elsewhere |
| Pagination                    | `ResourcePagination` in `components/admin/resource-ui.tsx`                                        | Vehicles                                                                      | Existing `AdminPagination` consumers elsewhere                  |
| Header                        | Existing `AdminPageHeader` contract with Resource action buttons                                  | Vehicles                                                                      | Header geometry retained; shell migration is later              |

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

## Admin accounts — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026; runtime checks remain unverified**.

- Consumers: `features/admin-accounts/components/admin-accounts-management.tsx`, `admin-account-form-dialog.tsx` and `admin-account-roles-dialog.tsx`. The list now uses canonical Resource actions/states/pagination/filter/sort, Table and responsive Cards. Detail, create/edit and role assignment use ResourceSheet; status changes and role revocation use ResourceConfirmation; forms use shared Field/Input/Select/Checkbox. Mutations report success through the shared bottom-right toast.
- Existing Super Admin permission checks, API services/payloads, search and date filters, sort fields, tenant-role filtering, form validation, status transition and duplicate-submit/pending-dismissal guards are preserved. Date-only values display as DD-MM-YYYY; API wire contracts remain unchanged. No mock/runtime data, backend, auth, database or env changes.
- Removed `admin-accounts-management.module.css` after its route consumers moved to the shared patterns. Removed the global `.table-error` rule after source search showed this route was its only remaining consumer.
- Pre-edit GitNexus impact: `AdminAccountsManagement` LOW with one direct page caller; `AdminAccountFormDialog` HIGH with direct callers from the list and detail flows (three affected processes); `AdminAccountRolesDialog` LOW with the detail sheet as its direct caller. The high form graph risk was reviewed; validation, service calls and payload logic were not changed.
- Checks intentionally skipped per user preference: TypeScript, ESLint, build and `git diff --check`. No unit, integration, E2E, browser, component or UI tests run; no tests added because this is a presentation-only migration. The user's Admin/API runtime was not started or inspected.
- User approved this route before continuing. Runtime smoke remains unverified: open `/admin-accounts` with a Super Admin account; inspect the desktop table and responsive account cards, sorting/filtering/date range/pagination, detail sheet, nested edit and role assignment; confirm create/edit/status/role-revocation flows and bottom-right success toasts; verify read-only permissions and pending dismissal. None of these runtime states is claimed as verified.

## Platform RBAC — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026; runtime checks remain unverified**.

- `/rbac` now opts into resource-mode `AdminRbacRoleSelector` and `AdminRbacPermissionMatrix`, shared Resource loading/error/refresh/confirmation patterns, and bottom-right success toast. Loading/error states use the shared card/state treatment; permission groups and responsive role selection use canonical components.
- Existing platform role scope, protected-role guards, permission-key filtering, unsaved draft/reset behavior, confirmation warning, service calls and API payloads are preserved. Role selection and refresh are disabled during save. No backend, auth, API, database or environment changes; no mock data.
- Removed `platform-rbac-management.module.css` after its only screen moved to shared styles/utilities. `PlatformRbacScopeNavigation` now uses the shared Resource presentation across all three routes; its legacy styling was removed in the scope-navigation slice below. Its GitNexus impact was CRITICAL because it serves all three routes; route links and active-scope semantics were preserved.
- Pre-edit GitNexus impact for `PlatformRbacManagement` was exact LOW (two direct graph callers, the page and existing unit test). No business logic or test files were changed.
- TypeScript, ESLint, build and `git diff --check` skipped per user preference. No tests or browser checks run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Runtime behavior is not claimed as verified.
- Pending user smoke: inspect `/rbac` on desktop and mobile, select roles, review dirty indicators and protected-role read-only state, change/undo permissions, save and cancel, verify the empty-permission warning, save failure display and bottom-right success toast. None of these runtime states is claimed as verified.

## Platform tenant RBAC picker — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026; runtime checks remain unverified**.

- `/rbac/tenants` now uses the shared Admin header/refresh action, canonical scope-navigation Resource mode, Card/Badge, Field/Input, Resource loading/error/empty states, and responsive linked tenant cards. Search continues to match the API-provided company name/code label; visible count follows the current search.
- Preserved `getBusCompanyFilterOptions`, its server-paginated real data, retry/abort behavior, Vietnamese case-insensitive search and `/rbac/tenants/{id}` links. No fake tenant data or changes to APIs, permissions, backend, auth, database or environment.
- Removed `platform-tenant-rbac-picker.module.css` after the picker moved to shared primitives and utilities. `PlatformRbacScopeNavigation` now uses the shared Resource presentation on the picker, platform RBAC and tenant detail routes.
- Pre-edit GitNexus impact for `PlatformTenantRbacPicker` was exact LOW (page and existing picker unit-test helper). Shared `PlatformRbacScopeNavigation` was exact CRITICAL across three route consumers; all three now use the same Resource presentation after the latest scope-navigation slice.
- TypeScript, ESLint, build and `git diff --check` skipped per user preference. No tests or browser checks run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Runtime behavior is not claimed as verified.
- User approved this route before continuing to tenant detail. Runtime checks remain unverified: inspect `/rbac/tenants` at desktop and mobile widths, search by company name/code, empty and no-match results, loading/error/retry states, refresh and tenant-card navigation. This page performs no write operation and shows no success toast today.

## Platform tenant RBAC detail — 24/10/2026

Status: **USER APPROVED — presentation approved on 24/10/2026; runtime checks remain unverified**.

- `/rbac/tenants/[nhaXeId]` now uses Resource header actions, scope navigation, notices/states, Card/Badge summaries, resource-mode role selector and permission matrix, Resource confirmation, and the shared bottom-right toast. Permission key lists have bounded scrolling and keyboard focus.
- Preserved tenant ID parsing, real tenant-name lookup, platform tenant role-permission service calls, draft tracking, filtering to tenant-scoped permission keys, default/override/effective values, empty-override warning, reset behavior and confirmation copy. Added an in-flight ref guard to prevent duplicate confirmation submissions. No API, auth, backend, database or environment changes; no mock data.
- Removed `platform-tenant-rbac-management.module.css` after its only route consumer moved to shared patterns. `PlatformRbacScopeNavigation` uses the shared Resource presentation on the tenant detail route, picker and `/rbac`.
- Pre-edit GitNexus impact for `PlatformTenantRbacManagement` was exact LOW with one direct page caller. No business service or API contract was edited.
- TypeScript, ESLint, build and `git diff --check` skipped per user preference. No tests or browser checks run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Runtime behavior is not claimed as verified.
- User approved this route before asking about remaining routes. Runtime smoke remains unverified: open a valid tenant detail and inspect desktop/mobile layout; switch roles, compare default/override/effective permissions, toggle and undo a permission, save and cancel, save an empty override, reset an existing override, and verify success/error toast behavior. Invalid tenant ID, failed tenant label lookup and API load failure should retain their existing semantics.

## Platform RBAC scope navigation — 24/10/2026

Status: **MIGRATING — shared presentation updated; pending user visual review**.

- `PlatformRbacScopeNavigation` now uses the canonical Resource button variants and responsive navigation container on `/rbac`, `/rbac/tenants` and `/rbac/tenants/[nhaXeId]`.
- Preserved both route targets, labels, icons and `aria-current="page"` active-scope behavior. This change is presentation-only.
- Consumer inventory found exactly three route callers. Removed the legacy appearance branch and `platform-rbac-scope-navigation.module.css` after all three callers adopted Resource presentation.
- Pre-edit GitNexus impact was exact CRITICAL (3 direct route callers and 5 affected processes); callers and navigation destinations were inspected before the shared component change.
- TypeScript, ESLint, build and `git diff --check` skipped per user preference. No tests or browser checks run; integration/E2E/UI/component suites NOT RUN BY REQUEST. Runtime behavior is not claimed as verified.
- Pending user smoke: inspect active scope styling and navigation between `/rbac` and `/rbac/tenants` at desktop and mobile widths; verify tenant detail retains its active tenant scope.
