# CONTRACT FREEZE — Feature 10: Quản lý khuyến mãi theo nhà xe

Ngày rà soát: 2026-10-16
Worktree: E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10
Branch: feature/tenant-promotions
Baseline: origin/develop / HEAD 0a2888f9e836fc40c6b5f057cce517802dd7d6fb
Trạng thái: chốt contract Phase 00; chưa triển khai business code.

## 1. Bằng chứng baseline và hiện trạng

HEAD worktree đúng origin/develop và trùng SHA baseline trong MASTER_SPEC; chưa có commit Feature 10. Thư mục docs Phase 00 và handoff ban đầu được đọc. Không có .codegraph/. GitNexus index riêng được tạo trong worktree để phân tích code, không sửa index repo gốc.

| Khu vực | Hiện có | Tái sử dụng | Mở rộng theo Feature 10 |
|---|---|---|---|
| Database | KhuyenMai có tenant/code/discount/date/status; PhieuDatVe.khuyenMaiId đã có; PhieuGuiHang.khuyenMaiId là quan hệ legacy; giao dịch có khachHangId nullable và snapshot số điện thoại | Composite unique (nhaXeId, maKhuyenMai); quan hệ FK hiện có; Ve.giaThucTe là giá thực thu dùng trong báo giá hủy vé | Quota, ledger sử dụng, snapshot giảm cấp booking; không dùng PhieuGuiHang.khuyenMaiId |
| API | PromotionsService.validatePromotion; POST /api/v1/promotions/validate; POST /api/v1/bookings/quote và POST /api/v1/bookings | Prefix /api/v1, DTO/ValidationPipe, ApiResponseInterceptor, ApiExceptionFilter, booking transaction và price lookup | Tenant promotion endpoints/RBAC; quote và create booking fail-closed, identity, quota và response fields |
| Admin | Permission catalog tenant/platform, RequirePermissions, requireTenantPrincipal, API access helper và shared CRUD components | Admin design tokens, page/table/form/detail/status/pagination patterns | List/create/detail/toggle; không edit/delete; quyền theo tenant |
| Customer | Booking một chiều gửi POST /bookings; payment đọc discountAmount nếu server trả về | Booking/payment/ticket data services và server endpoint quote | Nhập mã, gọi quote, hiển thị lỗi/giảm/total; code và giảm xuất hiện trong payment, invoice, ticket detail; phiếu gửi gắn booking chỉ tham chiếu |
| Tests/seed | Promotion unit test chỉ bao phủ service calculator/scope; seed tạo 15 promo legacy; verifier cố định status/count và giả định không có coupon trên booking/shipment | Seed/verifier vẫn kiểm tra quan hệ booking, thanh toán, giá vé và phí gửi | Test DB thật cho transaction/concurrency/identity/tenant; cập nhật seed/verifier để hợp quota/status mới |

### Caller và rủi ro

- GitNexus index trên worktree ghi PromotionsService.validatePromotion: HIGH, exact, 5 symbol bị ảnh hưởng; direct callers là BookingsService.getBookingQuote và PromotionsController.validatePromotion; flow liên quan createBooking.
- BookingsService.getBookingQuote: HIGH, exact, 2 caller trực tiếp, 1 caller gián tiếp, 1 process createBooking; module ảnh hưởng gồm Bookings, Bus-companies và Shipments.
- BookingsService.createBooking: LOW upstream, controller là caller; method thuộc critical booking transaction và có nhiều execution flow downstream.
- isPermissionAllowedForRole: HIGH, exact, 12 symbol, 3 process (replace/reset tenant role và replace default role). Sẽ chỉ thêm tenant permission keys và permission tests; không đổi phạm vi quyền khác.
- Index cảnh báo 733 property access cross-language chưa liên kết và process enumeration bị giới hạn. Không coi kết quả rỗng là không có caller. Literal search /promotions/validate không tìm thấy client gọi trong apps; promotionCode hiện chỉ thấy ở API DTO/service/controller. apps chỉ có api, admin, web, không có app mobile trong repo. Không có client first-party nào được tìm thấy cho public validate; khả năng client bên ngoài repo chưa xác minh.
- ApiResponseInterceptor bọc response thành {data} nếu controller chưa trả envelope; danh sách phân trang dùng {data, meta}. ApiExceptionFilter chuẩn hóa lỗi thành {statusCode,error,message,details?} và giữ mã lỗi business dạng chữ hoa.

## 2. Schema và dữ liệu

Migration mới, forward-only; không sửa migration đã có. Tên Prisma giữ convention tiếng Việt hiện hữu.

- KhuyenMai.maKhuyenMai: String @db.VarChar(50) không null, unique theo (nhaXeId, maKhuyenMai); trùng mã giữa hai nhà xe được phép.
- KhuyenMai.denNgay: DateTime @db.Date không null. Tạo mới luôn có cả tuNgay và denNgay, tuNgay <= denNgay.
- Thêm soLuotToiDa Int bắt buộc, nguyên dương; soLuotDaSuDung Int @default(0); invariant 0 <= soLuotDaSuDung <= soLuotToiDa.
- Thêm SuDungKhuyenMai với PK số nguyên, khuyenMaiId, phieuDatVeId unique, khachHangId?, soDienThoaiChuanHoa?, soTienGiam Decimal(18,2), createdAt. Unique (khuyenMaiId, soDienThoaiChuanHoa) và (khuyenMaiId, khachHangId); quan hệ booking/promotion/customer dùng onDelete: Restrict. MySQL cho nhiều NULL trong unique, dùng được cho signed-in chưa có số điện thoại xác minh.
- Thêm PhieuDatVe.soTienGiamKhuyenMai Decimal(18,2) NOT NULL DEFAULT 0. Ledger và snapshot booking phải bằng nhau; không coupon thì bằng 0.
- Giảm ở cấp booking một lần trên tổng giá vé gốc; phí hàng và phí dịch vụ gửi không nằm trong cơ sở tính giảm. PhieuDatVe.tongTienBanDau vẫn là tổng giá vé gốc.
- Phân bổ discount của booking lên vé theo tỷ lệ giá vé gốc, dùng thứ tự gheChuyenXeId tăng dần và gán phần dư làm tròn cho vé cuối để tổng khớp chính xác. Lưu giá vé ròng sau giảm ở Ve.giaThucTe, là giá mà quy tắc hủy/refund hiện dùng; không hoàn quá số tiền đã thu. Dùng Prisma.Decimal cho phép tính và làm tròn HALF_UP tới đơn vị VND nguyên.
- Không thêm ledger cho shipment. Giữ PhieuGuiHang.khuyenMaiId legacy nhưng luôn null cho luồng này. Shipment gắn booking được đọc mã tham chiếu từ booking; shipment độc lập không có mã.

### Chính sách DB và migration

Chỉ vexgo_promotion và vexgo_promotion_shadow là DB phát triển có thể reset/reseed. Trước mọi thao tác phá hủy phải xác minh lại cwd, branch, DATABASE_URL, MIGRATION_URL, SHADOW_DATABASE_URL, host/port/schema và connection thực tế. Không sửa/xóa dữ liệu ngoài hai DB này; không dừng/xóa container hoặc volume dùng chung.

Audit Phase 00 chỉ đọc metadata. MySQL dùng chung là container hiện có vexgo-mysql-1 với volume vexgo_mysql_data, port 127.0.0.1:3306. Hai schema Feature 10 hiện không tồn tại; schemas vexgo và vexgo_shadow tồn tại và không bị chạm. Hai account URL vexgo_promotion_app / vexgo_promotion_migrator cũng chưa thấy trong mysql.user. prisma migrate status chưa xác minh được do Prisma schema engine báo Unknown authentication plugin sha256_password. Phase 01 phải tạo/chỉ cấp quyền cho hai schema Feature 10 và hai user trên; app user chỉ DML trên app DB, migrator chỉ schema privileges trên app/shadow DB. Không tạo MySQL container/volume thứ hai.

Nếu migration gặp dữ liệu legacy trong hai DB feature, reset/reseed riêng hai schema đó được phép sau preflight; ưu tiên không reset nếu DB mới/đang trống. Không backfill quota giả. Không đổi migration đã commit.

## 3. API contract

Các URL dưới đây được thêm prefix /api/v1. Success resource dùng {data: ...}; list dùng {data: [...], meta: {page, pageSize, totalItems, totalPages}}. Timestamp có ISO 8601; ngày nghiệp vụ dùng YYYY-MM-DD. Tiền trong DTO/response dùng chuỗi decimal để không làm mất chính xác.

| Method/path | Auth/quyền | Request và response |
|---|---|---|
| GET /promotions | Tenant promotion:read | Query page, pageSize, search, status, fromDate, toDate, sortBy, sortDirection; trả DTO list + meta, scope từ principal |
| GET /promotions/:id | Tenant promotion:read | Chi tiết trong tenant hiện tại; ngoài tenant trả 404 |
| POST /promotions | Tenant promotion:create | Body: name, code, discountType (PHAN_TRAM/SO_TIEN), discountValue decimal string, maxDiscount? decimal string (bắt buộc >0 với phần trăm), minimumTicketAmount? decimal string, startsOn, endsOn, usageLimit integer >0. Không nhận nhaXeId; trạng thái ban đầu HOAT_DONG; phạm vi DAT_VE, cách áp dụng NHAP_MA do server đặt. Trả {data: promotion} |
| PATCH /promotions/:id/status | Tenant promotion:update | Body chỉ {status: HOAT_DONG hoặc TAM_NGUNG}; không sửa cấu hình và không xóa. Bật lại không khôi phục quota/ngày đã mất |
| POST /bookings/quote | Public + optional auth | Body giữ tripId, seatIds, thêm promotionCode?, contactPhone? cho guest. Tenant và giá lấy từ chuyến/giá DB. Trả {data: {originalTotal, discountAmount, finalTotal, appliedPromotionCode, currency: VND}}; quote không giữ/trừ quota |
| POST /bookings | Optional auth | Giữ payload hiện có, thêm/giữ promotionCode?. Trong transaction tạo đơn CHO_THANH_TOAN, ghi ledger, cập nhật quota và snapshot; trả {data: booking}. Mã được yêu cầu nhưng không dùng được phải lỗi, không tạo booking nguyên giá |
| POST /promotions/validate legacy | Public | Không có first-party client caller trong source hiện tại và body đang nhận nhaXeId, seatCount, totalAmount không đáng tin. Giữ đường dẫn để báo chuyển đổi; trả HTTP 410 PROMOTION_VALIDATE_DEPRECATED, hướng khách sang /bookings/quote. Không dùng body legacy để xác định tenant/giá/discount |

DTO promotion list/detail không trả Prisma model thẳng; expose các tên API tiếng Anh ở bảng trên, status HOAT_DONG/TAM_NGUNG, quota và số lượt đã dùng. SO_TIEN không dùng maxDiscount; mức giảm luôn bị chặn bởi tổng giá vé. minimumTicketAmount tùy chọn và so với tổng giá vé trước giảm, không gồm phí hàng.

### Lỗi ổn định

- 400 VALIDATION_ERROR: DTO sai; details có {field,message}.
- 401 UNAUTHORIZED; 403 FORBIDDEN.
- 404 PROMOTION_NOT_FOUND: ID không tồn tại hoặc không thuộc tenant.
- 409 PROMOTION_CODE_EXISTS: code trùng trong một tenant.
- 409 PROMOTION_CODE_INVALID, PROMOTION_UNAVAILABLE, PROMOTION_MINIMUM_NOT_MET, PROMOTION_ALREADY_USED, PROMOTION_QUOTA_EXHAUSTED, SEAT_UNAVAILABLE: lỗi nghiệp vụ; có statusCode/error/message.
- 410 PROMOTION_VALIDATE_DEPRECATED: API legacy được giữ trong thời gian chuyển đổi.
- Quote/booking có code invalid, sai tenant, hết ngày, tạm ngưng, hết quota hoặc khách đã dùng đều fail-closed; không fallback giá gốc.

## 4. Business rules đóng băng

1. Tenant lấy từ trip lúc checkout và principal lúc Admin; không tin tenant ID từ body/query. Mọi list/detail/query Admin giới hạn tenant.
2. Hai loại: phần trăm (max discount bắt buộc dương) và số tiền cố định. Giảm không âm, không vượt tổng giá vé. Min order nullable.
3. Thời gian có hiệu lực từ đầu ngày startsOn đến hết ngày endsOn theo Asia/Ho_Chi_Minh; runtime không dựa vào status giả lập SAP_DIEN_RA/HET_HAN.
4. Guest identity là số điện thoại contact sau chuẩn hóa theo helper hiện có (local VN 0..., 84... chuyển về 0...). Đăng nhập: kiểm tra OR giữa khachHangId và số điện thoại tài khoản đã xác minh lấy từ DB. Không dùng contact.phone để quyết định eligibility của tài khoản đăng nhập. Ledger lưu phone chuẩn hóa của guest hoặc verified phone; với tài khoản chưa xác minh phone có thể null và customerId vẫn bảo vệ.
5. Một booking nhiều vé dùng một code, giảm một lần trên tổng giá vé. Quote không tiêu thụ. Chỉ consume sau khi transaction tạo booking CHO_THANH_TOAN thành công.
6. Quota row được khóa/claim nguyên tử trong transaction booking; unique ledger là hàng rào race thứ hai. Nếu transaction rollback thì không còn booking/ledger/quota update. Mã hết lượt hoặc đã dùng trả 409.
7. Payment failure, expiry, cancel và refund không trả quota. Không thêm quota restoration trong PaymentsService/webhook.
8. Shipment phí đầy đủ; nếu cùng đơn booking thì chỉ render mã tham chiếu booking và ghi rõ giảm chỉ áp dụng tiền vé. Không giảm shipment độc lập.
9. NHA_XE_ADMIN mặc định promotion:read/create/update. Role tenant khác chỉ có quyền khi được gán qua tenant override; không gán mặc định cho NHAN_VIEN_KINH_DOANH. SUPER_ADMIN platform không tự có tenant permission.
10. Chỉ booking một chiều trong MVP; không coupon catalog/auto-apply, không stack, không sửa/xóa promotion.

## 5. Kiểm thử cần có khi triển khai

- Guest dùng code rồi đăng ký bằng cùng phone vẫn bị chặn.
- Signed-in đổi contact phone không bypass customerId/verified-phone; phone không verified không dùng làm identity.
- Hai vé trong một booking trừ một quota và một discount tổng; refund từng vé không vượt net ticket price.
- Ngày cuối còn hợp lệ tới hết ngày tại HCMC; ngày kế tiếp fail.
- Quote không đổi quota; rollback không ghi ledger; booking commit ghi đúng một ledger và giảm quota một lần.
- Hai request cạnh tranh lượt cuối: đúng một thành công, request kia nhận 409; chạy trên MySQL thật.
- Tenant A không đọc/áp code tenant B; trùng code giữa hai tenant hợp lệ, trùng trong cùng tenant không hợp lệ.
- Payment fail/expiry/cancel/refund không hoàn lượt.
- Cargo booking chỉ giảm vé; shipment độc lập không có promo.

## 6. Assumptions đã ghi nhận

- Public promotions/validate không có first-party consumer trong source repo; API bên ngoài repo chưa xác minh. Chọn trả 410 để tránh tiếp tục tin tenant/price/count do client gửi; customer dùng server-side booking quote.
- Với user đăng nhập chưa có verified phone, identity key tin cậy là khachHangId; phone ledger có thể null. Không tạo OTP guest.
- Mã/tenant/list response DTO dùng API field tiếng Anh; model và migration field giữ tiếng Việt theo schema.

### Date-range list filter

`fromDate` và `toDate` là ngày `YYYY-MM-DD` tùy chọn. API lọc các khuyến mãi có thời hạn giao với khoảng đã chọn (bao gồm hai đầu): `denNgay >= fromDate` và `tuNgay <= toDate`. Có thể truyền một đầu khoảng. Ngày không hợp lệ hoặc `fromDate > toDate` trả `400 VALIDATION_ERROR`. Bộ lọc áp dụng cùng tenant/search/status trước count và pagination.
