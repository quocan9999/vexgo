# Khởi hành tự động

`TripDepartureService` kiểm tra mỗi giây khi API chạy, đồng thời kiểm tra ngay sau bootstrap để xử lý các chuyến quá giờ trong lúc API tắt.

- Dùng `BUSINESS_TIME_ZONE` (mặc định `Asia/Ho_Chi_Minh`), so sánh ngày và giờ nghiệp vụ lưu riêng trong Prisma/MySQL.
- Một `updateMany` atomic chỉ chuyển `CHUA_KHOI_HANH` và đã đến giờ sang `DANG_CHAY`; giữ nguyên chuyến đã hủy, đang chạy và hoàn thành. Predicate được kiểm tra tại lúc ghi, bảo vệ việc cập nhật/hủy lịch đồng thời.
- Chạy lặp hoặc nhiều API instance không chuyển trạng thái lần hai. Không chạy chồng các tick trong cùng process; timer được dọn khi shutdown và lỗi được ghi log để tick sau thử lại.
- Chuyến không tự hoàn thành dựa trên thời gian chạy dự kiến. Luồng hoàn thành/hủy và các chặn vé/vận đơn hiện có vẫn do service nghiệp vụ kiểm tra.
- Admin bỏ thao tác bắt đầu thủ công, tải lại danh sách/chi tiết mỗi 5 giây khi tab hiển thị. Tạm dừng cập nhật chi tiết khi đang mở form/confirm để tránh chen vào thao tác người dùng.

Kiểm chứng timezone, mốc nửa đêm, predicate trạng thái, bootstrap, shutdown và chống chạy chồng: `test/unit/trips/trip-departure.service.spec.ts`.
