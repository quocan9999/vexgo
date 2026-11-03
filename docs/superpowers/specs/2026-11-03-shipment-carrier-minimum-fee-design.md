# Giá tham khảo thấp nhất khi chọn nhà xe

## Mục tiêu

Giúp khách so sánh nhà xe trước khi chọn bưu cục bằng nhãn **“Cước từ X đ”**. Đây là giá tham khảo thấp nhất, không phải cước cuối cùng.

## Phương án

- Chọn: API `shipments/options` tính mức `mucCuoc` thấp nhất còn hiệu lực trên đúng tuyến, đúng nhà xe, giữa điểm gửi/nhận đang hoạt động và có vai trò phù hợp.
- Không chọn: lấy giá theo một kiện hàng mặc định, vì khách chưa khai loại hàng/khối lượng và kết quả dễ gây hiểu nhầm.
- Không chọn: chuyển toàn bộ form kiện hàng lên trước danh sách nhà xe, vì làm thay đổi lớn luồng UI đã chốt.

## Contract và UI

- Mỗi option trả thêm `minimumEstimatedFee: number | null`.
- Danh sách sắp giá tăng dần, option chưa có giá nằm cuối; giữ `routeId` làm tie-breaker ổn định.
- Có giá: hiển thị `Cước từ <giá>`, kèm chú thích `Giá chính xác sau khi chọn bưu cục`.
- Không có giá: hiển thị `Chưa có giá tham khảo`.
- Quote, tạo đơn và chốt cước tại quầy không dùng trường tham khảo này; backend vẫn tính lại cước chính xác.

## Giới hạn

Không đổi schema/migration. Không cộng phụ phí dễ vỡ/giá trị cao vào giá “từ”. Không lấy bảng cước hết hạn, tạm ngưng hoặc thuộc điểm ngoài tuyến.
