# Merge develop — Feature 07 pre-commit handoff

Ngày: 2026-10-19

## Trạng thái

- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature07`
- Branch: `feature/admin-bookings-tickets`; HEAD giữ nguyên `7bf5adbcb59ca6cf30c5ffa5dda53d8183b291e7`.
- Backup `backup/feature-admin-bookings-tickets` tồn tại.
- `origin/develop` được tích hợp: `8b339250a95b6825cef591b1d10ae537ba1068f4` (HEAD gồm PR #36 và #38).
- `MERGE_HEAD` trỏ tới SHA develop trên; merge còn mở theo `git merge --no-commit --no-ff`.
- Unmerged paths: 0. Conflict markers: 0. Thay đổi tracked đã stage; chưa commit/push.
- Không chạy migration, seed, reset, drop database, test hay browser smoke; không sửa worktree gốc hoặc branch develop.

## Review P1 trên PR #35

Finding P1 tại `apps/api/src/bookings/bookings.module.ts` vẫn OPEN khi kiểm tra. Reviewer yêu cầu merge local `origin/develop`, giữ dependency của booking writer và AdminBookings controller/service; không tự resolve conversation. Không có thao tác ghi nào lên PR.

## Bảy conflict và cách giải quyết

| File | Cách giải quyết |
| --- | --- |
| `.github/workflows/ci.yml` | Giữ CI mới từ develop, gồm shipment status isolation regression lặp 2 lần và production-start smoke Admin/Web; thêm Feature 07 prepare database + deploy migrations trước API tests; giữ cleanup biến test DB. |
| `apps/admin/src/features/admin-auth/services/admin-access.ts` | Hợp nhất route/permission cho booking, promotions, shipments; giữ tenant-scope gate hiện có. |
| `apps/admin/src/features/super-admin-layout/components/super-admin-layout.tsx` | Giữ menu develop và thêm booking-management; giữ đầy đủ icon, imports và type của cả ba mục. |
| `apps/admin/test/admin-access.spec.tsx` | Giữ regression cho booking, promotion, shipment và tenant/platform scope. |
| `apps/api/src/auth/permissions/permission-catalog.ts` | Hợp nhất booking, promotion, shipment; booking mặc định chỉ cấp cho NHA_XE_ADMIN; SUPER_ADMIN vẫn chỉ có quyền platform. |
| `apps/api/src/bookings/bookings.module.ts` | Giữ PrismaModule, SeatHoldsModule, PromotionsModule, CargoPricingModule, CargoCapacityModule, ShipmentsModule; thêm AdminBookingsController/AdminBookingsService vào controllers/providers/exports mà vẫn giữ BookingsController/BookingsService. |
| `apps/api/test/unit/auth/permission-catalog.spec.ts` | Hợp nhất assertions cho catalog, tenant defaults, operator shipment defaults và quyền SUPER_ADMIN. |

Các bảy file conflict qua `git diff --cached --check` không có whitespace lỗi.

## File auto-merged đã audit

- `apps/api/src/bookings/bookings.controller.ts`, `bookings.service.ts`, `apps/api/src/tickets/tickets.service.ts`: giống nguyên `origin/develop`; guest booking, seat hold, cargo, promotion, payment/SePay và cancellation logic từ develop không bị ghi đè.
- `apps/api/src/app.module.ts`, `apps/api/src/tickets/tickets.module.ts`, cùng modules SeatHolds/CargoPricing/CargoCapacity/Shipments/Promotions/Payments: imports/exports được đối chiếu; BookingsModule hiện nhập đủ dependency writer.
- Payment, shipment, promotion, seat-hold, cargo, trip và Web booking/payment/shipment/ticket/cancellation files được so với `origin/develop`; không có diff Feature 07 trong các vùng nghiệp vụ này.
- `prisma/schema.prisma` và `prisma/sync-permissions.mjs` giống develop. Merge chỉ thêm migration Feature 07 `20261008050000_add_booking_read_permission`. Permission sync là additive, không xóa VaiTroQuyen hay tenant overrides.
- Migration booking permission dùng `INSERT IGNORE` và chỉ thêm quyền mặc định cho NHA_XE_ADMIN. Các migration shipment/promotion/guest/SePay/quota từ develop vẫn còn đủ, theo thứ tự timestamp.
- Đã đối chiếu đủ sáu Admin GET endpoints: list/detail/history của `/api/v1/admin/bookings` và `/api/v1/admin/tickets`; cả hai controller yêu cầu tenant roles + `booking:read`. Customer booking/ticket controllers và writer routes từ develop vẫn còn.
- Admin client giữ envelope `data/meta` và types/validators cho detail/history gồm payment, shipment và pagination. Không phát hiện endpoint trùng, generated artifact hoặc file rác trong thay đổi.

## Impact và rủi ro tương thích

- GitNexus impact trước sửa: `BookingsModule` và `BookingsService` LOW. `getRequiredAdminPermissions` CRITICAL (20 symbols, 19 flows) và `SuperAdminLayout` CRITICAL (37 symbols, 36 flows), vì đây là shared Admin gates/layout; thay đổi chỉ thêm entries/nhánh path.
- `ADMIN_PERMISSION_CATALOG` trả UNKNOWN do graph không nối được constant callers. Đã kiểm tra source: PermissionResolverService, AdminRbacService và tenant RBAC service/DTO đều dùng catalog để lọc hoặc validate permission.
- GitNexus index cũ tại `77af7fc`, 2 commits sau đó trên Feature 07; impact không đại diện đầy đủ merged tree. Cần re-index và detect-changes ở giai đoạn tiếp theo trước commit.
- Merge-side `git diff --cached --check` báo trailing spaces/blank EOF trong một số file upstream. Feature-only check báo Markdown hard-break spaces trong sáu spec Feature 07 hiện có; không sửa các dòng tài liệu này. Conflict files sạch, không còn marker.
- Chưa chạy tests/typecheck/lint/build; tương thích hiện tại được audit tĩnh. Browser smoke cho tenant session vẫn chưa có bằng chứng.

## Gates cho giai đoạn tiếp theo

1. Re-index GitNexus, chạy detect-changes và review risk trên merged tree.
2. Chạy API permission-catalog/resolver và Nest module/booking-writer tests; chạy targeted booking, seat-hold, cargo, promotion, payment/SePay, shipment và cancellation tests.
3. Chạy Feature 07 DB-backed rollout cùng sáu Admin GET integration tests bằng schema cô lập; kiểm tra tenant A/B, history, pagination/search, payment/refund và shipment contract.
4. Chạy Admin booking-management/access/query/component tests cùng promotion/shipment RBAC tests; sau đó chạy full API/Admin/Web tests, typecheck, lint, build và CI workflows.
5. Browser smoke ở localhost/IPv4 với tenant account có `booking:read` trước khi reviewer đánh giá PR. Không resolve P1 conversation trước reviewer.

## Git status và danh sách file thay đổi

`git status`: branch `feature/admin-bookings-tickets`, merge đang mở, thay đổi tracked đã stage, không có unmerged paths; HEAD vẫn `7bf5adbcb59ca6cf30c5ffa5dda53d8183b291e7`.

Danh sách status/path đầy đủ được ghi ngay dưới đây.

```text
M	.env.example
M	.github/workflows/ci.yml
M	.gitignore
A	FEATURES.md
M	README.md
A	apps/admin/.env.example
M	apps/admin/.gitignore
M	apps/admin/DESIGN.md
M	apps/admin/package.json
A	apps/admin/src/app/promotions/page.tsx
A	apps/admin/src/app/shipments/page.tsx
M	apps/admin/src/components/data-filters/data-filters.tsx
M	apps/admin/src/features/admin-accounts/components/admin-accounts-management.tsx
M	apps/admin/src/features/admin-auth/services/admin-access.ts
M	apps/admin/src/features/bus-companies/components/bus-companies-management.tsx
M	apps/admin/src/features/customers/components/customer-details.tsx
M	apps/admin/src/features/fare-prices/components/fare-price-detail-sheet.tsx
A	apps/admin/src/features/promotions/components/promotion-detail-sheet.tsx
A	apps/admin/src/features/promotions/components/promotion-form-dialog.tsx
A	apps/admin/src/features/promotions/components/promotions-management.tsx
A	apps/admin/src/features/promotions/hooks/use-promotions.ts
A	apps/admin/src/features/promotions/promotions.module.css
A	apps/admin/src/features/promotions/services/promotion-service.ts
A	apps/admin/src/features/promotions/types/promotion.ts
M	apps/admin/src/features/routes/components/routes-management.tsx
A	apps/admin/src/features/shipments/components/shipment-details.tsx
A	apps/admin/src/features/shipments/components/shipments-management.tsx
A	apps/admin/src/features/shipments/hooks/use-shipments.ts
A	apps/admin/src/features/shipments/services/shipment-service.ts
A	apps/admin/src/features/shipments/shipments.css
A	apps/admin/src/features/shipments/types/shipment.ts
M	apps/admin/src/features/super-admin-layout/components/super-admin-layout.tsx
M	apps/admin/src/features/trips/components/trip-detail-sheet.tsx
M	apps/admin/src/features/vehicle-types/components/vehicle-types-management.tsx
M	apps/admin/src/features/vehicles/components/vehicles-management.tsx
M	apps/admin/src/styles/admin-components.css
M	apps/admin/test/admin-access.spec.tsx
M	apps/admin/test/admin-accounts-access.spec.tsx
M	apps/admin/test/admin-accounts-management.spec.tsx
A	apps/admin/test/g1-rbac-navigation.spec.tsx
A	apps/admin/test/promotion-service.spec.tsx
A	apps/admin/test/promotions-access.spec.tsx
A	apps/admin/test/promotions-hook.spec.tsx
A	apps/admin/test/promotions-management.spec.tsx
A	apps/admin/test/shipments-read.spec.tsx
A	apps/admin/test/shipments-status-ui.spec.tsx
M	apps/admin/test/tenant-rbac-management.spec.tsx
M	apps/admin/test/vehicle-permissions.spec.tsx
M	apps/api/src/app.module.ts
M	apps/api/src/auth/auth.controller.ts
M	apps/api/src/auth/auth.service.ts
A	apps/api/src/auth/dto/change-password.dto.ts
M	apps/api/src/auth/permissions/permission-catalog.ts
M	apps/api/src/bookings/bookings.controller.ts
M	apps/api/src/bookings/bookings.module.ts
M	apps/api/src/bookings/bookings.service.ts
A	apps/api/src/bookings/dto/booking-quote.dto.ts
A	apps/api/src/bookings/dto/create-booking.dto.ts
A	apps/api/src/cargo-capacity/cargo-capacity.module.ts
A	apps/api/src/cargo-capacity/cargo-capacity.service.ts
A	apps/api/src/cargo-pricing/cargo-dimensions.validation.ts
A	apps/api/src/cargo-pricing/cargo-pricing.module.ts
A	apps/api/src/cargo-pricing/cargo-pricing.service.ts
A	apps/api/src/common/booking-payment-deadline.ts
M	apps/api/src/common/configure-api.ts
M	apps/api/src/common/rate-limit-policy.ts
A	apps/api/src/common/uuid-v1.ts
M	apps/api/src/main.ts
A	apps/api/src/notifications/dto/get-notifications-query.dto.ts
A	apps/api/src/notifications/notifications.controller.ts
A	apps/api/src/notifications/notifications.module.ts
A	apps/api/src/notifications/notifications.service.ts
A	apps/api/src/payments/README.md
A	apps/api/src/payments/dto/create-payment.dto.ts
A	apps/api/src/payments/dto/webhook.dto.ts
A	apps/api/src/payments/payment-attempt.ts
A	apps/api/src/payments/payment-order-lock.ts
A	apps/api/src/payments/payment-settlement.service.ts
A	apps/api/src/payments/payments.controller.ts
M	apps/api/src/payments/payments.module.ts
A	apps/api/src/payments/payments.service.ts
A	apps/api/src/promotions/dto/create-promotion.dto.ts
A	apps/api/src/promotions/dto/promotion-id-params.dto.ts
A	apps/api/src/promotions/dto/promotion-list-query.dto.ts
A	apps/api/src/promotions/dto/promotion-validators.ts
A	apps/api/src/promotions/dto/update-promotion-status.dto.ts
A	apps/api/src/promotions/dto/validate-promotion.dto.ts
A	apps/api/src/promotions/promotions.controller.ts
A	apps/api/src/promotions/promotions.module.ts
A	apps/api/src/promotions/promotions.service.ts
A	apps/api/src/promotions/public-promotions.controller.ts
A	apps/api/src/reviews/dto/create-review.dto.ts
A	apps/api/src/reviews/reviews.controller.ts
A	apps/api/src/reviews/reviews.module.ts
A	apps/api/src/reviews/reviews.service.ts
A	apps/api/src/seat-holds/dto/create-seat-hold.dto.ts
A	apps/api/src/seat-holds/dto/release-seat-hold.dto.ts
A	apps/api/src/seat-holds/seat-holds.controller.ts
A	apps/api/src/seat-holds/seat-holds.module.ts
A	apps/api/src/seat-holds/seat-holds.service.ts
A	apps/api/src/shipments/dto/create-shipment.dto.ts
A	apps/api/src/shipments/dto/lookup-shipment.dto.ts
A	apps/api/src/shipments/dto/shipment-query.dto.ts
A	apps/api/src/shipments/dto/shipment-response.dto.ts
A	apps/api/src/shipments/dto/update-shipment-status.dto.ts
A	apps/api/src/shipments/shipment-codes.ts
A	apps/api/src/shipments/shipment-persistence.service.ts
A	apps/api/src/shipments/shipments.controller.ts
A	apps/api/src/shipments/shipments.module.ts
A	apps/api/src/shipments/shipments.service.ts
M	apps/api/src/tickets/tickets.service.ts
M	apps/api/src/trips/trips.controller.ts
M	apps/api/src/trips/trips.module.ts
M	apps/api/src/trips/trips.service.ts
A	apps/api/test/integration/bookings/booking-status-history.spec.ts
A	apps/api/test/integration/payments/payments-webhook.spec.ts
A	apps/api/test/integration/promotions/promotion-schema.spec.ts
A	apps/api/test/integration/promotions/promotions-api.spec.ts
A	apps/api/test/integration/reviews/reviews.spec.ts
A	apps/api/test/integration/seat-holds/seat-holds-concurrency.spec.ts
A	apps/api/test/integration/seat-holds/seat-holds-logger-redaction.spec.ts
A	apps/api/test/integration/shipments/public-shipment-lookup.spec.ts
A	apps/api/test/integration/shipments/shipments-status.spec.ts
A	apps/api/test/integration/shipments/shipments.spec.ts
M	apps/api/test/integration/trips/trips-read.spec.ts
A	apps/api/test/support/promotion-test-database.ts
A	apps/api/test/unit/auth/change-password.spec.ts
M	apps/api/test/unit/auth/permission-catalog.spec.ts
A	apps/api/test/unit/auth/shipment-rbac.spec.ts
A	apps/api/test/unit/bookings/booking-payment-attempt.spec.ts
M	apps/api/test/unit/bookings/bookings.service.spec.ts
A	apps/api/test/unit/bookings/create-booking.dto.spec.ts
A	apps/api/test/unit/cargo-capacity/cargo-capacity.service.spec.ts
A	apps/api/test/unit/cargo-pricing/cargo-pricing.service.spec.ts
A	apps/api/test/unit/common/sanitize-request-url.spec.ts
A	apps/api/test/unit/notifications/notifications.service.spec.ts
A	apps/api/test/unit/payments/payment-settlement.service.spec.ts
A	apps/api/test/unit/payments/payments.service.spec.ts
A	apps/api/test/unit/promotions/promotion-test-database.spec.ts
A	apps/api/test/unit/promotions/promotions.service.spec.ts
A	apps/api/test/unit/reviews/reviews.service.spec.ts
A	apps/api/test/unit/seat-holds/seat-holds.service.spec.ts
A	apps/api/test/unit/shipments/create-shipment.dto.spec.ts
A	apps/api/test/unit/shipments/shipment-codes.spec.ts
A	apps/api/test/unit/shipments/shipment-persistence.service.spec.ts
A	apps/api/test/unit/shipments/shipment-query.dto.spec.ts
A	apps/api/test/unit/shipments/shipments-controller-contract.spec.ts
A	apps/api/test/unit/shipments/shipments-modules.spec.ts
A	apps/api/test/unit/shipments/shipments.service.spec.ts
A	apps/api/test/unit/shipments/update-shipment-status.dto.spec.ts
M	apps/api/test/unit/tickets/tickets.service.spec.ts
A	apps/api/test/unit/trips/trip-alternatives.spec.ts
M	apps/api/test/unit/trips/trips.service.spec.ts
A	apps/web/.env.example
M	apps/web/.gitignore
A	apps/web/AGENTS.md
A	apps/web/CLAUDE.md
M	apps/web/package.json
M	apps/web/src/components/layout/customer-header.tsx
M	apps/web/src/components/layout/customer-navigation.ts
M	apps/web/src/features/account/components/customer-activity-page.tsx
M	apps/web/src/features/account/components/password-form.tsx
M	apps/web/src/features/account/components/profile-sidebar.tsx
M	apps/web/src/features/account/services/bookings.api.ts
M	apps/web/src/features/account/services/tickets.api.ts
M	apps/web/src/features/auth/services/auth.api.ts
M	apps/web/src/features/booking/components/luggage/luggage-form.tsx
M	apps/web/src/features/booking/components/luggage/luggage-item.tsx
M	apps/web/src/features/booking/components/luggage/luggage-step.tsx
M	apps/web/src/features/booking/components/luggage/luggage-summary.tsx
M	apps/web/src/features/booking/components/one-way-booking.tsx
M	apps/web/src/features/booking/components/round-trip-booking.tsx
M	apps/web/src/features/booking/services/payment-draft.ts
A	apps/web/src/features/booking/utils/cargo-weight.ts
M	apps/web/src/features/content/components/contact-page.tsx
M	apps/web/src/features/home/components/hero-section.tsx
M	apps/web/src/features/payments/components/invoice-page.tsx
M	apps/web/src/features/payments/components/payment-page.tsx
A	apps/web/src/features/payments/services/payments.api.ts
A	apps/web/src/features/payments/services/vietqr-config.ts
M	apps/web/src/features/posts/components/post-detail.tsx
M	apps/web/src/features/posts/components/post-search-form.tsx
M	apps/web/src/features/shipments/components/send-freight-page.tsx
A	apps/web/src/features/shipments/services/shipments.api.ts
M	apps/web/src/features/tickets/components/cancel-ticket-page.tsx
M	apps/web/src/features/tickets/components/ticket-search-page.tsx
M	apps/web/src/features/tickets/services/cancel-eligibility.ts
M	apps/web/src/features/trips/components/trip-list.tsx
M	apps/web/src/features/trips/components/trip-search-form.tsx
M	apps/web/src/features/trips/services/trips.api.ts
A	apps/web/test/unit/booking/one-way-booking-flow.spec.tsx
M	apps/web/test/unit/booking/payment-draft.spec.mjs
A	apps/web/test/unit/payments/invoice-page.spec.tsx
A	apps/web/test/unit/payments/payment-page.spec.tsx
A	apps/web/test/unit/payments/vietqr-config.spec.mjs
M	apps/web/test/unit/services/api-contracts.spec.mjs
A	apps/web/test/unit/shipments/send-freight-page.spec.tsx
M	apps/web/test/unit/tickets/cancel-eligibility.spec.mjs
A	apps/web/test/unit/tickets/cancel-ticket-guard.spec.tsx
A	apps/web/test/unit/tickets/ticket-search-page.spec.tsx
A	apps/web/test/unit/workspace-start.spec.mjs
A	apps/web/vitest.config.mts
M	compose.yaml
A	docs/API_daco_dukien/Danh-Muc-API-Da-Co.md
A	docs/API_daco_dukien/Danh-Muc-API-Du-Kien.md
A	docs/NguCanh/VEXGO_CUSTOMER_TRANSACTION_FEATURES.html
A	docs/NguCanh/VEXGO_SHIPMENT_DB_MIGRATION_COMPLETION_HANDOFF.md
A	docs/NguCanh/VEXGO_SHIPMENT_DB_UI_BACKEND_IMPACT_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/ENVIRONMENT_WORKTREE.md
A	docs/features/feature-09-gui-hang-admin/README.md
A	docs/features/feature-09-gui-hang-admin/handoff/ENVIRONMENT_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/FINAL_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/HANDOFF_TEMPLATE.md
A	docs/features/feature-09-gui-hang-admin/handoff/INITIAL_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/PHASE_01_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/PHASE_02_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/PHASE_03_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/PHASE_04_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/handoff/PHASE_05_HANDOFF.md
A	docs/features/feature-09-gui-hang-admin/spec/MASTER_SPEC.md
A	docs/features/feature-09-gui-hang-admin/spec/PHASE_01_RBAC_BACKEND_FOUNDATION.md
A	docs/features/feature-09-gui-hang-admin/spec/PHASE_02_SHIPMENT_READ_APIS.md
A	docs/features/feature-09-gui-hang-admin/spec/PHASE_03_ADMIN_LIST_DETAIL_UI.md
A	docs/features/feature-09-gui-hang-admin/spec/PHASE_04_STATUS_TRANSITION_API.md
A	docs/features/feature-09-gui-hang-admin/spec/PHASE_05_ADMIN_STATUS_UI_ACCEPTANCE.md
A	docs/features/promotion-management/CONTRACT_FREEZE.md
A	docs/features/promotion-management/REVIEW_FIXES.md
A	docs/features/promotion-management/handoff/FINAL_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_00_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_01_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_02_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_03_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_04_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_05_HANDOFF.md
A	docs/features/promotion-management/handoff/PHASE_06_HANDOFF.md
M	docs/nhiem-vu/endpoint-api.md
A	docs/pr36-reconciliation/ENDPOINT_NORMALIZATION.md
A	docs/pr36-reconciliation/IMPLEMENTATION_PLAN.md
A	docs/pr36-reconciliation/PHASE_00_AUDIT.md
A	docs/pr36-reconciliation/TASK_A0_SEAT_HOLD_CONTRACT.md
A	docs/pr36-reconciliation/fix-conflict/FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/PR36_R1_SEAT_HOLD_RECONCILIATION.md
A	docs/pr36-reconciliation/fix-conflict/handoff/FINAL_REVIEW_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R2_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R3_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R5_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R6_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R7_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R8_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/R9_FINAL_HANDOFF.md
A	docs/pr36-reconciliation/fix-conflict/handoff/SEPAY_ACCOUNT_VALIDATION_HANDOFF.md
M	package-lock.json
A	prisma/migrations/20261008133047_add_giu_cho_persistent_holds/migration.sql
A	prisma/migrations/20261009010000_add_shipment_management_permissions/migration.sql
A	prisma/migrations/20261009020000_add_shipment_operator_permissions/migration.sql
A	prisma/migrations/20261014170000_allow_guest_bookings_without_customer_account/migration.sql
A	prisma/migrations/20261014181000_add_sepay_transaction_id/migration.sql
A	prisma/migrations/20261015184828_add_promotion_quota_usage_ledger/migration.sql
A	prisma/migrations/20261016110000_add_promotion_management_permissions/migration.sql
M	prisma/schema.prisma
M	prisma/seed.mjs
A	prisma/sync-permissions.mjs
M	prisma/tests/booking-ticket-status-history-migration-upgrade.mjs
A	prisma/tests/fixtures/shipment-permissions-before-migration.sql
A	prisma/tests/promotion-migration-upgrade.mjs
A	prisma/tests/run-shipment-integration-isolated.mjs
M	prisma/tests/shipment-migration-upgrade.mjs
M	prisma/verify-seed.mjs
A	scripts/next-workspace-start-smoke.test.mjs
A	scripts/run-next-workspace.mjs
A	docs/feature-07-pdv-ve-admin/handoff/MERGE_DEVELOP_PRECOMMIT.md
```
