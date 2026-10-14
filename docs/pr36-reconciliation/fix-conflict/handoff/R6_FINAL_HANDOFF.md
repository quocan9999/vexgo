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
