# R6 — Handoff cước hàng và điểm gửi/nhận

## Trạng thái

- Logic dùng chung và regression unit/UI đã triển khai.
- `R6-AC06` **PASS**: integration test MySQL được chạy lại thành công sau khi khôi phục dữ liệu bị xóa.
- Không sửa schema, migration hoặc cấu hình môi trường. Có sự cố ghi dữ liệu do integration-test cleanup trước đó; chi tiết và trạng thái phục hồi được ghi ở dưới. Không push.

## Quy tắc cước đã áp dụng

- Dùng `BangCuocGuiHang.mucCuoc` làm một khoản cố định cho mỗi loại hàng có tổng khối lượng trong bracket phù hợp; khối lượng của các kiện cùng loại được tính bằng khối lượng hiệu dụng × số lượng rồi cộng lại. Không nhân `mucCuoc` thêm lần nữa theo số lượng.
- Khối lượng quy đổi dùng công thức dài × rộng × cao / 5000, làm tròn một chữ số thập phân HALF_UP; loại xe máy/xe đạp dùng khối lượng nghiệp vụ hiện có, không áp dụng khối lượng thể tích.
- Bracket gồm cả cận dưới và cận trên; phải khớp đúng một mức. Không có mức hoặc có nhiều mức thì trả lỗi có kiểm soát, không fallback.
- Phụ phí dễ vỡ 20.000đ và hàng giá trị cao 50.000đ được tính mỗi loại một lần nếu có ít nhất một kiện tương ứng được đánh dấu.
- Booking kèm vé giữ giới hạn hiện hữu: hàng thường tối đa 40kg mỗi kiện; kích thước tối đa 150×80×80cm. Giới hạn được kiểm tra trước khi tra cước. Không áp dụng giới hạn này cho đơn gửi hàng riêng.

## Điểm gửi/nhận và API

- Resolver chỉ nhận điểm đang hoạt động, đúng vai trò, cùng tuyến và nhà xe với chuyến. Nếu client không gửi ID thì chỉ tự chọn khi có đúng một lựa chọn; nếu có nhiều lựa chọn, yêu cầu chọn rõ. Điểm gửi và nhận phải khác nhau.
- Không thêm endpoint báo giá. Web gọi endpoint danh mục/điểm hiện có, gửi `loaiHangHoaId`, `senderPointId` và `receiverPointId`; backend vẫn là nguồn giá duy nhất.
- `POST /api/v1/bookings`: luồng một chiều gửi danh sách cargo và snapshot trong transaction booking. `shippingFee` và `totalAmount` phản ánh giá backend.
- `POST /api/v1/shipments`: luồng gửi riêng dùng cùng resolver trong transaction tạo đơn, hàng hóa và chi tiết cước.
- DTO thêm `loaiHangHoaId` tùy chọn để tương thích client cũ; resolver chỉ chấp nhận ID active, hoặc tự phân loại khi kết quả là duy nhất.
- Luồng UI khứ hồi hiện không gửi cargo tới API booking. UI đã ghi rõ cước hàng chưa áp dụng/chưa tính vào đơn khứ hồi; không mở rộng persistence sang luồng này trong R6.

## Thay đổi theo file

- API: thêm `apps/api/src/cargo-pricing/cargo-pricing.service.ts` và module; tích hợp resolver vào `BookingsService` và `ShipmentsService`; DTO nhận ID danh mục chính xác.
- API tests: thêm unit tests cho bracket/aggregate/surcharge, loại và điểm mơ hồ/sai, giới hạn booking; cập nhật mocks booking/shipment; thêm fixture integration so sánh hai entry point và snapshot.
- Web: gửi ID loại hàng trong booking một chiều và shipment riêng; chọn rõ điểm tuyến; bỏ giá ước lượng cứng khỏi UI; hiển thị các khoản phụ phí đã chốt; cập nhật test flow một chiều.
- Không stage hoặc commit thay đổi người dùng có sẵn trong `README.md` và `docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md`.

## Kiểm tra

- API unit tests liên quan: **PASS**, 40 tests.
- API typecheck: **PASS**.
- API lint: **PASS**, không warning.
- Web typecheck: **PASS**.
- Web regression `one-way-booking-flow`, case gửi ID danh mục và điểm tuyến: **PASS** (1 case chạy; 15 case khác được skip theo filter).
- Web lint các file liên quan: **PASS**, 0 lỗi; còn 1 warning có sẵn `handleReloadUserInfo` không dùng trong `round-trip-booking.tsx`.
- `git diff --cached --check`: **PASS**, không có whitespace error.
- GitNexus `detect-changes --scope all` báo `critical` trên tập thay đổi tổng hợp 25 file, gồm cả README/tài liệu người dùng đã sửa. Impact theo UID cho `BookingsService.createBooking` và `ShipmentsService.createShipment` lần lượt là `LOW` tới controller trực tiếp; index vẫn đứng sau HEAD 4 commit. Cập nhật index bị treo và đã dừng, nên không xem kết quả stale là bảo đảm. Kiểm tra caller trong source xác nhận: booking đi từ `BookingsController` và Web `one-way-booking.tsx`; shipment đi từ `ShipmentsController` và Web `send-freight-page.tsx`. Không tìm thấy thư mục/mobile caller trong worktree.
- Trước commit cập nhật handoff này, `detect_changes(scope=staged)` hoàn tất với risk `LOW`, 1 file tài liệu, 0 symbol/process bị ảnh hưởng. Lệnh refresh index theo hook không có tiến triển sau khoảng 80 giây nên đã dừng; index repository vẫn stale.

## Integration test và khôi phục dữ liệu

- Lượt chạy integration ban đầu không qua: 13 test thất bại khi cleanup chạy trong lúc `tripId` chưa được khởi tạo. Một điều kiện Prisma có `tripId: undefined` đã làm bộ lọc quá rộng; kết quả đọc chỉ sau lượt lỗi cho thấy `ChiTietCuocGuiHang` và `LichSuTrangThaiPhieuGuiHang` trong `vexgo_pr36` đều có 0 dòng. Xóa `HangHoa` tiếp theo bị chặn bởi khóa ngoại; khi đó có 24 phiếu gửi, 42 hàng hóa và 60 ảnh hàng hóa.
- Test cleanup đã được sửa để chỉ xóa shipment khi có `tripId`, đồng thời xóa ảnh trước hàng hóa.
- Không tìm thấy dump phù hợp. Dữ liệu chính xác được khôi phục từ binary log của chính MySQL `vexgo_pr36`: binlog dùng `ROW`/`FULL`, hai event xóa cuối tại `binlog.000003` lưu đầy đủ row image. Khôi phục trong một transaction 36 dòng `ChiTietCuocGuiHang` và 60 dòng `LichSuTrangThaiPhieuGuiHang`, không tắt kiểm tra khóa ngoại và không lấy dữ liệu từ database khác.
- Sau khôi phục, xác minh đủ 36/60 dòng và không có orphan theo phiếu gửi, bảng cước/loại hàng hoặc tài khoản. Các bảng không thuộc phạm vi giữ nguyên số lượng: `PhieuGuiHang=24`, `HangHoa=42`, `HinhAnhHangHoa=60`.
- Chạy lại `npm --prefix apps/api run test -- test/integration/bookings/booking-status-history.spec.ts`: **PASS**, 13/13 tests. Log có thông báo lỗi được tiêm có chủ đích trong test rollback; Vitest hoàn tất exit code 0. Sau test, hai bảng vẫn đủ 36/60 dòng, các kiểm tra orphan đều 0 và số lượng ba bảng liên quan không đổi.
- Tệp binlog/giải mã/SQL khôi phục tạm trong Temp đã được xóa sau khi xác minh. Integration test đã dọn fixture do chính test tạo; số hàng các bảng dữ liệu hiện hữu được đối chiếu trước/sau và không đổi.

## Postman smoke checklist

1. `GET /api/v1/shipments/categories`; chọn `categoryId` đang hoạt động.
2. `GET /api/v1/shipments/trips/{tripId}/route-points`; chọn một điểm gửi và một điểm nhận khác nhau, đúng vai trò.
3. Gửi `POST /api/v1/shipments` với `tripId`, hai point ID, thông tin sender/receiver, và items có cùng `loaiHangHoaId`, quantity, weight; bật `isFragile`/`isValuable` theo nhu cầu. Kiểm tra `pricing.baseFee`, `serviceFee`, `totalFee`.
4. Tạo hold bằng `POST /api/v1/seat-holds`, sau đó gửi `POST /api/v1/bookings` với hold token, cargo items cùng danh mục/khối lượng và hai point ID. So sánh `shippingFee` với `pricing.totalFee` của đơn riêng.
5. Trong DB test sau khi khôi phục, đối chiếu `PhieuGuiHang.cuocChinh`, `phiDichVu`, `tongPhi` và `ChiTietCuocGuiHang` cho cả hai luồng.
6. Thử ID điểm sai tuyến, hai điểm trùng, loại hàng inactive, thiếu bracket và bracket overlap; kỳ vọng lỗi 4xx có mã cụ thể, không tạo đơn/cước một phần.

## Còn tồn tại / ngoài R6

- Luồng cargo khứ hồi chưa được lưu vào booking; cần quyết định/phạm vi riêng trước khi tích hợp.
- Web chưa có endpoint quote; người dùng chỉ nhận giá authoritative khi submit, và lỗi bảng cước được hiển thị từ API.
- Những vấn đề capacity/locking R7, persistence/order history R8, payment và các findings SePay không thuộc R6, không được xử lý ở đây.

## Bổ sung sau review P1 — xác thực kích thước hàng hóa

- Nguyên nhân: DTO tạo shipment trước đây cho phép chiều âm, bằng 0 hoặc chỉ nhập một phần; pricing cũng có thể bỏ qua khối lượng thể tích khi kích thước không đầy đủ. Điều này có thể làm hàng sai kích thước được tính vào bracket thấp hơn.
- Quy tắc chung: được bỏ trống cả ba chiều (bao gồm trường hợp client gửi cả ba giá trị `null`); nếu nhập kích thước thì phải nhập đủ dài, rộng, cao và mỗi chiều phải là số hữu hạn lớn hơn 0. Không thêm giới hạn kích thước mới cho đơn gửi riêng; giới hạn tối đa hiện hữu của booking vẫn giữ nguyên.
- Dùng chung `cargo-dimensions.validation.ts` ở DTO tạo shipment, `CargoPricingService` và `ShipmentPersistenceService`. Đầu vào không hợp lệ bị từ chối trước khi đọc bảng cước hoặc ghi dữ liệu; lỗi kích thước chéo ở booking trả `CARGO_DIMENSIONS_INVALID`, lỗi trường đơn giản giữ `VALIDATION_ERROR` hiện có, còn shipment trả lỗi validation 400 có thông báo tiếng Việt.
- Không thay đổi công thức cước, payment, capacity, schema hoặc migration.
- Regression: unit tests DTO/pricing/persistence phủ kích thước âm, 0, thiếu chiều, sai kiểu, NaN/Infinity; API/MySQL integration xác minh shipment và booking bị từ chối, không tạo dữ liệu cargo và hold ghế không bị consume.
- Kết quả xác minh sau sửa: 6 unit-test files, 62 tests PASS; `booking-status-history.spec.ts` MySQL integration 24/24 PASS; API typecheck PASS; oxlint target PASS; `git diff --check` PASS.
- Files bổ sung: `apps/api/src/cargo-pricing/cargo-dimensions.validation.ts`, `apps/api/src/cargo-pricing/cargo-pricing.service.ts`, `apps/api/src/shipments/dto/create-shipment.dto.ts`, `apps/api/src/shipments/shipment-persistence.service.ts`, cùng regression tests tại `apps/api/test/unit/cargo-pricing/`, `apps/api/test/unit/shipments/` và `apps/api/test/integration/bookings/booking-status-history.spec.ts`.

## Bổ sung sau review P1 — xe máy trong booking kèm vé

- Finding: Customer Web cộng khối lượng xe máy/xe đạp vào giới hạn 40kg của hành lý thường, khiến `OneWayBooking` từ chối submit trước khi gọi `POST /api/v1/bookings`.
- Sửa trong Web: tính riêng khối lượng hiệu dụng của hành lý không phải xe máy/xe đạp để áp dụng giới hạn 40kg. Tổng khối lượng cargo, payload từng kiện, điểm gửi/nhận, cước và flow booking vẫn giữ nguyên; không sửa API, capacity hay payment.
- Regression UI thực: dùng `LuggageStep` thật trong component test; xác minh xe máy 100kg, xe đạp 15kg và xe máy kèm 10kg vali gửi booking; vali thường 41kg vẫn bị chặn; đổi loại hàng xóa danh mục không tương thích; lỗi `CARGO_CAPACITY_EXCEEDED`/`CARGO_RATE_NOT_FOUND` từ API vẫn hiển thị và không điều hướng thành công.
- Kiểm tra: Web flow spec 23/23 PASS; Web typecheck PASS; ESLint hai file Web liên quan PASS; `git diff --check` PASS. Không chạy browser smoke trực tiếp và không sửa CSS/layout; các breakpoint hiện tại được giữ nguyên.
- Smoke trình duyệt: mở đặt vé một chiều có nhận hàng, bật hành lý, thêm xe máy (100kg) cùng danh mục phù hợp, điền điểm gửi/nhận và thông tin hành khách rồi submit. Xác minh request booking được gửi với cargo xe máy; thử thêm vali 10kg vẫn gửi được; tăng riêng hàng thường lên 41kg thì bị cảnh báo giới hạn và không gửi booking. Backend vẫn quyết định giá/sức chứa và lỗi API vẫn được hiển thị.
- Không xử lý finding P2 về giới hạn theo từng kiện; đây là scope riêng. Không sửa Admin, Mobile, database, migration, cấu hình hoặc logic thanh toán.
