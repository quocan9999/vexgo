# Mã tuyến và mã chuyến tự động

- Tuyến: `{maNhaXe}-TX-{sequence}`, số tăng theo nhà xe.
- Chuyến: `{maNhaXe}-CX-{DDMMYYYY}-{sequence}`, số tăng theo nhà xe và ngày khởi hành lúc tạo. Dùng ngày `YYYY-MM-DD` nghiệp vụ, không chuyển ngày qua UTC/local timezone để tạo mã.
- Số có tối thiểu 4 chữ số, tiếp tục vượt 9999. Mã đã tạo không đổi khi chỉnh lịch; giữ nguyên các mã cũ.
- Backend lấy tenant từ authenticated principal. Request tạo không cần `code`; trường `code` của client cũ được chấp nhận nhưng không dùng để cấp mã.
- Cấp mã trong transaction tạo resource/ghế chuyến; khóa hàng `NhaXe` trước khi đọc số lớn nhất và ghi bộ đếm `BoDemMaNghiepVu`. Unique constraints cũ vẫn được giữ.
- Lần đầu và các lần cấp sau đối chiếu cả mã hiện có lẫn bộ đếm. Bộ đếm giữ số lớn nhất đã cấp sau triển khai, tránh tái sử dụng sau khi bản ghi bị xóa/đổi lịch. Không thể khôi phục số của dữ liệu đã hard-delete trước triển khai.
- Preview không giữ chỗ, không tăng bộ đếm. Hai form có thể cùng thấy mã dự kiến; mã chính thức trong response tạo mới là nguồn sự thật.
- Với chuyến, ô mã disabled chờ chọn ngày; sau đó tự cập nhật khi ngày thay đổi. Lỗi tải preview có nút thử lại; việc cấp mã khi lưu vẫn do backend quyết định.

## API

| Method | URL | Quyền | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/routes/code-preview` | Tenant + `route:create` | `{ "data": { "code": "FUTA-TX-0004" } }` |
| GET | `/api/v1/trips/code-preview?departureDate=2026-10-23` | Tenant + `trip:create` | `{ "data": { "code": "FUTA-CX-23102026-0001" } }` |

Ngày preview chuyến phải là ngày hợp lệ theo `YYYY-MM-DD`; lỗi theo envelope validation chung. Không có tenant trả lỗi scope; hết độ dài/số cấp trả `409 BUSINESS_CODE_EXHAUSTED`.

Deploy migration `20261023100000_add_business_code_counter` trước API mới. Migration chỉ thêm bảng bộ đếm, không sửa mã tuyến/chuyến hiện có.
