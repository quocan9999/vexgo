# Handoff Phase 02 — Admin read APIs

**Trạng thái:** Hoàn tất<br>
**Branch:** `feature/admin-bookings-tickets`<br>
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`<br>
**Implementation commit:** `075ea917996655d9e808f673dfd087d039f2e3b7`

## Phạm vi

Đã thêm sáu endpoint GET Admin, giữ nguyên Customer controllers/services và không thay đổi Prisma schema, migration, seed, customer cancellation, payment/refund mutation hoặc shipment mutation.

| Endpoint                                 | Kết quả                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/v1/admin/bookings`             | Danh sách, search, status/date filters, allowlisted sort, pagination   |
| `GET /api/v1/admin/bookings/:id`         | Detail, trạng thái vé suy ra, payment/refund summary, shipment summary |
| `GET /api/v1/admin/bookings/:id/history` | Lịch sử phiếu riêng, phân trang                                        |
| `GET /api/v1/admin/tickets`              | Danh sách, search, status/date filters, allowlisted sort, pagination   |
| `GET /api/v1/admin/tickets/:id`          | Detail vé, booking ref, chuyến/ghế/giá và refund gắn vé                |
| `GET /api/v1/admin/tickets/:id/history`  | Lịch sử vé riêng, phân trang                                           |

Tất cả controller dùng `TENANT_PRINCIPAL_ROLES` + `booking:read`. Mỗi service gọi `requireTenantPrincipal`. Query list/detail/history đều giới hạn qua `DonGiaoDich.nhaXeId`; detail/history khác tenant và không tồn tại cùng trả 404. Filter/sort status của phiếu và vé độc lập.

Booking list đếm booking duy nhất; date range đặt vé dùng `BUSINESS_TIME_ZONE` và khoảng nửa mở. Departure filter so sánh trường `Date` theo date-only. Danh sách aggregate số vé/trip theo trang; không tải history/payment/shipment trên từng list row. Sort có khóa phụ ID. Tiền trả bằng chuỗi decimal VND; tổng tiền giao dịch tách khỏi tiền vé. Payment attempts không bị cộng; refund không gắn vé được đánh dấu `UNALLOCATED`. Chuyến không xác định duy nhất trả `trip: null` cùng `tripIntegrity`, không lấy chuyến vé đầu để đại diện.

Contract chi tiết đã ghi trong [`spec/PHASE_02_ADMIN_READ_APIS.md`](../spec/PHASE_02_ADMIN_READ_APIS.md), mục 9.

## Database và an toàn

- Trước test, xác minh URL không lộ credentials: `DATABASE_URL` và `MIGRATION_URL` → `127.0.0.1:3307/vexgo_feature07`; `SHADOW_DATABASE_URL` → `127.0.0.1:3307/vexgo_feature07_shadow`; `FEATURE07_TEST_DATABASE_URL` → `127.0.0.1:3307/vexgo_feature07_test`.
- Docker project: `vexgo_feature07`; MySQL container khỏe mạnh trên port `3307`; Docker/volume repo gốc không được dùng trong P02.
- Integration test override bằng Prisma Client thật trỏ đúng `vexgo_feature07_test`, chạy HTTP app thật, controller và `AuthorizationGuard` thật; chỉ AccessTokenGuard được thay để cấp principal fixture. Test có hai tenant, tạo fixture bằng mã UUID riêng, dọn theo ID và xác nhận không còn order/tenant fixture.
- Không chạy seed, reset, drop, migrate hoặc thay đổi dữ liệu app DB trong Phase 02.

## Kiểm tra

- RED trước implementation: cả sáu endpoint trả 404; test suite ghi nhận 8 assertion thất bại đúng vì route chưa được đăng ký.
- `npm run test --workspace @vexgo/api -- test/integration/bookings/admin-bookings-tickets-db.spec.ts` — 1 file, 9 tests passed.
- `npm run test --workspace @vexgo/api -- test/unit/auth test/integration/bookings/admin-bookings-tickets-db.spec.ts test/integration/tickets/ticket-lookup-rate-limit.spec.ts` — 15 files, 145 tests passed.
- `npm run lint --workspace @vexgo/api` — passed.
- `npm run typecheck --workspace @vexgo/api` — passed.
- `npm run build --workspace @vexgo/api` — passed; prebuild sinh Prisma Client, không sửa schema.
- `npx prettier --check apps/api/src/bookings/bookings.module.ts apps/api/src/bookings/admin-bookings.controller.ts apps/api/src/bookings/admin-bookings.service.ts apps/api/src/bookings/dto/admin-booking-query.dto.ts apps/api/src/tickets/tickets.module.ts apps/api/src/tickets/admin-tickets.controller.ts apps/api/src/tickets/admin-tickets.service.ts apps/api/test/integration/bookings/admin-bookings-tickets-db.spec.ts docs/feature-07-pdv-ve-admin/README.md docs/feature-07-pdv-ve-admin/spec/PHASE_02_ADMIN_READ_APIS.md docs/feature-07-pdv-ve-admin/handoff/PHASE_02_HANDOFF.md` — passed.
- `git diff --check` — passed tại gate trước commit.

## Giới hạn đã biết

- Một lần chạy rộng `test/integration/tickets` kéo theo `booking-ticket-status-history-db.spec.ts`, suite đó dừng trước khi chạy test vì thiếu `BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL`. Suite yêu cầu database test riêng; không được trỏ nó vào DB đang dùng và không chạy migration test có thể tạo/xóa schema. Bộ test chọn lọc cần thiết cho P02 đã pass.
- Phase này chỉ đọc các history hiện có; không thêm history giả hoặc sửa Customer cancellation. Việc Customer ghi history runtime vẫn thuộc dependency ngoài P02.
- Chưa chạy Admin UI hoặc API server như process dài hạn; phần nối UI thuộc Phase 03–04.

## Commit

SHA implementation đầy đủ: `075ea917996655d9e808f673dfd087d039f2e3b7`. Handoff được cập nhật trong commit tài liệu follow-up `90afb3035e9dfd8f779cf05eef3497b9520f51a0`.
