# Chuẩn hóa mã nghiệp vụ tự động

- Hệ thống chuẩn hóa toàn bộ mã nghiệp vụ (tuyến xe, chuyến xe, nhân viên, khách hàng, vé, phiếu đặt, đơn giao dịch, vận đơn, hóa đơn, ghế) sang chuẩn **UUID v4** 32 ký tự hex viết thường (bỏ dấu gạch nối `-`).
- Tự động cấp phát qua hàm tiện ích `generateBusinessUuid()`, đảm bảo tính duy nhất trên toàn hệ thống mà không cần tiền tố nhà xe hay bộ đếm tuần tự trong database.
- Backend tự động sinh mã khi tạo mới; client không cần gửi trường mã (nếu client cũ gửi thì backend vẫn chấp nhận nhưng sẽ tự động gán mã UUID sinh ra).
- Trên Admin Web, các biểu mẫu tạo mới (tuyến xe, chuyến xe, nhân viên, v.v.) không cho phép người dùng chỉnh sửa mã thủ công.

## API Preview Mã (Backward Compatibility)

| Method | URL | Quyền | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/routes/code-preview` | Tenant + `route:create` | `{ "data": { "code": "a1b2c3d4e5f67890123456789abcdef0" } }` |
| GET | `/api/v1/trips/code-preview?departureDate=2026-10-23` | Tenant + `trip:create` | `{ "data": { "code": "b2c3d4e5f6a17890123456789abcdef1" } }` |

- Preview mã sinh ngẫu nhiên UUID v4 để gợi ý cho client. Mã chính thức được backend sinh và lưu tại thời điểm tạo mới thực thể trong transaction.
