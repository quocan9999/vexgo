# Kế hoạch triển khai Feature 07 — P01 đến P05

## Phạm vi và rào chắn

- Chỉ làm trong worktree `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`, branch `feature/admin-bookings-tickets`.
- Triển khai theo các spec P01–P05 và quy tắc repository/app. Admin chỉ đọc dữ liệu đặt vé, vé, thanh toán/hoàn tiền và gửi hàng.
- Không tạo thao tác ghi từ Admin, hủy vé khách hàng, hoàn tiền, `HUY_MOT_PHAN`, tự chuyển `HOAN_THANH`, thay đổi schema để thêm `veId` cho gửi hàng, seed toàn cục, reset/drop DB hoặc đụng DB/volume repository gốc.
- Mỗi phần code đi theo TDD: test hành vi trước, quan sát RED vì lỗi đúng dự kiến, triển khai tối thiểu, xác nhận GREEN, rồi chạy các gate liên quan.
- DB integration tests chỉ dùng database riêng dạng `vexgo_feature07_*_test` trên MySQL Docker project `vexgo_feature07`; fixture phải được tạo/xóa theo ID/mã riêng của test.
- Mỗi phase kết thúc bằng rà soát diff, kiểm thử, handoff không chứa secrets và một Conventional Commit tiếng Việt. Không push, PR hoặc merge.

## P01 — RBAC và backend foundation

1. Thêm `booking:read` scope tenant vào catalog, chỉ thêm mặc định cho `NHA_XE_ADMIN`, thêm kiểu permission Admin.
2. Thêm rollout dữ liệu RBAC tối thiểu, idempotent: tạo `Quyen` và mapping global cho `NHA_XE_ADMIN` nếu thiếu; không xóa mapping cũ, không cấp cho `SUPER_ADMIN`, không thay đổi tenant override.
3. TDD cho catalog/default/scope, rollout lặp lại, giữ override, quyền từ DB khi tải lại session và trường hợp deny.
4. Chạy unit RBAC/auth/Admin permission tests, DB integration test riêng, typecheck/lint/build bị ảnh hưởng và `git diff --check`.
5. Ghi `handoff/PHASE_01_HANDOFF.md` và commit `feat: bổ sung quyền xem phiếu đặt vé`.

## P02 — API Admin chỉ đọc

1. Đối chiếu controller/service hiện có và Prisma relations; dùng GitNexus impact trước khi sửa symbol hiện hữu.
2. Tạo sáu GET endpoints list/detail/history cho bookings và tickets dưới `/api/v1/admin/...`; role tenant + `booking:read`, principal tenant ở service, query luôn scope `DonGiaoDich.nhaXeId`.
3. DTO validate search, status, khoảng ngày, page/pageSize, sort allowlist; ngày dùng business timezone và khoảng nửa mở; count booking duy nhất; sort có khóa phụ ổn định.
4. Map đúng tổng/giá vé, thanh toán, hoàn tiền, trạng thái; không lấy `DonGiaoDich.tongTien` làm tiền vé; liên kết gửi hàng theo dữ liệu hiện hữu; không tạo lịch sử giả. Detail/history tenant khác và không tồn tại cùng trả 404.
5. DB integration tests hai tenant trên DB riêng, gồm quyền, rò rỉ, ngày biên, phân trang/sort, tổng tiền và history; xác nhận GET không ghi dữ liệu.
6. Chạy API gates và `git diff --check`; ghi `handoff/PHASE_02_HANDOFF.md`, commit `feat: thêm API tra cứu phiếu đặt vé và vé`.

## P03 — Màn danh sách Admin

1. Bổ sung `/booking-management`, hai tab đặt vé/vé, URL/query state độc lập theo tab, gọi API thật qua feature service.
2. Dùng shared Admin table, filter, pagination, badge và layout; thêm navigation/permission gate không tạo link chết.
3. TDD cho state/query/service/components và các trạng thái loading, empty, error, 401/403; desktop 1440×900, mobile 375×667, keyboard/a11y.
4. Chạy Admin unit/component tests, lint, typecheck/build và `git diff --check`; ghi handoff, commit `feat: thêm màn danh sách đặt vé Admin`.

## P04 — Chi tiết và lịch sử

1. Thêm route chi tiết booking/ticket, liên kết qua lại, thông tin hành khách ở mức cần thiết, summary thanh toán/hoàn tiền/gửi hàng và hai timeline riêng từ API.
2. Không có nút mutation, suy diễn lịch sử hoặc link tới Feature 09 chưa tồn tại; xử lý loading/error/404 độc lập.
3. TDD cho service/mapping, route state, empty/error/privacy, responsive và a11y; chạy Admin gates cùng `git diff --check`.
4. Ghi handoff, commit `feat: thêm chi tiết và lịch sử đặt vé Admin`.

## P05 — Tích hợp và nghiệm thu

1. Thêm/chạy acceptance tests trên dữ liệu cô lập cho tenant A/B, override/revoke/session refresh, status/date boundary, pagination, hủy một phần/toàn bộ suy ra từ dữ liệu thật, refund pending, booking có shipment, history có thật và GET không ghi.
2. Xác minh API/Admin kết nối worktree và ports 4001/3002; kiểm tra UI 1440×900 và 375×667 cùng accessibility.
3. Chạy targeted/full gates phù hợp, self-review toàn bộ diff, GitNexus `detect_changes` đầy đủ trước commit, `git status`, rà secrets/artifacts.
4. Ghi `handoff/PHASE_05_HANDOFF.md` và `handoff/FINAL_HANDOFF.md`, commit `test: nghiệm thu Feature 07 Admin chỉ đọc`.

## Các điểm phải giữ mở nếu chưa được chứng minh

- Nguồn ghi lịch sử cho Customer cancellation và việc backend cập nhật các status đó phải được xác minh trong code hiện tại; nếu chưa có, ghi dependency/open item, không sửa Customer flow.
- `DonGiaoDich` có thể chứa nhiều loại giao dịch; chỉ lấy dữ liệu gắn với booking/ticket đúng theo quan hệ và loại giao dịch.
- Nếu GitNexus graph trả `UNKNOWN`, stale hoặc incomplete, tìm kiếm văn bản và kiểm tra trực tiếp caller trước khi thay đổi; không coi zero callers là an toàn.
