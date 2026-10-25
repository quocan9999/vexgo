# PHASE 00 — Rà soát dữ liệu doanh thu & chuẩn hóa sự kiện thanh toán

**Đọc khi bắt đầu:** `MASTER_SPEC.md`, `handoff/PROGRESS.md`, handoff gần nhất và **chỉ** spec phase này. Không xem trước spec phase 01–03. Trạng thái phase chỉ được DONE nếu đã có nguồn dữ liệu đáng tin và kết quả test tương ứng.

## Mục tiêu

Từ branch của repo gốc tạo từ **latest `origin/develop`**, lần theo luồng ghi tiền đang chạy để chỉ ra **một sự kiện sale settlement hợp lệ, thời điểm giao dịch hoàn tất và cách phân bổ tiền**. Sửa ít nhất có thể nếu thiếu bằng chứng, không xây ledger/scheduler riêng. Làm trên DB demo riêng F12, không đụng DB khác.

## Trình tự thực hiện (bắt buộc)

1. **Baseline:** lưu SHA `origin/develop`, `git status --short`, branch. Check docs/migrations trong repo thật. Tham chiếu GitHub `bc863de26fe9787f91e2078475f97c16d2f6423f` chỉ là snapshot trước triển khai, không cưỡng ép dùng commit cũ. PR #35, #37 đã merge; luồng khuyến mãi, gửi hàng đã hiện diện trong develop.
2. **Trace payment source:** `prisma/schema.prisma`; `apps/api/src/payments/payment-attempt.ts`, `payments.service.ts`, `payment-settlement.service.ts`, `payment-order-lock.ts`, `README.md`; luồng webhook SePay `transactionDate`; các adapter payment/cash nếu đã tồn tại; nhận diện callback lặp, `CAN_DOI_SOAT`, late payment, duplicate attempt.
3. **Trace refund:** `tickets.service.ts::cancelTicket`, `RefundProcessorService`; khi refund được tạo là `DANG_XU_LY`, provider ack `SUCCEEDED` thì `THANH_CONG`. Phải phân biệt **thời điểm yêu cầu** với **thời điểm thực hoàn**. Không tự gọi provider để thử; không tự triển khai provider mới; provider chưa config thì chỉ pending.
4. **Trace snapshot:** `DonGiaoDich.tongTien`, `PhieuDatVe.tongTienBanDau`, `soTienGiamKhuyenMai`, `Ve.giaThucTe`, `PhieuGuiHang.tongPhi`, `SuDungKhuyenMai`. Xác nhận `sum(giá vé thực tế) + phí gửi = order.tongTien` đối với ticket-only, shipment-only, mixed và promo. Phân biệt gửi kèm với gửi độc lập dựa liên kết `DonGiaoDich` có `phieuDatVe`.
5. **Trace đơn 0đ:** `BookingsService` có nhánh internal settle và không tạo payment; xác nhận event date/count vé/vận đơn và không tạo khoản tiền hoặc payment count giả.
6. **Xác lập identity sale event:** KHÔNG filter dựa vào **trạng thái cuối** của đơn vì đơn đã paid rồi mới hủy vẫn phải giữ số tiền ngày bán. Đồng thời payment `THANH_CONG` **đến trễ khi đơn đã hủy trước đó** không mặc nhiên là doanh thu. Tìm dấu vết settlement thực/historical transition; nếu không chứng minh được, bổ sung **dấu vết nhỏ nhất** ở writer/DB chứ không dùng heuristic theo ngày trạng thái. Một sale event không bị tính hai lần khi nhiều attempts/provider callbacks.
7. **Timestamp:** hiện `ThanhToan.thoiGian` được tạo khi pending và `updatedAt` không bất biến. Kiểm tra cách lưu `providerTransactionAt` đã xác thực (SePay), thời điểm server của provider khác và refund `SUCCEEDED`. Nếu không có field sự kiện tin cậy: cân nhắc **`completedAt DateTime?` dùng chung cho `THANH_TOAN` và `HOAN_TIEN`** (hoặc thiết kế tối thiểu tương đương). Chỉ set một lần trong bước thành công, không cập nhật khi metadata thay đổi hoặc callback lại. Thực hiện migration an toàn từ source, không sửa migration đã áp dụng.
8. **Demo data:** không giữ legacy timestamp thiếu bằng chứng. Có thể reset/reseed `vexgo_feature12` và shadow riêng sau khi đối chiếu URL và xác nhận không có connection tới database khác. Không cần seed bộ dữ liệu khổng lồ; chỉ có dữ liệu demo vừa đủ để user UI smoke khi feature hoàn tất.
9. **Định nghĩa tiền hoàn theo dịch vụ:** `ThanhToan.veId` của refund vé gắn vào `ticket`; refund shipment nếu có thì theo `PhieuGuiHang`/order. Với refund không xác định được nguồn, ghi blocker/limitation minh bạch; **không tự gán vào vé**. Đặc biệt refund ngày sau không thay kỳ gốc.
10. **Báo cáo Phase 00:** handoff phải có bảng "event → writer path → DB field → meaning → eligibility → business date" và công thức split; ghi rõ migration/seed có cần hay không, cặp DB URL đã kiểm tra, các nhánh không hỗ trợ (ví dụ thu tiền mặt) không được giả lập.

## Bất biến / acceptance criteria

- [ ] Phân biệt `THANH_CONG` sale hợp lệ với paid-late, duplicate settlement, `CAN_DOI_SOAT`; các payment khác trạng thái bị loại khỏi tiền.
- [ ] Timestamp success **bất biến**, từ SePay transactionDate hợp lệ hoặc nguồn trusted. Refund không được dùng timestamp request. Có test khi pending 23:58 rồi success sau 00:00; webhook retry không đổi time.
- [ ] Không xóa doanh thu kỳ cũ khi đơn hủy; không trừ tiền khi refund chưa success; refund được gắn đúng dịch vụ.
- [ ] Mixed payment: `ticket + standalone + accompanied = order.tongTien` theo actual snapshot; không trừ promo hai lần; cả amount/quantity counters có nguồn tin cậy.
- [ ] Không có code ghi DB/test provider ngoài feature scope; migration/schema chỉ nếu cần; không tự sửa các hệ thống thanh toán không liên quan.
- [ ] **Chỉ targeted unit tests**, không integration/E2E/UI auto. Chạy typecheck/lint/build phần source bị ảnh hưởng, self-review, `git diff --check`, commit, handoff, PROGRESS.

## Unit test cases (viết khi liên quan, phải kiểm tra đúng logic thật)

| ID | Kịch bản / lỗi cần bắt | Kết quả |
|---|---|---|
| P00-U01 | Payment pending 15/10 23:58 + SePay success 16/10 00:03 +07 | Business bucket **16/10** |
| P00-U02 | Refund queued 15/10, provider success 17/10 | Chỉ âm 17/10; pending không âm |
| P00-U03 | Callback replay và metadata update sau success | Không tăng tiền/count; event `completedAt` không đổi |
| P00-U04 | Đơn đã settle ngày A rồi khách hủy ngày B | Sale của A vẫn ở A; chỉ refund success B âm |
| P00-U05 | Thu muộn sau đã hủy, status `THANH_CONG` hoặc `CAN_DOI_SOAT` | Không tính là sale hợp lệ |
| P00-U06 | 2 failed/pending attempts + 1 settled valid | Chỉ 1 thanh toán thành công |
| P00-U07 | Vé 250k, discount 50k, hàng kèm 100k | Split 200k/100k, tổng 300k |
| P00-U08 | Refund 180k của vé giá 200k, phí hủy 20k | Lũy kế net 20k, không cộng phí hai lần |
| P00-U09 | Zero-value booking internal settled | Tổng tiền/payment count 0, số vé đúng khi có bằng chứng |
| P00-U10 | VND 1đ/odd remainder discount, nhiều vé | Tổng allocated đúng tuyệt đối bằng Decimal, không sai 1đ |

**Chất lượng test:** unit test chạy trên **hàm production thật** hoặc service cùng query-building logic, mock I/O nhỏ nhất. Không tạo test chỉ mock cả `calculateRevenue()` rồi assert kết quả mock trả về; test phải fail khi implementation bug thật.

## Khi nào phải BLOCKED?

- Thiếu cách phân biệt sale hợp lệ và tiền đến trễ/đối soát, hoặc không thể xác nhận event time mà không phải đổi logic rộng nguy hiểm.
- Dữ liệu refund/ticket/cargo không thể phân bổ đúng mà contract vẫn yêu cầu 3 dòng doanh thu.
- Repo root đang có thay đổi khác mà checkout branch sẽ ghi đè; hoặc cấu hình DB không xác nhận an toàn. **Không stash/reset/force**. Báo blocker, dừng phase.

Không được lấp các lỗ hổng bằng mock/demo runtime. Nêu rõ phần được xác minh bằng unit test, phần vẫn cần user smoke.
