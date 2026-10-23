# F12 — Handoff Phase 00: dữ liệu doanh thu & sự kiện thanh toán

- **Phase:** `00`
- **Status:** `DONE`
- **Repo root (không worktree):** `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo`
- **Branch / HEAD / origin/develop SHA:** `feature/tenant-revenue-reporting` / `ca578c8f9887e94ea54fb959498412cbb066ffc7` / `bc863de26fe9787f91e2078475f97c16d2f6423f`
- **Implementation commit:** `ca578c8 feat(f12): ghi nhận sự kiện quyết toán doanh thu`
- **Files / Prisma changes:** thêm `ThanhToan.thoiDiemHoanTat`, `laQuyetToanHopLe` và index; thêm migration `20261022170000_add_payment_completion_and_revenue_settlement`; cập nhật writer settlement/refund, unit tests và payment README. Đã đưa hồ sơ F12 từ ZIP vào `docs/features/tenant-revenue-reporting/`.

## Nguồn tiền và điều kiện hợp lệ

| Event | Writer path | DB field | Ý nghĩa | Eligibility | Ngày nghiệp vụ |
|---|---|---|---|---|---|
| Sale thành công | `PaymentsService.confirmPaymentSuccess` qua settlement boundary/lock hiện có | `ThanhToan.loaiGiaoDich`, `trangThai`, `laQuyetToanHopLe`, `thoiDiemHoanTat` | Lần đầu settlement booking hoặc shipment thực; marker được bật cuối cùng trong cùng transaction | Chỉ `THANH_TOAN + THANH_CONG + laQuyetToanHopLe=true`; amount khớp payment/provider. Replay không ghi thêm. | SePay dùng `transactionDate` đã xác minh, parse UTC+7; provider khác dùng thời điểm server nhận xác nhận thành công. |
| Tiền provider nhận nhưng không tạo sale hợp lệ | Cùng SePay handler/settlement boundary | Payment gốc giữ marker false; lần chuyển thêm được ghi `CAN_DOI_SOAT`, marker false | Tiền đến sau hủy, settlement trùng, hoặc transfer thêm cần đối soát; trạng thái provider thành công không tự chứng minh sale | Không tính vào doanh thu sale; `CAN_DOI_SOAT` luôn bị loại. | Event SePay đã xác minh được lưu; không biến event này thành settlement hợp lệ. |
| Refund thành công | `TicketsService.cancelTicket` tạo yêu cầu → `RefundProcessorService.processRefund` gọi provider → cập nhật sau `SUCCEEDED` | `ThanhToan.loaiGiaoDich='HOAN_TIEN'`, `veId`, `trangThai`, `thoiDiemHoanTat` | `thoiGian` là lúc yêu cầu; `thoiDiemHoanTat` là lúc provider xác nhận thành công; writer hiện gắn refund vào vé | Chỉ `HOAN_TIEN + THANH_CONG` có completion time; pending/failed không trừ. | Thời điểm server nhận xác nhận `SUCCEEDED`; ghi cùng update thành công, không dùng thời điểm yêu cầu. |
| Booking 0đ đã quyết toán nội bộ | Nhánh 0đ của `BookingsService` và status-history records | Lịch sử trạng thái booking/ticket có `thoiDiem`; không có `ThanhToan` | Chỉ có thể tăng số lượng phát hành nếu dựa trên event lịch sử đủ tin cậy | Không tạo tiền hoặc `successfulPayments` giả. | Thời điểm chuyển trạng thái nội bộ; cần xác minh mapping cụ thể khi Phase 01 xây counters. |

### Phân bổ tiền và giới hạn nguồn

- Giá vé thực thu lấy từ tổng `Ve.giaThucTe` đã phân bổ discount; phí gửi lấy `PhieuGuiHang.tongPhi`. Với đơn mixed, payment được phân bổ theo hai snapshot của cùng `DonGiaoDich`; `DonGiaoDich.tongTien` chỉ dùng đối chiếu và không được cộng thêm lần nữa. Gửi hàng kèm vé được nhận diện bằng `DonGiaoDich.phieuDatVe`; không có booking là gửi độc lập.
- Discount đã nằm trong giá vé thực thu; không trừ `PhieuDatVe.soTienGiamKhuyenMai` thêm lần nữa. Phí hủy được giữ lại thể hiện ở số tiền refund nhỏ hơn số tiền gốc; không tạo dòng doanh thu phí.
- Refund writer hiện có chỉ cho hủy vé và có `veId`; chưa có writer hoàn tiền gửi hàng. Không âm thầm gán refund không định danh sang vé. Hiện không thấy writer thu tiền mặt trực tiếp. Nếu scope writer thay đổi, cần audit lại trước aggregation.
- Migration không backfill lịch sử thiếu chứng cứ. Record cũ mặc định `thoiDiemHoanTat=NULL`, `laQuyetToanHopLe=false`; chúng bị loại fail-closed. Hai DB F12 vừa tạo đang rỗng nên không có record lịch sử cần phân loại.
- Chưa triển khai aggregation/báo cáo trong Phase 00. Precision và invariant tổng snapshot đã được kiểm tra ở writer hiện hữu; unit tests báo cáo/Decimal phân bổ sẽ thuộc Phase 01 nếu có logic mới.

## DB, kiểm tra và giới hạn

- **Database target:** `.env` đã được xác nhận trỏ `vexgo_feature12`; `SHADOW_DATABASE_URL` trỏ `vexgo_feature12_shadow`; không ghi secret vào handoff. Hai DB chưa tồn tại lúc bắt đầu, được tạo riêng trên MySQL shared `127.0.0.1:3306` sau khi xác minh URL; không reset/seed DB khác.
- Prisma migration deploy đã áp dụng toàn bộ 33 migration trên `vexgo_feature12`; `prisma migrate status` xác nhận schema up to date. Không seed dữ liệu demo. Env local được backup ngoài repository trước khi đổi app DB/port.
- API `4019`, Web `3017`, Admin `3018`. PhpMyAdmin mà shared stack đang chạy là `9090`, còn `8091` không lắng nghe; giữ nguyên shared stack, không đổi port hay restart.
- **Targeted UNIT:** `npm run test --workspace @vexgo/api -- test/unit/payments/payments.service.spec.ts test/unit/payments/refund-processor.service.spec.ts` — lần đầu `FAIL` do fixture phương thức SePay không khớp; đã sửa fixture và assertion UTC+7. Lần cuối `PASS`, 2 files / 58 tests.
- **Quality gates:** Prisma format/validate/generate `PASS`; `npm run typecheck --workspace @vexgo/api` `PASS`; `npm run lint --workspace @vexgo/api` `PASS`; `npm run build --workspace @vexgo/api` `PASS`; `git diff --check` `PASS`; `prisma migrate deploy` `PASS`; `prisma migrate status` `PASS`.
- GitNexus pre-commit analysis: `risk_level=medium`, 13 changed symbols, 1 affected process `OnApplicationBootstrap → ProcessRefund`; callers xác định là enqueue và processor định kỳ. `processRefund` impact trước sửa là `LOW`, incoming exact. Không có cảnh báo HIGH/CRITICAL.
- **Integration/E2E/browser/UI automation:** `NOT RUN BY REQUEST`. Unit test dùng mock ở query/provider boundary; không chứng minh API/DB runtime hoặc an toàn end-to-end.
- Tự review: timestamp ghi cùng chuyển trạng thái thành công; marker true chỉ ở cuối transaction settlement hợp lệ; late/duplicate/reconciliation bị giữ marker false; refund chỉ ghi hoàn tất sau provider `SUCCEEDED`; không có provider call trong transaction DB. Không thấy secret, generated file hoặc dump được stage.
- **Manual smoke:** UI F12 chưa được triển khai; không có UI PASS để báo. Checklist Admin/API sẽ bàn giao sau Phase 03; user tự thực hiện.
- **Open limitations:** refund gửi hàng và thu tiền mặt không có writer hiện tại; không backfill record cũ; số lượng booking 0đ cần Phase 01 xác minh mapping event. Đây không chặn gate Phase 00 vì nguồn writer hiện hữu cho sale/refund phân biệt được và DB F12 sạch.
- **Git status sau implementation commit:** `feature/tenant-revenue-reporting`, ahead 1 so với `origin/develop`; trạng thái source sạch trước commit handoff.
- **Next phase:** `01` — đọc lại `MASTER_SPEC.md`, `handoff/PROGRESS.md`, handoff này và chỉ `spec/PHASE_01_REVENUE_API_AND_AUTH.md`; tiếp tục kiểm tra impact GitNexus trước khi sửa.
