# Handoff Phase 04 — Admin detail và history UI

**Trạng thái:** PASS — đã xác minh bằng component test và browser/API thật trên DB test riêng.
**Branch:** `feature/admin-bookings-tickets`
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`
**Commit implementation P03/P04:** `33c97be5ec74e9fc8151e08f0bd9cfd8310cd717` (các route/detail được giao cùng list để các link luôn trỏ tới trang thật).

## Routes và nội dung

- `/booking-management/bookings/[bookingId]`
- `/booking-management/tickets/[ticketId]`
- Cả hai route dùng `AdminSessionGuard`, kiểm tra ID dương và gọi API detail/history tương ứng.
- Booking detail tách trạng thái phiếu, đơn giao dịch, số vé ban đầu/đã hủy/còn hiệu lực; hiển thị vé liên quan, payment/refund và shipment summary.
- Ticket detail có link về booking, tuyến/chuyến/ghế/điểm đón, giá niêm yết/giá thực tế và refund gắn vé.
- Timeline booking và ticket được tải độc lập; lỗi/retry history không làm mất detail. Lịch sử cũ được diễn đạt là trạng thái ghi nhận lúc khởi tạo, không bịa actor hay operation ID.
- Return URL chỉ chấp nhận đường dẫn nội bộ của quản lý đặt vé. Không thêm nút hủy, soát vé, hoàn tiền, Customer timeline hoặc Feature 09 link.

## Kiểm tra

- Component tests xác minh booking/ticket detail, partial cancellation, payment riêng với refund đang xử lý, shipment item summary, timeline baseline, lỗi/retry history và không render thao tác mutation.
- API DB integration kiểm tra history thật và ổn định, tổng giao dịch/payment/refund tách biệt, shipment summary, null optional relations và 404 che giấu detail/history tenant khác.
- Browser smoke mở booking detail và ticket detail qua link thật; response có từ API thật và DB test fixture.
- Booking detail và ticket detail được xem ở 1440×900 và 375×667. Mobile viewport 375px không có tràn ngang; giao diện xếp nội dung thành một cột và giữ link điều hướng đọc được.
- Admin lint/typecheck/build và targeted Vitest đều PASS (xem Phase 03).
- Fixture và session tạm đã được xóa khỏi `vexgo_feature07_test`; DB runtime `vexgo_feature07` không được ghi bởi smoke test.

## Giới hạn phạm vi

API/UI chỉ đọc lịch sử đang có. Customer history writer vẫn là dependency ngoài Feature 07; không thêm cancellation writer hoặc Customer timeline.
