# MASTER SPEC — Feature 07: Quản lý phiếu đặt vé & vé (Admin nhà xe)

**Trạng thái:** Design approved về nghiệp vụ/UI, implementation chưa bắt đầu.  
**Phạm vi:** `apps/admin`, API NestJS chung `apps/api`, MySQL/Prisma hiện hữu.  
**Môi trường:** Worktree/DB riêng theo `../ENVIRONMENT_WORKTREE.md`.  
**Tham chiếu kiểm tra:** `origin/develop` tại `f2edf7f8562a2e397f58b7c88568e7f1e6bd40c5` (PR #33); trước implement phải đồng bộ/kiểm tra head mới nhất.

## A. Mục đích và phạm vi

Nhân viên nhà xe được phép tra cứu phiếu đặt vé và từng vé của **nhà xe mình** để phục vụ vận hành, kiểm tra lịch sử và hỗ trợ khách. Feature 07 **read-only**: chỉ GET/list/detail/search/filter/history. **Không** tạo, sửa, hủy phiếu/vé, hoàn tiền, đổi vé, chuyển ghế, soát vé hoặc tự động hóa `HOAN_THANH` trong feature này.

Các quyết định nghiệp vụ đã thống nhất:

1. Một phiếu (`PhieuDatVe`) chứa một hay nhiều vé cùng **chính xác một `ChuyenXe`**. Mọi vé cùng `chuyenXeId`; khác chuyến phải đặt phiếu khác. Backend ghi booking phải enforce invariant (dependency luồng Customer, không làm write logic trong Admin 07).
2. Một `DonGiaoDich` có thể có phiếu đặt vé và phiếu gửi hàng đi cùng **chính chuyến đó**. Không gắn xe máy/hàng với từng vé hoặc chủ sở hữu từng vé.
3. Customer khi hủy một vé có thể chọn đồng thời hủy hàng đi kèm; khi hủy vé hiệu lực cuối cùng trong giao dịch có hàng đi cùng cần hủy đồng bộ cả hàng theo nghiệp vụ đã chốt. Giới hạn tự hủy vé **trước giờ khởi hành ít nhất 12 tiếng**; phí hủy hàng/hoàn tiền riêng chưa chốt, không tự invent. Đây là **dependency Customer/shipment** ngoài scope mutation Feature 07.
4. Customer **không hiển thị timeline**; backend vẫn phải ghi history khi thay đổi trạng thái để Admin đọc.
5. Hai bảng riêng `LichSuTrangThaiPhieuDatVe` và `LichSuTrangThaiVe` đã có trong `develop`. History phiếu riêng và từng vé riêng; không gộp timeline toàn phiếu.
6. `PhieuDatVe.trangThai` tiếp tục có `CHO_THANH_TOAN`, `DA_THANH_TOAN`, `HOAN_THANH`, `DA_HUY`; không thêm `HUY_MOT_PHAN`. Backend trả summary đếm số vé `HUY`, UI hiển thị nhãn hủy một phần khi 0 < cancelled < total. Không sinh status/history giả.
7. Không tự động cập nhật `HOAN_THANH` trong Feature 07; hiển thị state thực tế từ DB.
8. RBAC một quyền đọc chung `booking:read` cho hai tab và history; tenant scope. `SUPER_ADMIN` không đọc dữ liệu tất cả nhà xe qua Feature 07.

## B. UI / Routes

Một trang quản lý với hai tab:

- `/booking-management?tab=bookings` — Phiếu đặt vé.
- `/booking-management?tab=tickets` — Vé.
- `/booking-management/bookings/:bookingId` — chi tiết phiếu riêng.
- `/booking-management/tickets/:ticketId` — chi tiết vé riêng.

Tên route là contract đề xuất đã duyệt trong thiết kế 2, cần nhất quán khi implement. Trạng thái tab/search/filter/sort/page cần đồng bộ URL để back/forward/refresh ổn định; từng tab giữ filter riêng, không đem `status` của phiếu sang vé.

Danh sách phiếu hiển thị: mã phiếu, khách (tên + điện thoại), ngày đặt, chuyến, số vé (bao gồm số bị hủy), tổng tiền vé ban đầu, trạng thái phiếu và nhãn hủy một phần, xem chi tiết. Danh sách vé: mã vé, mã phiếu, khách, tuyến/chuyến, khởi hành, ghế, giá thực tế, trạng thái vé, xem chi tiết.

Chi tiết phiếu gồm thông tin khách, thông tin một chuyến, vé thuộc phiếu và link tới từng vé, trạng thái, thanh toán/hoàn tiền tóm tắt, hàng gửi cùng giao dịch nếu có, timeline phiếu. Chi tiết vé có link ngược về phiếu, ghế/tuyến/giờ/giá/trạng thái, timeline riêng của vé. Link sang Feature 09 chỉ xuất hiện khi route chi tiết gửi hàng có thật và người dùng có quyền phù hợp; không tạo link chết.

Reuse Admin Design Foundation, `apps/admin/AGENTS.md`, `DESIGN.md`, shared primitives, FilterToolbar, pagination, loading/error/empty/skeleton; responsive desktop 1440x900/mobile 375x667 và accessibility.

## C. API đọc riêng cho Admin

Các endpoint dưới `/api/v1` đều `GET`:

| Method + path | Mục đích |
|---|---|
| `GET /admin/bookings` | Danh sách/lọc/sort/page phiếu nhà xe |
| `GET /admin/bookings/:id` | Chi tiết phiếu |
| `GET /admin/bookings/:id/history` | Timeline phiếu |
| `GET /admin/tickets` | Danh sách/lọc/sort/page vé nhà xe |
| `GET /admin/tickets/:id` | Chi tiết vé |
| `GET /admin/tickets/:id/history` | Timeline vé |

Không sửa API Customer `GET /bookings`, `GET /tickets` thành API tenant. Có thể tái sử dụng mapper/helper nghiệp vụ nhưng **không chia sẻ quyền truy cập**. Tên endpoints Admin riêng là quyết định có chủ đích do use case và ownership khác với Customer, phù hợp ngoại lệ quy ước tại `AGENTS.md`.

Query chuẩn server-side: `search`, `status`, `bookedFrom`, `bookedTo`, `departureFrom`, `departureTo`, `page`, `pageSize`, `sortBy`, `sortDirection`. `search` match mã phiếu/vé, tên khách, SĐT; không có filter tuyến/chuyến riêng. Validate ISO date-only, from <= to, enum/status hợp lệ, field sort allowlist, size giới hạn theo convention và tie-breaker ID để phân trang ổn định. Lọc ngày dựa trên `PhieuDatVe.ngayDat` và `ChuyenXe.ngayKhoiHanh`, áp dụng business timezone thống nhất. Trạng thái phiếu và trạng thái vé không được trộn. Với date range nhiều vé, không nhân đôi booking khi join; count đúng các phiếu phân biệt.

Response envelope theo repo: đơn `{ "data": {...} }`, phân trang `{ "data": [...], "meta": { "page": 1, "pageSize": 10, "totalItems": 0, "totalPages": 0 } }`. Không trả secrets, payment provider token, internal personal data không cần thiết. Error: 400 invalid query, 401 unauthenticated, 403 role/permission, 404 not found/cross-tenant.

## D. RBAC/Tenant

- Thêm `booking:read` scope `tenant` vào `ADMIN_PERMISSION_CATALOG` + typing, default `NHA_XE_ADMIN` và frontend gate/sidebar; role nhân viên chỉ khi được cấp quyền.
- Controller dùng `@RequireRoles(...TENANT_PRINCIPAL_ROLES)` + `@RequirePermissions('booking:read')`; service xác định `nhaXeId` bằng `requireTenantPrincipal(principal)`.
- `DonGiaoDich.nhaXeId` là quan hệ chính cho phiếu; vé đi qua `Ve.phieuDatVe.donGiaoDich.nhaXeId`. History phải lọc ownership thông qua entity cha; không lấy history theo ID độc lập trước khi xác thực parent.
- Tất cả filter, count, search, detail, history, payment/shipments relation phải tenant-scoped ở DB. Cross-tenant detail/history 404, không lộ counts.
- `SUPER_ADMIN` không được bypass tenant guard.
- Quyền lưu DB: `Quyen`, `VaiTroQuyen`, tenant overrides `CauHinhQuyenVaiTroNhaXe*`. Bổ sung permission **không được ghi đè tenant overrides đang tùy chỉnh**, kể cả khi default role có quyền mới; cần rollout idempotent có kiểm tra.

## E. Dữ liệu và nghiệp vụ đọc

- `PhieuDatVe` thuộc `DonGiaoDich` (1–1). Vé thuộc phiếu, chuyến qua `Ve.gheChuyenXe.chuyenXe`.
- `DonGiaoDich` có thể có `phieuGuiHang` (1–1); shipment của dịch vụ gửi cùng hành khách phải cùng chuyến. Admin chỉ hiển thị mã vận đơn, loại hàng/tóm tắt, trạng thái thực tế, không thao tác.
- Tiền vé ban đầu: `PhieuDatVe.tongTienBanDau`. Giá từng vé: `Ve.giaThucTe`. **Không sử dụng `DonGiaoDich.tongTien` làm tiền vé** nếu chung shipment. Đọc `ThanhToan` phải tách `loaiGiaoDich` và trạng thái; khoản hoàn có `veId` nếu có, không suy ra hoàn thành khi `DANG_XU_LY` hoặc `DANG_GUI`.
- Timeline dùng các hàng thật trong hai bảng PR #33, sort `thoiDiem` + ID, hiển thị `trangThaiCu`, `trangThaiMoi`, `nguonThayDoi`, thời điểm, lý do, người thực hiện theo nguyên tắc privacy. Baseline migration không được giới thiệu thành sự kiện thực tế tại thời điểm lịch sử không biết. Không ghi history từ API GET.
- Trong cancellation hiện hữu trên snapshot develop, khi vé cuối cùng bị hủy, `DonGiaoDich.trangThai` có thể bị đặt `DA_HUY` kể cả giao dịch có shipment: **dependency đã nhận diện, không tự sửa trong Feature 07**. Admin hiển thị từng trạng thái riêng biệt, không lấy status đơn làm status shipment.
- Không tự mở rộng logic hiển thị một phiếu nhiều chuyến; bất biến cùng chuyến thuộc backend tạo booking, nếu data legacy sai invariant thì fail rõ ràng/log cảnh báo, không silently lấy vé đầu rồi mô tả sai cho mọi vé.

## F. Dependencies ngoài phạm vi

1. Customer authenticated cancellation/ownership đang do luồng khác sửa; **chưa mặc định đã merge**. Không cho phép hủy chỉ bằng ticketCode + phone.
2. Runtime history updates Customer phải ghi atomic cùng state changes, `maThaoTac`/timestamp thống nhất cho một thao tác; PR #33 chỉ DB history/backfill. Không thiết kế Customer timeline.
3. Customer cancellation + shipment đi cùng cần contract xác nhận hàng, xử lý all-or-nothing states, refund orchestration, chính sách phí hủy hàng. Tách feature/spec riêng và không chặn việc implement phần đọc Feature 07 nếu ghi chú ràng buộc nghiệm thu.
4. Feature 09 cung cấp trang chi tiết gửi hàng; chỉ link khi tồn tại.
5. Trạng thái `HOAN_THANH` tự động khi chuyến kết thúc là thiết kế khác, không làm trong Feature 07.

## G. Phases

| Phase | Nội dung | Deliverable |
|---|---|---|
| **01** | RBAC, delivery permission database, backend foundation | `spec/PHASE_01_RBAC_BACKEND_FOUNDATION.md`, quyền được kiểm chứng |
| **02** | 6 API GET + DTO + tenancy + integration tests | `spec/PHASE_02_ADMIN_READ_APIS.md` |
| **03** | Admin hai tab list/search/filter/sort/page | `spec/PHASE_03_ADMIN_LIST_UI.md` |
| **04** | Hai trang detail, timeline, payment/shipment summaries | `spec/PHASE_04_ADMIN_DETAIL_HISTORY_UI.md` |
| **05** | Tích hợp API/UI, tests, a11y/responsive, negative cases, regression | `spec/PHASE_05_INTEGRATION_ACCEPTANCE.md` |

Tất cả spec Phase 01–05 đã được chuẩn bị trước; mỗi phase phải đọc spec tương ứng, kiểm tra code HEAD và handoff phase trước, cập nhật tài liệu nếu có bất đồng với quyết định đã duyệt (không tự ý thay đổi nghiệp vụ). Không cần chia branch con. Toàn bộ docs nằm trong thư mục feature này.

## H. Test chất lượng và Definition of Done

**Backend tests bắt buộc:** role `NHA_XE_ADMIN`, staff có/không quyền, `SUPER_ADMIN`, tenant A/B list+search+count+detail+history; filter dates inclusive (timezone), status phiếu/vé riêng; sort stable, pagination; 1/3 ticket canceled; all canceled; baseline/empty history; multiple refunds pending/success, combined order with shipment, non-leak. Không mock `findMany` để tuyên bố đã test tenant isolation: phải có integration DB-backed với ít nhất hai nhà xe.

**Frontend tests bắt buộc:** query to API, tab filter isolation, URL/back/forward refresh, link phiếu↔vé, loading/empty/error/403/404, cancel stale-data display on unauthorized; no mutation buttons; 1440×900, 375×667; keyboard/a11y.

**Gates:** targeted tests theo phase + lint/typecheck/build phần liên quan, self-review diff để tìm bug thật; khi PR chạy CI đầy đủ. Chỉ DONE khi toàn bộ dữ liệu thật, tenancy và permission ở backend, timeline thật; các dependency chưa xong phải ghi rõ blocker/known limitation chứ không nói DONE cho luồng chưa kiểm chứng.

## I. Workflow và giới hạn tác động

Một worktree + một branch; `.env`/Docker project/database riêng, ports riêng, không reset/delete volume. Mỗi phase: đọc spec → inspect → implement → targeted tests → self-review → commit local Conventional Commits (subject + body tiếng Việt) → handoff. Không push tự động, không merge, không tạo PR trước khi được yêu cầu. Không commit `node_modules`, generated Prisma, logs, browser artifacts, mock payload production, `.env`, secrets; không tùy tiện sửa/migrate DB gốc. Review PR khi được yêu cầu phải tìm findings thực tế và reviewer resolve conversations sau khi sửa, không để coder tự resolve.
