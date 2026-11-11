# MASTER SPEC — Feature 09 (MVP Admin quản lý gửi hàng)

**Phạm vi chính thức:** Admin của nền tảng VexGo đa nhà xe, đọc và vận hành các phiếu gửi đã tồn tại. **Không phải** implementation toàn Feature 09.  
**Ngày chốt nghiệp vụ:** 09/10/2026. **Mục tiêu:** có demo DB-backed trước 11h nếu môi trường cho phép, nhưng không hạ security/test để chạy kịp.  
**Branch / worktree:** `feature/shipment-management` / `../vexgo-feature09`, Codex tự tạo, base `origin/develop`.  
**Doc root:** `docs/features/feature-09-gui-hang-admin/`.

## 1. Nguồn sự thật & dữ liệu quan sát

Quyết định mới của chủ dự án > schema/class diagram 002 và System Use Case mới nhất > code/migrations `origin/develop` > handoff/rule hiện hành > roadmap HTML thời kỳ đầu.

Đã kiểm tra `develop` 09/10/2026:

- `prisma/schema.prisma` có `PhieuGuiHang`, `HangHoa`, `ChiTietCuocGuiHang`, `LichSuTrangThaiPhieuGuiHang`, `DiemGiaoNhanHang`, `DiemGiaoNhanTuyenXe`, `BangCuocGuiHang`, `ChuyenXe`, `DonGiaoDich`.
- `PhieuGuiHang` giữ `chuyenXeId`, `diemGuiId`, `diemNhanId`, `donGiaoDichId` **bắt buộc**, cước snapshot và `nguoiTraCuoc`; nhiều `HangHoa` thuộc nhiều `LoaiHangHoa` trong một phiếu, nhiều `ChiTietCuocGuiHang` (mỗi loại một dòng).
- `GET /api/v1/customers/:id/shipments` đã có nhưng phục vụ lịch sử theo khách, yêu cầu `customer:read`; không biến nó thành tenant-wide shipment list.
- `apps/api/src/app.module.ts` chưa có ShipmentsModule; `apps/api/src/auth/permissions/permission-catalog.ts` chưa có quyền `shipment:*`.
- Customer Web `/shipments/new` hiện hiển thị lựa chọn nhà xe/chuyến/điểm từ dữ liệu hard-code và tự tính giá giả; nút chỉ redirect `/payment`, chưa tạo phiếu gửi qua API thật.
- Admin UI dùng `apps/admin/DESIGN.md`, shared components và API client `adminApiFetch`; phải audit trước khi thêm component mới.

Nếu branch `develop` đã thay đổi sau lần khảo sát, agent tự đối chiếu code/DB trước khi implement và ghi khác biệt vào handoff; không lặp functionality sẵn có.

## 2. Nghiệp vụ đã chốt

1. VexGo là nền tảng **online nhiều nhà xe**. Customer (làm sau) tự chọn chuyến có `nhanGuiHang`, cặp điểm giao/nhận hiển thị sẵn; người gửi **tự đem hàng đến điểm giao**, người nhận **đến điểm nhận lấy hàng**. Không còn bưu cục trung chuyển, pickup/delivery tận nơi hay hình thức gửi hàng legacy.
2. Với vé có hàng đi kèm (Feature 07 tương lai), hàng đi theo **chuyến đã đặt vé**. Với dịch vụ gửi riêng, khách **tự chọn chuyến**. Không cần Admin duyệt từng phiếu, tạo phiếu tại quầy hoặc phân công chuyến trong quy trình bình thường.
3. Phiếu đã tạo hợp lệ ở `MOI_TAO`, **không có nghĩa nhà xe đã nhận hàng thực tế**. Nhân viên có permission chuyển sang `DA_TIEP_NHAN` sau kiểm tra/bàn giao thực tế, rồi `DANG_VAN_CHUYEN`, `DA_GIAO`; backend ghi lịch sử mỗi lần thay đổi.
4. MVP **chỉ xử lý các phiếu có sẵn trong DB** (seed là dữ liệu demo MySQL thật). Không viết Customer API/create shipment/quote/online payment trong MVP.
5. Tenant của phiếu được xác định qua `PhieuGuiHang -> DonGiaoDich.nhaXeId`; chuyến và hai điểm phải thuộc cùng tenant. Identity tenant lấy từ backend-trusted session, không lấy từ client.
6. Cước, người trả cước, hàng hóa, chuyến, hai điểm của phiếu đều là thông tin **chỉ đọc** trong MVP. Thao tác status không được tự tính lại giá/đổi chuyến/đổi điểm.

## 3. Status machine (chốt cho MVP)

| Current | Target | Ý nghĩa | Điều kiện |
|---|---|---|---|
| `MOI_TAO` | `DA_TIEP_NHAN` | Đã kiểm tra, nhận hàng tại điểm giao | Nhân viên được quyền xác nhận sự kiện thật |
| `MOI_TAO` | `DA_HUY` | Hủy trước tiếp nhận | Chỉ khi chắc chắn **không phát sinh hoàn tiền**; nếu thanh toán đã thành công hoặc trạng thái tiền không xác minh được thì chặn an toàn |
| `DA_TIEP_NHAN` | `DANG_VAN_CHUYEN` | Hàng đang vận chuyển | Chuyến/phiếu vẫn hợp lệ theo domain hiện hữu; không giả trạng thái dựa trên đồng hồ |
| `DANG_VAN_CHUYEN` | `DA_GIAO` | Đã bàn giao tại điểm nhận | Có thao tác xác nhận thực tế |
| `DA_GIAO`, `DA_HUY` | không có | Terminal trong MVP | Không mở lại/hoàn tác |

- Không nhảy bước, lặp trạng thái, chuyển lùi; invalid transition `409 SHIPMENT_INVALID_STATUS_TRANSITION`, status stale/race `409 SHIPMENT_STATUS_CONFLICT`, không đủ bằng chứng an toàn hủy `409 SHIPMENT_REFUND_REQUIRED` hoặc mã conflict riêng đã được document nhất quán.
- Update có điều kiện theo `nhaXeId`/status cũ, lịch sử insert trong **cùng Prisma transaction**, actor là `taiKhoanId` từ principal đã xác minh. Một mutation thành công ↔ **đúng 1 history mới**; rollback khi insert history fail.
- Legacy phiếu không có lịch sử: hiển thị timeline trống/ghi chú `chưa ghi nhận`, **không tự bịa sự kiện**.
- Không bắt buộc ghi chú cho mọi chuyển trạng thái; nếu có note: trim, tối đa 500 ký tự, không nhận actor/role/tenant ID từ client.

## 4. API contract (resource chung)

| API | Quyền | Mục đích |
|---|---|---|
| `GET /api/v1/shipments?page=1&pageSize=10&search=&status=&sortDirection=desc` | `shipment:read` | List trong tenant, paginate/filter/search server-side |
| `GET /api/v1/shipments/:id` | `shipment:read` | Chi tiết gồm cargo, cước, điểm/chuyến, lịch sử |
| `PATCH /api/v1/shipments/:id/status` | `shipment:update` | Transition atomic, request `{ "status": "DA_TIEP_NHAN", "note": "..." }` |

Dùng `@RequireRoles(...TENANT_PRINCIPAL_ROLES)` và `@RequirePermissions`, `AuthPrincipal` từ auth hiện có, tenant filter ở service. 401 unauthenticated; 403 authenticated thiếu quyền; 404 ID không tồn tại hoặc ngoài tenant; 400 DTO/ID không hợp lệ; 409 state conflict. Không tách `/admin/*` chỉ vì UI khác. JSON camelCase, `{data}` / `{data,meta}`, tiền VND nguyên đồng nếu dữ liệu snapshot hợp lệ.

- List item: `shipmentId`, `waybillCode`, `status`, `sentAt`, `sender` (snapshot DonGiaoDich), `receiver`, `trip` (id/code/time), `originPoint`, `destinationPoint`, `totalFee`.
- Detail thêm `cargoItems` (type, weight, count, dimensions nếu có), `cargoFeeDetails` (snapshot từng loại), `feeSummary` (mainFee, serviceFee, discount, totalFee, payer), `history` (status, time, note, actor summary nullable).
- Filter `search` theo waybill (và tên/số điện thoại snapshot sender/receiver nếu hỗ trợ đúng tenant), `status` enum hiện hữu. `page`>=1, pageSize bounded; ổn định sort theo thời điểm và ID. Không leak địa chỉ điểm thành `receiver.address`.
- Không phá contract `GET /customers/:id/shipments`, không replicate nghiệp vụ ở Customer API hoặc UI.

## 5. RBAC / tenancy

- Thêm `shipment:read`, `shipment:update` vào **tenant** permission catalog. Default role NHA_XE_ADMIN và NHAN_VIEN_DIEU_HANH có hai quyền. Vai trò khác chỉ nếu được gán hợp lệ; SUPER_ADMIN không có mặc định operational scope.
- Phải đồng bộ permission vào DB demo và DB đã tồn tại **idempotent**, không cấp thêm tenant permission cho vai trò bị bảo vệ và không ghi đè cấu hình override tenant hiện có. Nếu mô hình assignment cần phân biệt tenant, theo pattern RBAC đang có, không tự cấp rộng.
- Quyền UI chỉ dùng để hiển thị; API guard và ownership ở service là hàng rào bảo mật cuối.
- Rà trực tiếp resource tenant A/B và các nested data (history, trip, cargo, fee, points). Nếu relation lệch scope, fail closed.

## 6. Admin UX

Route dự kiến `/shipments` theo Admin App Router đang có; menu chỉ hiện với `shipment:read`. Danh sách desktop table / mobile cards, tìm kiếm, status filter, server pagination, trạng thái loading/empty/error/no match; detail là shared right-side sheet theo UI pattern hiện hành. Hiển thị điểm giao/nhận với **tên + địa chỉ**, chuyến, sender/receiver, danh sách hàng, tổng cước và fee details, lịch sử có actor/thời gian/note; tiền/ngày giờ qua formatter chung. Action status qua shared confirmation modal, pending/double-submit guard, message thân thiện, invalidate/refetch list/detail sau thành công.

**Shared-first:** đọc `apps/admin/DESIGN.md`, `apps/admin/AGENTS.md`, audit `src/components/admin`, `src/components/ui`, `src/components/data-filters` và UI có sẵn để reuse detail button, sheet, table/pagination, filters, badge, confirm/alerts, loading skeleton. Không tạo lại cùng component dưới tên Shipment*. `ui-ux-pro-max` để kiểm tra consistency/accessibility/responsive, không override design tokens; test 1440×900 và 375×667.

## 7. Phases (không nhảy)

- **Environment (non-code):** tự tạo worktree, DB và shadow độc lập + ports như `ENVIRONMENT_WORKTREE.md`. Không commit secret.
- **Phase 01:** RBAC + permission DB foundation. `spec/PHASE_01_RBAC_BACKEND_FOUNDATION.md`.
- **Phase 02:** Backend shipment read API + DB tests. `spec/PHASE_02_SHIPMENT_READ_APIS.md`.
- **Phase 03:** Admin list + detail + timeline read-only. `spec/PHASE_03_ADMIN_LIST_DETAIL_UI.md`. **Demo checkpoint 1.**
- **Phase 04:** Backend status transition + history transaction. `spec/PHASE_04_STATUS_TRANSITION_API.md`.
- **Phase 05:** Admin status UI + DB/API/browser acceptance. `spec/PHASE_05_ADMIN_STATUS_UI_ACCEPTANCE.md`. **Demo checkpoint 2 / MVP DoD.**

Mỗi Phase 01–05: đọc spec, check GitNexus upstream impact, implement, chạy **targeted tests** + affected typecheck/lint/build, tự review real bugs, detect-changes trước commit, viết handoff, commit 1 lần/phase bằng Conventional Commits **tiếng Việt và body gạch đầu dòng**. Không sửa test để pass hời hợt; nếu bug thuộc HEAD mới nhất chưa push thì có thể soft reset/recommit có kiểm chứng. Không push, PR hoặc merge.

## 8. Ngoài scope và deferred

Không làm CRUD điểm giao nhận, loại hàng, bảng cước, capacity, tạo/sửa/xóa phiếu, phân công/đổi chuyến, Customer Web/Mobile, payment/refund, public tracking/GPS, image upload, delivery tận nơi/bưu cục. Feature 07 còn chưa merge: không cherry-pick hoặc merge dependency chưa rõ.

## 9. Acceptance / demo gate

- Gate A (sau Phase 03): đăng nhập tenant hợp lệ tại Admin 3003, list/detail lấy từ API 4003 / MySQL 3306 DB `vexgo_feature09`, dữ liệu chỉ tenant, UI responsive; không claim status update xong.
- Gate B (sau Phase 05): status cycle `MOI_TAO → DA_TIEP_NHAN → DANG_VAN_CHUYEN → DA_GIAO` và timeline lưu từng event, actor chính xác, immutable fee/points/trip, có test auth/tenancy/atomic/race, UI feedback/refresh verified.
- Nếu thiếu tool browser/DB hoặc user không có permission: ghi **NOT VERIFIED / BLOCKER** thay vì kết luận xong.
- Cuối cùng `MVP FEATURE 09 DEMO READY` **chỉ khi tất cả thực sự kiểm chứng**; còn lỗi → `MVP FEATURE 09 NOT READY` và chỉ rõ phase đang dở.
