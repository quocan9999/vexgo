# Phase 02 Spec — Admin Read APIs: Phiếu đặt vé, Vé và lịch sử

**Feature:** 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)  
**Trạng thái:** Phase 02 đã triển khai; contract thực tế và kiểm chứng được ghi ở mục 9 và `handoff/PHASE_02_HANDOFF.md`.<br>
**Phụ thuộc:** `MASTER_SPEC.md`, `PHASE_01_RBAC_BACKEND_FOUNDATION.md`, `handoff/PHASE_01_HANDOFF.md`, `ENVIRONMENT_WORKTREE.md`.

## 1. Goal và ranh giới

Implement **sáu GET endpoints dành riêng cho Admin tenant**, dùng Prisma/MySQL thực và trả dữ liệu có kiểm soát. Có search/filter/sort/page, detail, timeline riêng của phiếu/vé, tóm tắt hoàn tiền và phiếu gửi hàng đi kèm. Giữ nguyên public/Customer API; không sửa Customer mutation, không tạo enum `HUY_MOT_PHAN`, không thêm schema/migration nếu chỉ cần đọc.

Bất biến nghiệp vụ: một `PhieuDatVe` chứa nhiều `Ve` nhưng **tất cả cùng một `ChuyenXe`**; `PhieuGuiHang` đi cùng khách trong cùng `DonGiaoDich` cũng phải cùng chuyến. Đây là ràng buộc ghi ở Customer workflow, **không phải lý do để tạo logic ghi ở Admin**. Dữ liệu cũ vi phạm invariant phải được báo là không nhất quán (không âm thầm hiển thị chuyến của vé đầu như của tất cả các vé).

## 2. Đối chiếu code trước khi code

Bắt buộc đọc thực tế HEAD worktree (không áp nguyên snapshot):

- `apps/api/src/bookings/{bookings.controller.ts,bookings.service.ts,bookings.module.ts}`: API Customer `GET /bookings` và `GET /bookings/:id` kiểm tra `khachHangId`; chỉ reuse mapper/helper thuần, không reuse authorization.
- `apps/api/src/tickets/{tickets.controller.ts,tickets.service.ts,tickets.module.ts}`: Customer `GET /tickets` và `GET /tickets/:id`; tránh gọi logic cancel/refund.
- `apps/api/src/auth/{principal-scope.ts,tenant-scope.ts}`, permission decorators, guard, session principal.
- `prisma/schema.prisma`: `DonGiaoDich` (có `nhaXeId`, `phieuDatVe?`, `phieuGuiHang?`, `thanhToans[]`), `PhieuDatVe`, `Ve`, hai bảng history, `ThanhToan`, `PhieuGuiHang`, `HangHoa`, `GheChuyenXe`, `ChuyenXe`.
- `apps/api/src/common/{dto/pagination-query.dto.ts,time/business-date.ts}`, API response/exception conventions, tests hiện hữu.

Sử dụng controller/service thuộc domain tương ứng (`bookings` và `tickets`) hoặc module con rõ ràng; tránh dựng backend thứ hai. Nếu tách helper chung, không thay đổi response hiện tại của Customer và có regression test.

## 3. Endpoint contract (tất cả trong `/api/v1`)

| Endpoint                          | Response                                                                      | Quyền          |
| --------------------------------- | ----------------------------------------------------------------------------- | -------------- |
| `GET /admin/bookings`             | `{data: BookingListItem[], meta: {page,pageSize,totalItems,totalPages}}`      | `booking:read` |
| `GET /admin/bookings/:id`         | `{data: BookingDetail}`                                                       | `booking:read` |
| `GET /admin/bookings/:id/history` | `{data: BookingHistoryEntry[]}` hoặc phân trang có `meta` nếu được thống nhất | `booking:read` |
| `GET /admin/tickets`              | `{data: TicketListItem[], meta: ...}`                                         | `booking:read` |
| `GET /admin/tickets/:id`          | `{data: TicketDetail}`                                                        | `booking:read` |
| `GET /admin/tickets/:id/history`  | `{data: TicketHistoryEntry[]}` hoặc phân trang có `meta` nếu được thống nhất  | `booking:read` |

Dùng `@RequireRoles(...TENANT_PRINCIPAL_ROLES)` và `@RequirePermissions('booking:read')` cùng `@CurrentPrincipal()`; trong **mỗi service** dùng `requireTenantPrincipal(principal)`. Không tin `nhaXeId` từ query/body/client; không thêm một route public hay quyền `SUPER_ADMIN` mặc định.

**Detail / history:** trước khi trả, lọc theo entity ID **và tenant ownership cùng lúc**. Nếu không thuộc tenant hoặc không tồn tại, trả `404` như nhau; không query lịch sử hay payment xuyên tenant bằng ID trần. Check role/permission trước DB read. Truy vấn danh sách, count và nested relations đều được ràng buộc tenant.

## 4. Query DTO và dữ liệu danh sách

Query cho **mỗi** list endpoint: `search?`, `status?`, `bookedFrom?`, `bookedTo?`, `departureFrom?`, `departureTo?`, `page` (default 1), `pageSize` (default 10; max 100 hoặc nhỏ hơn theo shared convention), `sortBy?`, `sortDirection` (`asc|desc`). Không bổ sung lọc tuyến/chuyến riêng.

- Search server-side theo `PhieuDatVe.maPhieuDatVe`, `Ve.maVe`, `DonGiaoDich.tenKhachHang` và `DonGiaoDich.soDienThoaiKhachHang`, có thể dùng search qua relation `ves.some`. Trim input; chặn input dài/bất thường; đảm bảo `search` rỗng không phá danh sách. Không yêu cầu danh sách khách hàng tải sẵn.
- Trạng thái **phiếu** lọc theo `PhieuDatVe.trangThai`; trạng thái **vé** lọc theo `Ve.trangThai`. Không OR ngầm với `DonGiaoDich.trangThai` hoặc payment status; whitelist giá trị đúng với domain hiện hành.
- `bookedFrom/To`: `PhieuDatVe.ngayDat` theo **ngày nghiệp vụ** `Asia/Ho_Chi_Minh`/`BUSINESS_TIME_ZONE`. Dùng range nửa mở `[startOfFrom, startOfDayAfterTo)`; validate `from <= to`; bao gồm cả ngày cuối. `departureFrom/To`: `ChuyenXe.ngayKhoiHanh` (Prisma `Date`); không convert Date-only qua local timezone sai lệch. Nếu booking relation filter theo `ves.some`, `count` phải là số phiếu duy nhất, không nhân theo số vé.
- Sort allowlist cụ thể theo tab (dự kiến booking: `bookedAt`, `departureTime`, `totalTicketAmount`; tickets: `bookedAt`, `departureTime`, `ticketPrice`); map sang Prisma fields đã kiểm tra. Không đưa raw query vào `orderBy`. Thêm ID làm khóa phụ ổn định, không trùng/lệch khi phân trang cùng timestamp.
- Số tiền dùng decimal chính xác trong tính toán; chuyển sang response VND thống nhất, không dùng float để cộng tiền rồi rounding tùy tiện. Giới hạn response fields để giảm PII và tránh N+1; giữ `data/meta` theo project.

**Booking list item** tối thiểu: `bookingId`, `bookingCode`, `bookedAt`, `customer` (tên, SĐT), `trip` (tripId/code nếu có, origin, destination, departureAt), `initialTicketCount`, `cancelledTicketCount`, `activeTicketCount`, `initialTicketAmount`, `status`, `isPartiallyCancelled`. `isPartiallyCancelled` iff `0 < cancelledTicketCount < totalTicketCount`, tuyệt đối không lưu xuống DB và không giả định phiếu `HOAN_THANH` theo lịch trình.

**Ticket list item** tối thiểu: `ticketId`, `ticketCode`, `bookingId`, `bookingCode`, `customer`, `trip`, `seatNumber`, `actualPrice`, `status`, `bookedAt`. Vé thuộc phiếu nhà xe A không được lọt kết quả nhà xe B qua search, count, sorting hay relation.

**Đề xuất hiệu năng:** Với list, aggregate số vé theo truy vấn có giới hạn; không tải toàn bộ history, toàn bộ payment hoặc toàn bộ shipment của từng phiếu trong mỗi row. Thiết kế count và page chính xác, đo số truy vấn nếu cần; phân trang không nhân bản phiếu khi join nhiều vé.

## 5. Chi tiết booking/ticket

**Booking detail:** thông tin phiếu, khách (đúng snapshot từ `DonGiaoDich`), chuyến, danh sách vé với seat/code/status/price/link ID, status summary, tiền vé ban đầu `PhieuDatVe.tongTienBanDau`, tóm tắt thanh toán/hoàn tiền và phiếu hàng liên quan nếu `DonGiaoDich.phieuGuiHang` tồn tại. Không nhầm `DonGiaoDich.tongTien` (có thể gồm hàng) thành tiền vé. Trả null/rỗng có chủ ý khi thiếu dữ liệu, không tự chế trạng thái/thời điểm.

**Ticket detail:** ticket, booking ref, customer, chuyến/ghế/giá/điểm đón (nếu có), trạng thái, thông tin hoàn tiền **gắn vé đó** nếu có; không hiển thị nút/hợp đồng hủy/quote cho Admin. Không cần tải timeline trong detail payload nếu lịch sử có API riêng.

**Thanh toán:** `ThanhToan` có `loaiGiaoDich` (`THANH_TOAN`/`HOAN_TIEN`...), `trangThai`, `veId?`. Trả phân biệt (a) status đơn giao dịch, (b) original payment status/method nếu có thực, (c) refund summary: pending (`DANG_XU_LY`/`DANG_GUI`), succeeded (`THANH_CONG`), các trạng thái khác phản ánh đúng DB. Không cộng nhầm nhiều payment attempts/duplicate, không tính refund pending là tiền đã trả; đừng gán bừa mọi refund vào một vé khi `veId=null`. Nếu không xác định tách chính xác tiền hàng vs tiền vé đã thanh toán, ghi rõ `unallocated`/null, tránh ngụy tạo allocation.

**Shipment:** chỉ tổng quan `phieuGuiHangId`, `maVanDon`, `trangThai`, `chuyenXeId`, loại hàng/tóm tắt từ relation hàng hóa nếu có, không trả ảnh/tệp nhạy cảm và không điều khiển vận chuyển. `PhieuGuiHang` phải thuộc chính đơn tenant đã xác minh. Không gắn shipment với ticket owner / `veId`.

**Trip invariant:** chuẩn một phiếu/chuyến; nếu dữ liệu legacy sai hoặc không thể suy ra duy nhất, không khẳng định thông tin chuyến sai. Cần fallback/diagnostic rõ ràng và test (ví dụ null `trip` + flag integrity warning nội bộ, hoặc lỗi nghiệp vụ có kiểm soát) theo policy đã duyệt; tuyệt đối không làm mutation sửa dữ liệu khi GET.

## 6. Lịch sử riêng, không timeline Customer

- Booking history lấy từ `LichSuTrangThaiPhieuDatVe`, ticket history từ `LichSuTrangThaiVe`. Có thể include actor name theo mức tối thiểu cho phép; không phơi PII hoặc JWT. Trả `trangThaiCu`, `trangThaiMoi`, `thoiDiem`, `nguonThayDoi`, `lyDo`, `laOverride`, `maThaoTac`, actor display-safe khi cần.
- Sắp xếp `(thoiDiem ASC, primary ID ASC)` hoặc thứ tự UI đã nhất quán; baseline migration phải được nhận diện bằng dữ liệu thật và không ghi sai rằng người dùng thực hiện chuyển trạng thái cũ tại mốc migration. Không tự dựng bản ghi lịch sử nếu DB thiếu.
- Không gộp vé và phiếu thành một timeline. `GET` không được tạo history hoặc cập nhật trạng thái. Nếu lịch sử nhiều, giới hạn/phân trang sau khi chốt response contract và có test; không trả không giới hạn nếu gây tải lớn.
- Runtime writes Customer đang được implement riêng: không sửa Customer cancellation hoặc thêm timeline Customer chỉ để demo history.

## 7. Integration tests bắt buộc (DB-backed, ít nhất hai tenant)

1. A có `booking:read` đọc đúng list/detail/history phiếu và vé của A; B không thấy của A; meta `totalItems` không lộ số B.
2. Bên A gọi trực tiếp booking/ticket/history ID của B => `404`; thiếu login => `401`; thiếu permission/role, `SUPER_ADMIN`, principal thiếu tenant => `403`.
3. Search từng loại mã phiếu, mã vé, tên khách, điện thoại; tương tự search mã thuộc B không tiết lộ bất kỳ record nào.
4. `status` của phiếu khác với status đơn giao dịch/từng vé: filter đúng cột; DTO chặn unknown status, sort field, date và page invalid.
5. `bookedFrom/To`, `departureFrom/To` đúng ranh giới cuối ngày/tháng, timezone và from > to; hỗ trợ vé book trước ngày khởi hành.
6. Booking nhiều vé chỉ count một phiếu, không duplicate; pagination stable với timestamp trùng, không mất row.
7. Hủy 1/3 => phiếu giữ status DB, `isPartiallyCancelled=true`, số lượng chính xác; hủy hết => `cancelled=3`, không hiển thị nhãn partial.
8. Hai timeline độc lập, trật tự cùng timestamp ổn định, baseline được giữ và không tạo giả. `GET` không làm tăng số rows lịch sử.
9. Đơn có vé + xe máy: `initialTicketAmount` từ `PhieuDatVe`, tổng đơn riêng, shipment summary đúng; hàng vẫn giữ trạng thái độc lập dù đơn đã `DA_HUY`.
10. Payment/refund với giao dịch `DANG_XU_LY`, `DANG_GUI`, `THANH_CONG`, nhiều lần thử và nhiều vé: không coi pending thành completed, không cộng trùng, không leak của B.
11. Không có shipment, payment, history => response hợp lệ, không 500. Bản ghi sai invariant cùng chuyến được phát hiện, không ngụy tạo chuyến đầu tiên.
12. Thực thi HTTP guards/controller thật + Prisma test DB dành riêng (không mock prisma để chứng minh tenant security). Transaction/test fixture cleanup cô lập, không truncate DB nghiệp vụ feature.

## 8. Quality gates, DoD và handoff

- Chạy targeted backend integration/unit relevant + lint/typecheck/build affected. `git diff --check`; review số queries và response payload PII.
- API contract được ghi vào spec này hoặc file contract dưới `docs/feature-07-pdv-ve-admin/spec/` nếu cần, **không đổi Master Spec trái quyết định**. Cập nhật app module imports nếu có module mới.
- No mutation, no public Admin route, no fake data, no Customer breakage, no schema migration thiếu lý do.
- Trước mọi DB test, kiểm tra `DATABASE_URL`/test DB riêng thuộc Docker Feature 07. Không dùng `vexgo` (original) hoặc volume original.
- Commit local Conventional Commits; handoff `handoff/PHASE_02_HANDOFF.md` liệt kê endpoints + mẫu contract, DB test setup, test counts thật, SHA và known limitations. Dừng phase khi không đạt gate; tự động chuyển Phase 03 chỉ khi đạt.

## 9. Contract đã triển khai

- Cả sáu endpoint giữ `data`; list và history trả `meta` theo `{page,pageSize,totalItems,totalPages}`. History mặc định `page=1&pageSize=100`, tối đa 100 hàng/trang, sắp xếp `thoiDiem ASC` rồi ID tăng dần.
- Tiền VND được trả bằng chuỗi decimal chính xác, ví dụ `"300000"`; API không cộng hoặc làm tròn tiền bằng floating-point. `initialTicketAmount` luôn lấy từ `PhieuDatVe.tongTienBanDau`; `transactionTotalAmount` được trả riêng.
- Booking list/detail trả `ticketCount`, các số vé ban đầu/hủy/còn hiệu lực, `isPartiallyCancelled` suy ra từ số vé thực tế và `tripIntegrity`. Các giá trị integrity là `CONSISTENT`, `MULTIPLE_TRIPS`, `NO_TICKETS`, `TRIP_UNAVAILABLE`; khi chuyến không thể khẳng định duy nhất, `trip` là `null`.
- Ticket list/detail cũng trả `tripIntegrity`; nếu chuyến không thuộc tenant thì `trip` và `seatNumber` là `null` ở detail. Không đọc tên tuyến/chuyến khác tenant.
- Booking detail trả `transactionStatus` độc lập với `status`, `transactionTotalAmount` độc lập tiền vé, danh sách payment attempts và ba nhóm refund `pending`, `succeeded`, `other`. Mỗi khoản có trạng thái/method/amount gốc; không cộng attempt. `allocation` là `TICKET` chỉ khi `veId` trỏ tới vé cùng booking, nếu không là `UNALLOCATED`.
- Shipment được đọc qua giao dịch đã tenant-scope, chỉ trả mã vận đơn/trạng thái/chuyến và tóm tắt tên hàng, loại hàng, số lượng. Không trả ảnh hoặc giá trị khai báo; trip không thuộc tenant bị ẩn bằng `tripId: null`.
- Search trim khoảng trắng và giới hạn 100 ký tự. Filter status của booking chỉ dùng bốn trạng thái trong `ADMIN_BOOKING_STATUSES`; filter ticket chỉ dùng `DA_DAT`/`HUY`. Booking sort là `bookedAt`, `departureTime`, `totalTicketAmount`; ticket sort là `bookedAt`, `departureTime`, `ticketPrice`; mọi sort có ID làm tie-breaker.
- Booking list dùng điều kiện tenant trên giao dịch ở cả count và trang; filter khởi hành dùng `EXISTS`, tránh nhân bản phiếu khi có nhiều vé. Tổng vé/trip được gom theo trang và không tải history/payment/shipment cho list row.
