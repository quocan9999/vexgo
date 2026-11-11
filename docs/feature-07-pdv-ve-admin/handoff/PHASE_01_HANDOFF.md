# Handoff Phase 01 — RBAC + Backend Foundation

**Trạng thái:** Hoàn tất

**Branch:** `feature/admin-bookings-tickets`

**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`

**Phạm vi:** Chỉ permission foundation; chưa có booking/ticket API hoặc UI.

## Thay đổi

- Thêm `booking:read` vào catalog scope `tenant` và default của riêng `NHA_XE_ADMIN`.
- Thêm permission vào union `AdminPermission`; không thêm navigation hoặc route rỗng.
- Thêm rollout dữ liệu RBAC idempotent tại `prisma/rollouts/add-booking-read-permission.mjs`. Rollout chỉ thêm permission row và global mapping nếu thiếu, giữ mô tả/mapping đã có, không thêm mapping cho `SUPER_ADMIN`, không đọc/ghi tenant override.
- Thêm unit tests cho catalog, scope, default role, resolver và Admin permission type/access.
- Thêm DB-backed test trên `vexgo_feature07_test`: chạy rollout lặp lại, kiểm tra mapping không nhân bản, quyền Super Admin không được thêm, override tenant được giữ nguyên và `AuthService.getCurrentSession` đọc quyền mới/revoke từ DB.
- Không sửa schema, migration, `prisma/seed.mjs`, Customer flow hoặc nghiệp vụ booking/ticket.

## Database rollout

- Trước rollout, xác minh:

  - `DATABASE_URL` → `127.0.0.1:3307/vexgo_feature07`
  - `MIGRATION_URL` → `127.0.0.1:3307/vexgo_feature07`
  - `SHADOW_DATABASE_URL` → `127.0.0.1:3307/vexgo_feature07_shadow`

- Dùng Docker project `vexgo_feature07`; test schema riêng `vexgo_feature07_test` trên port 3307. Test schema có user riêng chỉ được cấp quyền trên chính schema đó.
- `npx prisma migrate deploy` áp dụng 23 migration vào `vexgo_feature07_test`; không chạy seed. Schema test có 45 bảng và 23 migration hoàn tất.
- Chạy rollout với xác nhận tường minh `BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE=vexgo_feature07` trên app DB Feature 07.
- Xác minh sau rollout: `Quyen(booking:read)=1`, mapping `NHA_XE_ADMIN=1`, mapping `SUPER_ADMIN=0`; số tenant override và override detail không đổi (0 trước/sau).
- Có thể chạy lại sau khi `.env` worktree trỏ đúng DB:

  ```powershell
  $env:BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE = 'vexgo_feature07'
  node prisma/rollouts/add-booking-read-permission.mjs
  Remove-Item Env:BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE
  ```

- Không chạy `prisma db seed` hoặc `prisma/seed.mjs`. Seed tổng thể upsert demo operators/accounts/fleet/prices/transactions và có các `deleteMany` cho dữ liệu gửi hàng, hàng hóa và một số payment/refund demo; không phù hợp cho rollout permission trên DB có dữ liệu.

## Kiểm tra

- RED trước implementation: catalog/resolver tests có 5 assertion failures vì `booking:read` chưa được khai báo.
- GREEN: `npm run test --workspace @vexgo/api -- test/unit/auth test/integration/admin-rbac/booking-permission-rollout-db.spec.ts` — 14 files, 135 tests passed.
- `npm run typecheck --workspace @vexgo/api` — passed.
- `npm run lint --workspace @vexgo/api` — passed.
- `npm run build --workspace @vexgo/api` — passed; prebuild sinh Prisma Client.
- `npm run test --workspace @vexgo/admin -- test/admin-access.spec.tsx` — 1 file, 15 tests passed.
- `npm run lint --workspace @vexgo/admin` — passed.
- `npm run typecheck --workspace @vexgo/admin` — passed.
- `npm run build --workspace @vexgo/admin` — passed.
- `git diff --check` — passed trước khi thêm handoff này; chạy lại tại gate commit.
- `npm ci` ở bước setup báo 18 advisories (1 moderate, 16 high, 1 critical); không chạy `npm audit fix` hoặc nâng dependency.

## Tiếp theo

- Admin nhà xe chưa có `booking:read` trong tenant override hiện hữu cho tới khi quyền được cấp qua RBAC; resolver không tự thêm quyền vào override. Sau thay đổi override, session reload lấy tập quyền mới từ DB.
- Tiếp tục Phase 02 theo spec hiện hành. Trước khi sửa module, đối chiếu controller/service hiện có, tenant scoping và nguồn history; không sửa Customer cancellation.
- Hash của commit Phase 01 sẽ được ghi trong `FINAL_HANDOFF.md` sau khi commit hoàn tất.
