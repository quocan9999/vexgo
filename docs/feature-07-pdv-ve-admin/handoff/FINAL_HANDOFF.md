# Final handoff — Feature 07 Admin booking/ticket

**Kết quả:** **READY — P01–P05 hoàn tất trong phạm vi Admin read-only; đã khắc phục toàn bộ 6 findings F1–F6.**

**Branch:** `feature/admin-bookings-tickets`
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`
**Base:** `origin/develop` tại `f2edf7f8562a2e397f58b7c88568e7f1e6bd40c5`
**Repo gốc:** checkout `develop` không bị sửa.

## Commit map

| Phạm vi | Commit |
| --- | --- |
| Tài liệu/spec Feature 07 | `5ced98f6a01918512b7f24f46ab95302ee4a53d1` |
| P01 — RBAC permission foundation | `83ea8f43a57723732720574f5cbcd47954b78cb8` |
| P02 — sáu Admin GET APIs | `075ea917996655d9e808f673dfd087d039f2e3b7` |
| P02 — handoff cập nhật SHA | `90afb3035e9dfd8f779cf05eef3497b9520f51a0` |
| P03/P04 — list, detail và history UI | `33c97be5ec74e9fc8151e08f0bd9cfd8310cd717` |
| P05 — sửa findings và hồi quy | `8a1a30506394140cc81f977b76dcc74ab86a12c0` |
| P04 — handoff UI và môi trường | `f94c42ac3c40a740c1752f8ae9857f19d68b3f44` |
| P05 — handoff acceptance | `c041685c09dd97e39b489f5f3271df8b04e0dae9` |
| Tiếp quản & sửa 6 findings F1–F6 | `9a62e7dbbece5defa214913af38d78173623be8b` |

Tất cả commit trên branch dùng subject Conventional Commit tiếng Việt và body là các gạch đầu dòng. Không push, tạo PR hoặc merge.

## Các findings đã xác minh và khắc phục (F1–F6)

1. **F1 — CI DB-backed integration tests:**
   - Tạo script `prisma/tests/prepare-feature07-test-database.mjs` chuẩn bị schema riêng `vexgo_feature07_ci_test` với user được phân quyền tối thiểu (SELECT/INSERT/UPDATE/DELETE).
   - Cập nhật `.github/workflows/ci.yml` chạy migration `prisma migrate deploy` vào schema test và truyền `FEATURE07_TEST_DATABASE_URL` trong bước `API tests`.
   - Cập nhật isolation check trong `admin-bookings-tickets-db.spec.ts` và `booking-permission-rollout-db.spec.ts` cho phép port 3306 trong CI (`CI=true`) và port 3307 ở local; kiểm tra tách biệt database name chống trỏ nhầm database chính.

2. **F2 — Chuẩn hóa quy trình rollout permission `booking:read`:**
   - Thêm migration chuẩn `prisma/migrations/20261008050000_add_booking_read_permission/migration.sql` cấp quyền tự động khi chạy `prisma migrate deploy`.
   - Giữ và chuẩn hóa script `prisma/rollouts/add-booking-read-permission.mjs` hỗ trợ chạy rollout độc lập (thêm npm script `npm run rollout:booking-read`).
   - Đảm bảo tính idempotent (`INSERT IGNORE`) và không ghi đè cấu hình tenant RBAC overrides (`CauHinhQuyenVaiTroNhaXe`, `CauHinhQuyenVaiTroNhaXeChiTiet`).

3. **F3 — Escape ký tự wildcard SQL LIKE:**
   - Tạo utility `apps/api/src/common/escape-sql-like.ts` xử lý escape các ký tự `%`, `_`, `\`.
   - Áp dụng vào search query của `AdminBookingsService` và `AdminTicketsService`.
   - Bổ sung regression unit tests tại `apps/api/test/unit/common/escape-sql-like.spec.ts` (6 tests pass).

4. **F4 — Date filter UX:**
   - Cập nhật `booking-management.tsx` và `booking-management-query.ts`: khi khoảng ngày không hợp lệ (From > To), giữ lại ngày người dùng vừa thao tác và chỉ xóa mốc đối diện gây xung đột thay vì xóa trắng cả hai.
   - Bổ sung 2 regression tests trong `booking-management.spec.tsx`.

5. **F5 — Nhãn tiếng Việt trạng thái gửi hàng:**
   - Bổ sung nhãn `MOI_TAO: 'Mới tạo'` và `DA_TIEP_NHAN: 'Đã tiếp nhận'` trong `booking-management-format.ts`.
   - Bổ sung test kiểm tra nhãn hiển thị trong `booking-management.spec.tsx`.

6. **F6 — Giới hạn phân trang an toàn (API pagination bounds):**
   - Thêm ràng buộc `@Max(10000)` cho `page` và `@Max(100)` cho `pageSize` trong `admin-booking-query.dto.ts`.
   - Thêm thông báo lỗi tiếng Việt rõ ràng khi vượt ngưỡng phân trang.

## Verification

- **API DB integration** trên `vexgo_feature07_test`:
  - `admin-bookings-tickets-db.spec.ts`: 9 tests PASS.
  - `booking-permission-rollout-db.spec.ts`: 1 test PASS.
  - `escape-sql-like.spec.ts`: 6 tests PASS.
- **Admin tests**:
  - `booking-management.spec.tsx`: 12 tests PASS.
  - `booking-management-query.spec.tsx`: 5 tests PASS.
  - `booking-management-access.spec.tsx`: 3 tests PASS.
  - `admin-access.spec.tsx`: 16 tests PASS.
- **Quality Gates**:
  - `npm run typecheck --workspace=@vexgo/api` — PASS.
  - `npm run lint --workspace=@vexgo/api` — PASS (0 errors, 0 warnings).
  - `npm run build --workspace=@vexgo/api` — PASS (Prisma generate + Nest build thành công).
  - `npm run typecheck --workspace=@vexgo/admin` — PASS (Route types sinh chuẩn).
  - `npm run lint --workspace=@vexgo/admin` — PASS (ESLint clean).
  - `npm run build --workspace=@vexgo/admin` — PASS (Next.js production build thành công).
- **Prisma Migrations**:
  - 24 migrations up to date trên cả database runtime `vexgo_feature07` và database test `vexgo_feature07_test`.
- **Runtime isolation**:
  - API `127.0.0.1:4001`, Admin `127.0.0.1:3002`, MySQL `127.0.0.1:3307`.
  - Repo gốc `vexgo`, database gốc `vexgo`, và branch `develop` hoàn toàn không bị thay đổi.

## Security, data và giới hạn

- Không ghi password, secret, token, log, `.env`, generated artifact hoặc fixture vào handoff/commit; DB và volume gốc không bị tác động.
- Feature 07 chỉ read-only: không thực hiện Customer cancellation/timeline writer, check-in, refund mutation, shipment mutation.
- Các dependency ngoài scope: Customer history writer và cấu hình cổng hoàn tiền thực tế `REFUND_PROVIDER_URL`.

## Kết luận

Feature 07 P01–P05 và toàn bộ 6 findings F1–F6 đã hoàn tất và sẵn sàng demo / nghiệm thu nội bộ. Chưa push, tạo PR hoặc merge.
