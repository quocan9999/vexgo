# Bàn giao luồng gửi hàng độc lập

Ngày hoàn thành: 03-11-2026.

## 1. Kết quả nghiệp vụ

- Khách chọn nơi gửi, nơi nhận và ngày gửi để xem **nhà xe** có chuyến mở nhận hàng trên tuyến/ngày đó; khách không chọn chuyến.
- Mỗi nhà xe hiển thị **“Cước từ”** là mức thấp nhất còn hiệu lực trên đúng tuyến; danh sách ưu tiên giá thấp đến cao. Đây chỉ là giá tham khảo, cước chính xác vẫn được báo sau khi chọn bưu cục và khai hàng.
- Sau khi chọn nhà xe, hệ thống tải điểm gửi và điểm nhận đang hoạt động của đúng nhà xe/tuyến.
- Vận đơn standalone được tạo ở trạng thái `MOI_TAO`, hiển thị **Chờ mang hàng đến gửi**, có hạn mang hàng đến 48 giờ và chưa gắn chuyến.
- Nhà xe cân đo thực tế, xác nhận cước, thu tiền và phân chuyến bằng các thao tác riêng. Tiếp nhận hàng không tự xác nhận thanh toán.
- Chỉ chuyến đúng tenant, đúng tuyến, chưa khởi hành, đang nhận hàng và đủ sức chứa mới được phân.
- Hàng gửi kèm vé tiếp tục gắn chuyến của vé; API legacy còn hoạt động.
- Cước dùng `Decimal`, giữ khối lượng/kích thước khai báo và thực tế, không làm tròn lên 0,5 kg. Khoảng cân được chọn duy nhất theo bậc cấu hình.
- Chuyển khoản online có thời hạn attempt 10 phút, độc lập với hạn mang hàng 48 giờ. Tiền đến muộn/trùng hoặc tiền dư được ghi nhận để đối soát, không quyết toán lại đơn.
- Đơn đã thu tiền nhưng hết hạn/hủy được giữ nguyên ledger và mở hồ sơ xử lý thủ công; hệ thống không tự hoàn tiền.

## 2. Trang và khu vực đã sửa

### Customer Web

- `/shipments/new` và `/send-freight`: tìm nhà xe theo tuyến/ngày, tải bưu cục theo nhà xe, báo cước thật, idempotency, chính sách 48 giờ và không tự hoàn.
- `/account/shipments`: chấp nhận vận đơn chưa phân chuyến, nhãn trạng thái mới và hiển thị hạn gửi.
- `/booking/[bookingId]/payment`, `/payment`: dữ liệu vận đơn không còn bắt buộc có chuyến; hiển thị chính sách xử lý tiền.

### Admin Web

- `/shipments`: thêm tuyến/nhà xe/chuyến nullable vào danh sách và chi tiết.
- Chi tiết vận đơn có các thao tác dùng component hiện hữu của shadcn/ui/Admin design system: cân đo và tiếp nhận, thu tiền mặt, phân/chuyển chuyến, xử lý hồ sơ tiền.
- Hiển thị cước dự tính/cước chốt, đã thu/còn phải thu, số đo khai báo/thực tế, lịch sử cước, lịch sử phân chuyến và hồ sơ tiền.
- Tenant Admin chỉ thao tác dữ liệu nhà xe của mình; Super Admin không được dùng để vượt tenant operation.

### Backend

- `shipments`: options, route points, quote, create idempotent, accept/reweigh, available trips, assignment, cash collection, money-case resolution.
- `payments`: tách TTL thanh toán và deadline mang hàng, xử lý tiền đến muộn/trùng/dư và giữ ledger khi hủy.
- `customers` và `admin-bookings`: đọc an toàn vận đơn chưa có chuyến.
- Mọi ghi nhiều bảng quan trọng chạy trong transaction; controller chỉ chuyển request sang service.

## 3. API contract mới

- `GET /api/v1/shipments/options?from&to&sendDate=DD-MM-YYYY&page&pageSize`; mỗi lựa chọn có `minimumEstimatedFee: number | null`.
- `GET /api/v1/shipments/routes/:routeId/route-points`
- `POST /api/v1/shipments/quotes`
- `POST /api/v1/shipments` với `routeId`, `sendDate`, điểm gửi/nhận, liên hệ và hàng hóa; standalone bắt buộc header `Idempotency-Key`.
- `POST /api/v1/shipments/:id/accept`
- `GET /api/v1/shipments/:id/available-trips`
- `PATCH /api/v1/shipments/:id/assignment`
- `POST /api/v1/shipments/:id/collect-payment`
- `POST /api/v1/shipments/:id/money-cases/:caseId/resolve`

Response tiếp tục dùng envelope `{ data }` hoặc `{ data, meta }`. Ngày không có giờ của API mới dùng `DD-MM-YYYY`; timestamp dùng ISO 8601.

## 4. Database và migration

Migration: `prisma/migrations/20261103000000_standalone_shipment_rework/migration.sql`.

- `PhieuGuiHang`: cho phép `chuyenXeId` nullable; thêm tuyến, hạn mang hàng, ngày dự kiến, cước dự tính và tài khoản/thời điểm xác nhận cước.
- `HangHoa`: thêm riêng số cân/kích thước khai báo và thực tế; giữ field hiệu lực cũ để tương thích.
- `ThanhToan`: thêm tài khoản xác nhận tại quầy.
- Thêm `LichSuDieuChinhCuocGuiHang`, `LichSuPhanChuyenGuiHang`, `XuLyTienGuiHang`, `YeuCauTaoPhieuGuiHang`.
- Backfill tuyến từ chuyến cho dữ liệu cũ; không đoán deadline hay số cân thực tế cho lịch sử.
- Migration local đã chạy thành công, không reset và không xóa dữ liệu cũ. Backup trước migration nằm ngoài repository tại đường dẫn được ghi trong `/tmp/vexgo-shipment-backup-path` của máy phát triển.

## 5. Kiểm chứng đã chạy

- API unit: **82 files, 1.022 tests pass**.
- MySQL integration cô lập cho shipment/status/payment webhook: **3 files, 89 tests pass**; database test được tạo, migrate và dọn sau khi chạy.
- Customer Web: **144 Node tests + 136 Vitest tests pass**.
- Admin Web: **64 files, 491 tests pass**.
- Typecheck: API, Customer và Admin đều pass.
- Production build: API, Customer và Admin đều pass.
- Prisma schema validation và Prisma Client generation đều pass.
- Admin ESLint pass. API lint không có lỗi trong phần shipment; repository còn một warning cũ ở `bookings.service.ts`. Scoped Customer lint không có lỗi; còn hai warning `<img>` QR cũ. Full Customer lint vẫn có debt ngoài phạm vi feature.
- Visual QA đã kiểm tra `/shipments/new`, `/shipments` và chi tiết vận đơn ở desktop; Customer và Admin đều được kiểm tra lại tại viewport **375×667**. Admin dùng đúng component/design system hiện hữu.

## 6. Giới hạn còn lại

- Không phát sinh giao dịch thật với cổng thanh toán bên ngoài; webhook/provider được kiểm tra bằng unit và integration fixture.
- Dữ liệu legacy có thể không có số đo thực tế, deadline hoặc cước chốt vì migration chủ động không suy đoán lịch sử.
- Full API suite chứa một số integration suite yêu cầu database/credential chuyên biệt riêng; phạm vi shipment/payment được chạy bằng harness MySQL cô lập và đã pass.
