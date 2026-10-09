# PHASE 02 — Tenant-scoped shipment read APIs

**Dependency:** Phase 01 committed + handoff. **Backend only.** Không viết Customer shipment create API, Admin mutation hay payment.

## Endpoints

1. `GET /api/v1/shipments?page=1&pageSize=10&search=&status=&sortDirection=desc` → `{data: ShipmentSummary[], meta:{page,pageSize,totalItems,totalPages}}`.
2. `GET /api/v1/shipments/:id` → `{data: ShipmentDetail}` gồm `history` (timeline). Không tạo endpoint history riêng nếu không có requirement/caller.

Controller thin, `@RequireRoles(...TENANT_PRINCIPAL_ROLES)` + `@RequirePermissions('shipment:read')`, `AuthPrincipal` backend trusted; `ShipmentsModule` được import từ AppModule. Không làm `/admin/shipments` riêng hoặc reuse `/customers/:id/shipments` để trả tenant-wide.

## Ownership / query

- Query nơi `donGiaoDich.nhaXeId = requireTenantPrincipal(principal)`, xác nhận trip và `diemGui`, `diemNhan` cùng tenant. Không tin `nhaXeId` từ query/path/body.
- Lọc toàn bộ record trước phân trang, `count` cũng phải scoped; không fetch cross-tenant rồi lọc client.
- Foreign ID khác tenant giống 404; không trả nested history/recipient/PPI của tenant khác.
- Query DTO: `page`>=1, `pageSize` 1..cap nhất quán repo, `status` thuộc Prisma enum, search trim/max length, whitelist sortable fields nếu expose; default thứ tự ổn định `createdAt DESC, phieuGuiHangId DESC`.
- Data source `PhieuGuiHang`, quan hệ `DonGiaoDich`, `ChuyenXe -> TuyenXe`, `DiemGiaoNhanHang` x2, `HangHoa -> LoaiHangHoa`, `ChiTietCuocGuiHang -> BangCuoc`, `LichSuTrangThaiPhieuGuiHang -> TaiKhoan?`.
- Tránh N+1, tránh include quá nhiều PII; khống chế payload history nếu cần; không bịa history cho legacy phiếu.

## Response semantic

Summary: `shipmentId`, `waybillCode`, `sentAt` ISO, `status`, `sender` `{fullName, phoneNumber}` từ snapshot giao dịch, `receiver` `{fullName, phoneNumber}`, `trip` (tripId/code/departureDate/departureTime), `originPoint` và `destinationPoint` (pointId/name/code/address), `totalFee` số nguyên VND.

Detail mở rộng `cargoItems`, `cargoFeeDetails`, `feeSummary` (mainFee/serviceFee/discountAmount/totalFee/freightPayer), `history` (status/time/note/actor nullable) sort thời điểm + id ổn định; `chuyenXe`, điểm, giá không mutate.

Vì model `DonGiaoDich` chứa một số snapshot sender, không lấy thông tin profile hiện tại ghi đè snapshot. Điểm nhận là địa điểm nhận kiện, **không phải địa chỉ nhà người nhận**. Số tiền Decimal → VND integer nếu hợp lệ; không trôi floating-point trong tính toán.

## Tests & negative cases

- Tenant A list/count chỉ A, tenant B không xuất hiện trong dữ liệu/phân trang; `GET /:id` tenant B → 404.
- Unauthenticated 401, authorized role thiếu `shipment:read` 403; SUPER_ADMIN platform không xem operational tenant; giả mạo `nhaXeId` không mở scope.
- Invalid ID/enum/page/pageSize/search → 400; missing → 404; empty result trả `data:[]`, meta đúng.
- Detail phiếu multi-cargo-type trả đúng `ChiTietCuocGuiHang` từng loại, không nhân cước/mapping sai; đúng fee snapshot dù rate thay đổi.
- Phiếu có history rỗng → empty array, không tạo event; missing actor nullable → UI-safe response.
- Dữ liệu relational cross-tenant bất thường → fail closed, không trả partial relation khác tenant.
- Test DB-backed thực sự khi khả dụng; không mock service cốt lõi trong bài test integration.

## Gate / handoff

Test target `apps/api/test/{unit,integration}/shipments`, lint/typecheck/build affected, GitNexus impact/detect, self-review.  
Ghi `handoff/PHASE_02_HANDOFF.md`.  
Commit subject gợi ý: `feat(shipments): bổ sung API tra cứu phiếu gửi theo nhà xe` (body gạch đầu dòng).  
Phase 03 chỉ làm sau khi GET list/detail trả đúng dữ liệu thật theo quyền.
