# Khởi hành tự động

## Xóa chuyến chưa phát sinh giao dịch

`DELETE /api/v1/trips/:id` yêu cầu vai trò nhà xe và quyền `trip:delete`. Xóa được phép với chuyến `CHUA_KHOI_HANH` hoặc `DA_HUY` khi chưa phát sinh vé, giữ chỗ còn hiệu lực, vận đơn hay đánh giá. Vé từng được tạo và mọi vận đơn đều được giữ lại trong lịch sử, kể cả khi đã hủy/hoàn tất; chuyến đang chạy hoặc đã hoàn thành không thể xóa. Giữ chỗ đã hết hạn/được giải phóng được dọn cùng chuyến. Các dòng ghế chuyến cũng được xóa trong cùng transaction.

Thành công trả `{ "data": { "tripId": 1, "code": "..." } }`. Các lỗi nghiệp vụ trả HTTP 409 với mã `TRIP_DELETE_STATUS_NOT_ALLOWED`, `TRIP_HAS_TICKET_HISTORY`, `TRIP_HAS_ACTIVE_BOOKINGS`, `TRIP_HAS_SHIPMENT_HISTORY`, `TRIP_HAS_REVIEW_HISTORY` hoặc `TRIP_DELETE_CONFLICT`. Quyền mới được gán mặc định cho `NHA_XE_ADMIN` và `NHAN_VIEN_DIEU_HANH` bằng migration `20261025140000_add_trip_delete_permission`.

`TripDepartureService` kiểm tra mỗi 30 giây khi API chạy, đồng thời kiểm tra ngay sau bootstrap để xử lý các chuyến quá giờ trong lúc API tắt.

- Dùng `BUSINESS_TIME_ZONE` (mặc định `Asia/Ho_Chi_Minh`), so sánh ngày và giờ nghiệp vụ lưu riêng trong Prisma/MySQL.
- Mỗi lượt đọc tối đa 100 ID đến hạn qua index `ChuyenXe_departure_due_idx` (trạng thái/ngày/giờ); không ghi khi không có chuyến đến hạn. Backlog được xử lý thành từng lô ở các lượt kế tiếp. Với backlog không quá 100 chuyến, độ trễ khởi hành tối đa khoảng 30 giây khi API/DB hoạt động bình thường.
- Một `updateMany` atomic chỉ chuyển `CHUA_KHOI_HANH` và đã đến giờ sang `DANG_CHAY`; giữ nguyên chuyến đã hủy, đang chạy và hoàn thành. Predicate được kiểm tra tại lúc ghi, bảo vệ việc cập nhật/hủy lịch đồng thời.
- Chạy lặp hoặc nhiều API instance không chuyển trạng thái lần hai. Không chạy chồng các tick trong cùng process; timer được dọn khi shutdown và lỗi được ghi log để tick sau thử lại.
- Chuyến không tự hoàn thành dựa trên thời gian chạy dự kiến. Luồng hoàn thành/hủy và các chặn vé/vận đơn hiện có vẫn do service nghiệp vụ kiểm tra.
- Admin bỏ thao tác bắt đầu thủ công, tải lại danh sách/chi tiết mỗi 5 giây khi tab hiển thị. Tạm dừng cập nhật chi tiết khi đang mở form/confirm để tránh chen vào thao tác người dùng.

Kiểm chứng timezone, mốc nửa đêm, predicate trạng thái, bootstrap, shutdown và chống chạy chồng: `test/unit/trips/trip-departure.service.spec.ts`.

## Kiểm tra query plan trên MySQL

Sau khi deploy migration `20261023143000_index_due_trip_departures`, chạy EXPLAIN trên DB có dữ liệu đại diện. Thay ngày/giờ bằng thời gian nghiệp vụ muốn kiểm tra:

```sql
EXPLAIN SELECT chuyenXeId FROM ChuyenXe
WHERE trangThai = 'CHUA_KHOI_HANH'
  AND (ngayKhoiHanh < '2026-10-23'
    OR (ngayKhoiHanh = '2026-10-23' AND gioKhoiHanh <= '07:00:00'))
ORDER BY ngayKhoiHanh ASC, gioKhoiHanh ASC, chuyenXeId ASC
LIMIT 100;
```

Đối chiếu `key`, `type`, `rows` và `Extra`: index dự kiến là `ChuyenXe_departure_due_idx`, hỗ trợ status/date/time và đọc ID theo lô giới hạn. EXPLAIN trên DB thật mới xác nhận lựa chọn của optimizer; unit test chỉ xác minh predicate, kích thước lô, không ghi khi idle và tần suất polling, không thay thế query plan hoặc benchmark tải.
