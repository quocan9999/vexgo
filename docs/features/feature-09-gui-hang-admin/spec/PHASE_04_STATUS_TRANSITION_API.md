# PHASE 04 — Shipment status transition + atomic history API

**Dependency:** Phase 03 committed, read API đã stable. **Backend only**; không sửa Customer/Payment hay schema nếu chưa thống nhất.

## API

`PATCH /api/v1/shipments/:id/status`, role tenant + `shipment:update`, JSON body:

```json
{ "status": "DA_TIEP_NHAN", "note": "Đã kiểm tra hàng tại điểm giao" }
```

Response `200 {"data":{"shipmentId":12,"status":"DA_TIEP_NHAN","updatedAt":"...ISO..."}}`. DTO dùng `class-validator` enum `TrangThaiPhieuGuiHang`, `note` optional string trim max 500; strict whitelist, cấm user-supplied `nhaXeId`, `taiKhoanId`, `paymentStatus`, `tripId`.

## State machine duy nhất

- `MOI_TAO → DA_TIEP_NHAN`, hoặc `MOI_TAO → DA_HUY` nếu **không phát sinh hoàn tiền** (nếu đã thanh toán/không chắc payment state → chặn an toàn).
- `DA_TIEP_NHAN → DANG_VAN_CHUYEN`.
- `DANG_VAN_CHUYEN → DA_GIAO`.
- `DA_HUY` và `DA_GIAO` terminal. Không skip/reverse/same-state, không tự cập nhật theo clock/trip status, không coi `DA_TIEP_NHAN` là Admin duyệt đăng ký online.
- Khi cần hủy mà có thanh toán thành công → `409 SHIPMENT_REFUND_REQUIRED` (đã chốt trong MVP); không tạo refund giả, không update status payment. Nếu không thể đánh giá payment an toàn qua entity hiện có, **deny** và nêu limitation.

## Security và DB invariant

1. Xác minh `nhaXeId` từ principal, record belongs-to-tenant qua `DonGiaoDich.nhaXeId`, cross-check trip/origin/destination tenant; client không thể override.
2. Transaction DB: xác minh current status và rule tại backend; conditional write theo `phieuGuiHangId + currentStatus + tenant relation` (hoặc khóa transaction tương đương) → only one updater wins; insert đúng **một** history `LichSuTrangThaiPhieuGuiHang` có `trangThai`, `thoiGian` backend, `taiKhoanId` từ authenticated session, `ghiChu` trong **cùng** transaction.
3. Nếu status update không match do race → 409, không insert history. Nếu insert history fail → rollback trạng thái; không swallow error rồi trả success.
4. Không mutate snapshot prices, shipment cargo, trip/points, DonGiaoDich, payment, ticket; không backfill các history event của seed phiếu cũ.
5. Authentication 401, thiếu permission 403, unknown/cross-tenant 404; body/ID invalid 400, invalid/jump/repeat/concurrent stale 409. Error contract `{statusCode,error,message}` theo root AGENTS.
6. Nếu invariant relation bị sai trong DB, deny an toàn; không trả/ghi partial cross-tenant data.

## Tests thật sự tìm bug

- 3 bước happy path liên tiếp, mỗi bước tăng exactly one history, actor `taiKhoanId` đúng; trả đúng state + ISO updatedAt.
- `MOI_TAO→DA_HUY` only nếu safe; paid → 409 và không đổi cước/status/payment/history.
- `MOI_TAO→DA_GIAO`/`DA_TIEP_NHAN→DA_GIAO`/backwards/duplicate/terminal → 409; DB unchanged.
- 401/403/cross-tenant 404; giả tenant actor trong body không được cấp quyền hoặc sửa sai resource.
- Hai request đồng thời cùng phiếu: một thành công tối đa; một update stale 409; exactly one history; không race nhờ pre-read rồi update không điều kiện.
- Fault injection trong history insertion → trạng thái rollback. Test có thể mock adapter ở unit để force failure, nhưng critical cross-tenant/concurrency phải có DB-backed target test nếu môi trường khả dụng.
- Date/time và note boundary (missing, 500/501 ký tự, empty), không append fake log.

## Commit / handoff

Chỉ sửa module shipment/API tests cần thiết; chạy targeted tests + affected API lint/typecheck/build, GitNexus impact/detect, self-review race/auth/SQL.  
`handoff/PHASE_04_HANDOFF.md` có trạng thái DB-backed tests, concurrency/rollback evidence.  
Commit subject gợi ý: `feat(shipments): xử lý trạng thái và ghi lịch sử gửi hàng` (body gạch đầu dòng).
