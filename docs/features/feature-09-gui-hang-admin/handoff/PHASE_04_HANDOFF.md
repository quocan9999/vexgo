# Handoff Phase 04 — Shipment Status Transition + Atomic History API

## 1. Thông tin tổng quan
- **Phase:** 04 — Shipment Status Transition + Atomic History API
- **Worktree:** `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature09`
- **Branch:** `feature/shipment-management`
- **API Endpoint:** `PATCH /api/v1/shipments/:id/status`
- **Quyền yêu cầu:** `shipment:update` (Tenant scope)
- **Database:** `vexgo_feature09` trên MySQL 3306

## 2. API Contract & Validation
- **Request:**
  ```http
  PATCH /api/v1/shipments/:id/status
  Content-Type: application/json
  Authorization: Bearer <tenant_token>

  {
    "status": "DA_TIEP_NHAN",
    "note": "Đã tiếp nhận hàng tại quầy giao dịch"
  }
  ```
- **Response Success (200):**
  ```json
  {
    "data": {
      "shipmentId": 12,
      "status": "DA_TIEP_NHAN",
      "updatedAt": "2026-10-09T11:45:00.000Z"
    }
  }
  ```
- **Validation DTO (`UpdateShipmentStatusDto`):**
  - `status`: bắt buộc, thuộc enum `TrangThaiPhieuGuiHang`.
  - `note`: tùy chọn, chuỗi string tối đa 500 ký tự.
  - Whitelist: loại bỏ toàn bộ dữ liệu người dùng tự cấp không hợp lệ (`nhaXeId`, `taiKhoanId`, `paymentStatus`, v.v.).

## 3. State Machine & Business Rules
- **Luồng hợp lệ:**
  - `MOI_TAO → DA_TIEP_NHAN`
  - `MOI_TAO → DA_HUY`: Chỉ cho phép khi **chưa phát sinh thanh toán thành công** (`DonGiaoDich.trangThai !== 'DA_THANH_TOAN'` và không có giao dịch `THANH_CONG`). Nếu đã thanh toán, API từ chối với `409 SHIPMENT_REFUND_REQUIRED`.
  - `DA_TIEP_NHAN → DANG_VAN_CHUYEN`
  - `DANG_VAN_CHUYEN → DA_GIAO`
- **Chặn các vi phạm trạng thái:**
  - Nhảy cóc (ví dụ `MOI_TAO → DA_GIAO`, `DA_TIEP_NHAN → DA_GIAO`): `409 INVALID_STATUS_TRANSITION`.
  - Lùi trạng thái (ví dụ `DANG_VAN_CHUYEN → DA_TIEP_NHAN`): `409 INVALID_STATUS_TRANSITION`.
  - Trùng lặp trạng thái hiện tại (ví dụ `MOI_TAO → MOI_TAO`): `409 INVALID_STATUS_TRANSITION`.
  - Cập nhật từ trạng thái kết thúc (`DA_GIAO`, `DA_HUY`): `409 INVALID_STATUS_TRANSITION`.

## 4. Concurrency & DB Transaction Invariants
- Sử dụng Prisma `$transaction` bảo đảm tính nguyên tử (atomic):
  - **Conditional update:** `tx.phieuGuiHang.updateMany` kiểm tra đồng thời `phieuGuiHangId`, `trangThai == currentStatus`, và `nhaXeId == tenantId`. Nếu có request đồng thời cập nhật trước, `count === 0` và throw `409 CONCURRENT_STATUS_UPDATE`.
  - **Audit History:** Tạo đúng 1 bản ghi `LichSuTrangThaiPhieuGuiHang` trong cùng transaction với `trangThai`, `thoiGian: now`, `taiKhoanId: principal.taiKhoanId` (được lấy tin cậy từ phiên đăng nhập, không tin client), và `ghiChu`.
  - **Rollback:** Nếu bước ghi lịch sử thất bại, toàn bộ cập nhật trạng thái phiếu gửi được rollback hoàn toàn.

## 5. Kết quả kiểm thử
- File test tích hợp: `apps/api/test/integration/shipments/shipments-status.spec.ts`
- Số lượng test: **13/13 tests PASS** (DB-backed thật trên MySQL `vexgo_feature09`):
  1. `401` unauthenticated request
  2. `403` missing `shipment:update` permission (`PERMISSION_FORBIDDEN`)
  3. `403` `SUPER_ADMIN` operational attempt
  4. `404` cross-tenant shipment access
  5. `400` invalid status enum
  6. `400` note > 500 characters
  7. Happy path 3 bước chuyển trạng thái liên tiếp (`MOI_TAO → DA_TIEP_NHAN → DANG_VAN_CHUYEN → DA_GIAO`), xác minh DB và số lượng history tăng chính xác
  8. Hủy phiếu `MOI_TAO → DA_HUY` thành công khi chưa thanh toán
  9. Chặn hủy phiếu `409 SHIPMENT_REFUND_REQUIRED` khi đơn đã thanh toán thành công
  10. Chặn nhảy cóc `MOI_TAO → DA_GIAO` (409)
  11. Chặn cập nhật lặp lại cùng trạng thái (409)
  12. Chặn cập nhật từ terminal state `DA_GIAO` (409)
  13. Xử lý đồng thời 2 request song song (concurrency race condition) an toàn: 1 winner thành công 200, 1 request 409, DB chỉ tăng 1 history.
- Toàn bộ suite backend shipments: **32/32 tests PASS**.
- Typecheck `@vexgo/api`: Không có lỗi.
