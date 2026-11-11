# Feature 09 — Initial handoff (trước khi Codex chạy)

**Trạng thái:** SPEC READY / IMPLEMENTATION NOT STARTED / runtime chưa kiểm chứng.  
**Ngày:** 09/10/2026. **Nguồn:** trao đổi với chủ dự án + kiểm tra source `develop`.

## Business decisions được duyệt

- Chỉ làm **Admin** trong MVP; Customer Web/Mobile gửi hàng online sẽ làm sau.
- Khách tương lai tự chọn chuyến xe có nhận gửi hàng; mỗi chuyến hiển thị rõ hai điểm giao/nhận. Khách mang hàng đến điểm giao, người nhận tới điểm nhận. Không có bưu cục hoặc giao/nhận tận nhà.
- Không cần Admin tạo phiếu, duyệt yêu cầu, gán/chuyển chuyến trong luồng thường.
- Admin chỉ xem và thay đổi trạng thái phiếu có sẵn từ `MOI_TAO` → `DA_TIEP_NHAN` → `DANG_VAN_CHUYEN` → `DA_GIAO`, optional hủy từ `MOI_TAO` chỉ khi không cần refund.
- Lịch sử do backend ghi atomic với actor; không bịa sự kiện cho dữ liệu legacy.

## Tech / repo state đã xác minh qua GitHub

- Schema 002 shipment đã có các bảng liên quan; `DonGiaoDich.nhaXeId` xác định tenant; `ChuyenXe.nhanGuiHang`, nhóm sức chứa tồn tại nhưng CRUD capacity không nằm trong MVP.
- `/customers/:id/shipments` thuộc read history customer workspace; không phải tenant-wide shipments resource.
- `ShipmentsModule`/`shipment:read`/`shipment:update` chưa có trên baseline kiểm tra trước task; agent phải đối chiếu lại worktree HEAD khi bắt đầu.
- `apps/admin/DESIGN.md` đã có shared-first policy; ui-ux-pro-max audit chứ không override.

## Môi trường chưa thực hiện

- **Worktree chưa được tạo bởi bộ tài liệu này.** Codex phải tự tạo/verify.
- Không có bằng chứng DB `vexgo_feature09`/shadow đã được tạo/seed; Codex phải tạo và chứng minh isolation.
- Admin 3003/API 4003/MySQL 3306 là **giá trị yêu cầu**, không phải chứng cứ runtime đã chạy.

## First next step

Đặt ZIP tại root repo chính, gửi goal cho Codex. Agent tự: inspect clean/dirty status, fetch origin/develop, worktree add safe, extract docs, đọc master+environment, DB migration/seed an toàn, rồi Phase 01.
