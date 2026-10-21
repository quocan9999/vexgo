# Feature 07 — F6 handoff

Ngày: 2026-10-09

Branch: `feature/admin-bookings-tickets`

PR: [#35](https://github.com/quocan9999/vexgo/pull/35) — giữ trạng thái Draft

Baseline trước khi sửa: `77af7fc4f9c4b83a87baec36b1cd2a21855324de`

## Kết quả

Đã xử lý hai finding F6, chờ reviewer kiểm tra và xác nhận. Không thay đổi API runtime, Prisma schema, migration hoặc nghiệp vụ. Hai conversation F6 trên PR vẫn OPEN; không tự resolve.

### F6-A — Kiểm thử biên phân trang API

Nguyên nhân: integration suite có kiểm tra phân trang thông thường nhưng chưa khóa các biên mà DTO giới hạn (`page` tối đa 10.000, `pageSize` tối đa 100) cho đủ bốn route.

Giải pháp: bổ sung HTTP integration tests dùng NestJS, Prisma và MySQL thật cho:

- `GET /api/v1/admin/bookings`
- `GET /api/v1/admin/tickets`
- `GET /api/v1/admin/bookings/:id/history`
- `GET /api/v1/admin/tickets/:id/history`

Mỗi route kiểm tra `page=1` và `page=10000`, `pageSize=1` và `pageSize=100` trả 200 cùng metadata và dữ liệu có cấu trúc hợp lệ. Các giá trị `page=0`, `-1`, `10001`, số rất lớn, chữ và số thập phân; cùng `pageSize=0`, `101`, chữ và số thập phân phải trả 400 với `VALIDATION_ERROR` và field detail đúng. Kỳ vọng 400 cũng loại trừ hồi quy thành HTTP 500. Hai history route dùng ID booking/vé thật thuộc fixture tenant A.

Không sửa DTO hoặc code API.

### F6-B — Đồng bộ giới hạn trang Admin/API

Nguyên nhân: URL parser Admin chấp nhận trang đến 1.000.000 trong khi API giới hạn ở 10.000.

Giải pháp: giới hạn parser `bPage` và `tPage` ở 10.000. Giá trị không hợp lệ được parser đưa về trang 1 và canonicalize qua serializer hiện có. Regression tests bao phủ trang 10.000, 10.001, số rất lớn, số âm, chữ và số thập phân cho cả hai tab; xác nhận tab, tìm kiếm, bộ lọc ngày F4, trang/tìm kiếm của tab còn lại và URL synchronization được giữ nguyên. Component tests bật phản hồi API 400 cho phân trang sai, xác nhận deep link 10.001 chỉ gửi request trang hợp lệ và không hiện lỗi.

## Files thay đổi

- `apps/api/test/integration/bookings/admin-bookings-tickets-db.spec.ts`
- `apps/admin/src/features/booking-management/services/booking-management-query.ts`
- `apps/admin/test/booking-management-query.spec.tsx`
- `apps/admin/test/booking-management.spec.tsx`
- `docs/feature-07-pdv-ve-admin/handoff/FIX_F6_HANDOFF.md`

## RED/GREEN và quality gates

- Admin RED trước khi sửa parser: hai test file cho thấy 3 failures / 32 passes — URL parser vẫn trả `10001`, hai component case không gửi request trang 1 sau deep link vượt giới hạn.
- API mutation RED: tạm gỡ đúng hai `@Max(10_000)` trên DTO trong lúc chạy integration spec; bốn test boundary (mỗi route một test) thất bại vì nhận HTTP 200 thay vì 400 tại `page=10001`; 10 test còn lại của spec pass. DTO được khôi phục nguyên byte sau mutation. Không có thay đổi DTO trong diff cuối.
- API integration GREEN: `npm run test --workspace=@vexgo/api -- test/integration/bookings/admin-bookings-tickets-db.spec.ts` — PASS, 1 file / 14 tests.
- Admin regression GREEN: `npm run test --workspace=@vexgo/admin -- test/booking-management-query.spec.tsx test/booking-management.spec.tsx` — PASS, 2 files / 35 tests.
- API lint: `npm run lint --workspace=@vexgo/api` — PASS.
- API typecheck: `npm run typecheck --workspace=@vexgo/api` — PASS.
- API build: `npm run build --workspace=@vexgo/api` — PASS; prebuild sinh Prisma Client từ schema hiện tại.
- Admin lint: `npm run lint --workspace=@vexgo/admin` — PASS.
- Admin typecheck: `npm run typecheck --workspace=@vexgo/admin` — PASS.
- Admin build: `npm run build --workspace=@vexgo/admin` — PASS.
- `git diff --check` — PASS. Git có cảnh báo chuyển line ending LF sang CRLF khi thao tác tiếp theo; không có whitespace error.

## Database isolation và self-review

Trước khi chạy integration tests, đã xác minh URL test trỏ tới `127.0.0.1:3307/vexgo_feature07_test`; runtime/migration database là `127.0.0.1:3307/vexgo_feature07`, shadow database là `127.0.0.1:3307/vexgo_feature07_shadow`, database repo gốc là `127.0.0.1:3306/vexgo`. Đã xác minh danh tính DB test bằng truy vấn chỉ đọc. Bộ test dùng Prisma thật và fixture ID riêng có marker ngẫu nhiên `F07-READ-...`, cleanup fixture do test tạo. Không chạy migration, seed, drop hoặc reset database/volume.

Self-review: mỗi endpoint được gọi qua HTTP với principal có `booking:read`; response phải có pagination metadata nhất quán và history dùng resource thuộc tenant A. Tenant isolation hiện có vẫn được kiểm tra bởi các test integration hiện hữu trong cùng suite. Admin kiểm tra canonical URL và request thực tế của component, đồng thời giữ bộ lọc ngày và state của tab còn lại. Không thấy regression F4 date draft hoặc F3 search trong các regression tests đã chạy. Không có thay đổi API contract hoặc quyền RBAC.

## Trạng thái và lưu ý

- F4 và F3 đã được reviewer xác nhận PASS trước baseline này.
- Hai finding F6 đã được sửa trong diff và kiểm chứng cục bộ; đang chờ reviewer xác nhận. Chúng chưa được coi là resolved.
- PR #35 vẫn Draft; chưa merge và không chuyển sang Ready for review.
- `POST_REVIEW_FINDINGS_F4_F3_F6.md` là file local-only: chỉ đọc mục F6, không sửa, không stage, không commit hoặc push.
- Baseline so sánh là `77af7fc4f9c4b83a87baec36b1cd2a21855324de`; commit/push SHA được báo riêng sau khi hoàn tất.
