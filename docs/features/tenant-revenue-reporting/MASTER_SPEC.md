# MASTER SPEC — F12: Dashboard & Báo cáo doanh thu theo nhà xe

**Version 2 (2026-10-22)** · Nguồn tiền **thực**, tenant scoped; **không** phải kế toán tài chính đầy đủ.

## 1. Bối cảnh, mục tiêu, ranh giới

VexGo: NestJS API + Prisma 7/MySQL + Next.js Admin/Customer Web. F12 trả lời cho quản trị nhà xe: **đã thu bao nhiêu tiền hợp lệ, từ dịch vụ nào, hoàn bao nhiêu, dòng doanh thu đang biến động ra sao**. F13 sẽ thống kê vận hành xe/chuyến/ghế/vận đơn đang xử lý, **không nằm trong F12**. Super Admin không xem tổng doanh thu VexGo hoặc chuyển tenant trong F12.

### MVP đầu ra

1. Một trang Admin tenant (gợi ý `/revenue-reports`) với **6 KPI**, một biểu đồ theo kỳ và **hai bảng**: cơ cấu doanh thu theo dịch vụ; doanh thu theo thời gian.
2. Date range local và hiển thị theo ngày/tháng/quý; một nút CSV chỉ hiển thị thông báo **“Tính năng xuất báo cáo đang được triển khai”**.
3. Một API GET tenant-scoped trả chung totals, breakdown, series, counters; dễ kiểm tra đối chiếu theo cùng kỳ.
4. Phân quyền `revenue:read` trên backend + UI; migration tối thiểu để bảo đảm xác định thời điểm hoàn thành thanh toán/hoàn tiền và quyết toán hợp lệ nếu thực sự cần.

## 2. Nghiệp vụ đã khóa

- Định nghĩa ở đây là **doanh thu ròng theo sự kiện thu/hoàn tiền trong hệ thống**, không tuyên bố tuân thủ chuẩn mực kế toán, không phải số dư ngân hàng/lợi nhuận. Báo cáo công khai nhãn/tooltip để tránh hiểu nhầm.
- **Hai loại chính:** (a) vé xe, (b) gửi hàng. Doanh thu gửi hàng chia ở **bảng cơ cấu** thành gửi hàng **độc lập** và **kèm vé**; tổng nhóm gửi hàng = hai nhóm con.
- Mỗi payment hợp lệ có `loaiGiaoDich = THANH_TOAN`, trạng thái `THANH_CONG` và **settlement bán dịch vụ thực** được tính một lần. Mọi phương thức đã được hệ thống ghi nhận thành công đều thuộc phạm vi (online/thu trực tiếp nếu tương lai code có), KHÔNG tính pending, failed, amount sai, callback replay, settlement thừa, `CAN_DOI_SOAT`.
- Refund chỉ trừ khi record `loaiGiaoDich = HOAN_TIEN` **THANH_CONG**, tại ngày hoàn thành thật. Hủy vé/chuyến/vận đơn hoặc `HOAN_TIEN:DANG_XU_LY/DANG_GUI` chưa trừ.
- **Phí hủy được giữ lại** không tạo dòng thu mới: tiền gốc trừ tiền hoàn còn lại là thu ròng; không cộng lại phí hủy lần hai. Không mở chi phí vận hành và lợi nhuận.
- Khuyến mãi áp dụng vào giá thực thu; `Ve.giaThucTe` đã phân bổ giảm giá, `PhieuDatVe.soTienGiamKhuyenMai` là snapshot giảm, `PhieuGuiHang.tongPhi` là tổng phí; không trừ coupon lần thứ hai.
- Với đơn kết hợp vé + gửi hàng, một payment được phân bổ theo snapshot chính xác của **cùng DonGiaoDich**. Tuyệt đối không cộng `DonGiaoDich.tongTien` thêm lần nữa khi đã cộng các thành phần.
- **Đơn 0đ** đã internally settled nhưng không có bản ghi payment: không cộng tiền hay tăng KPI `successfulPayments`; vé/vận đơn phát hành thành công có thể tăng KPI số lượng ở kỳ hoàn tất nội bộ nếu có thời điểm đáng tin cậy. Không tạo payment ảo chỉ để đếm 0đ.
- **Thống kê giao dịch và số lượng là chỉ số phát sinh trong kỳ**, không tính lại theo trạng thái cuối hiện tại. Nếu khách đã mua rồi hủy ở kỳ sau, doanh thu âm phản ánh kỳ hoàn, không xóa sạch số tiền của kỳ mua. Counts là **số đã phát hành/quyết toán trong kỳ** (gross activity), không phải vé đang còn hiệu lực hoặc vận đơn đang vận chuyển.

## 3. Công thức và định nghĩa chuẩn

> Mỗi đồng VND chỉ được tính **một lần**, mỗi event thuộc duy nhất một tenant và một bucket calendar (`Asia/Ho_Chi_Minh`). Dùng Decimal hoặc integer VND an toàn, tránh cộng tiền bằng float.

Ký hiệu kỳ P, tổng hợp từ các **sale settlements hợp lệ** và **refund successes**:

- `grossTicketRevenue(P)` = tiền vé đã thanh toán thành công trong P sau khuyến mãi, **trước hoàn**.
- `grossStandaloneShipmentRevenue(P)` = tiền gửi hàng độc lập đã thanh toán thành công trong P, trước hoàn.
- `grossAccompaniedShipmentRevenue(P)` = tiền gửi hàng kèm vé đã thanh toán thành công trong P, trước hoàn.
- `grossShipmentRevenue = grossStandaloneShipmentRevenue + grossAccompaniedShipmentRevenue`.
- `ticketRefundAmount(P)`, `standaloneShipmentRefundAmount(P)`, `accompaniedShipmentRefundAmount(P)` = hoàn tiền **thành công trong P**, phân đúng dịch vụ/đơn gốc.
- `refundAmount = ticketRefundAmount + standaloneShipmentRefundAmount + accompaniedShipmentRefundAmount` (>=0).
- `netTicketRevenue = grossTicketRevenue - ticketRefundAmount`.
- `netShipmentRevenue = grossShipmentRevenue - standaloneShipmentRefundAmount - accompaniedShipmentRefundAmount`.
- `netStandaloneShipmentRevenue = grossStandaloneShipmentRevenue - standaloneShipmentRefundAmount`.
- `netAccompaniedShipmentRevenue = grossAccompaniedShipmentRevenue - accompaniedShipmentRefundAmount`.
- `grossReceipts = grossTicketRevenue + grossShipmentRevenue`; `netRevenue = grossReceipts - refundAmount = netTicketRevenue + netShipmentRevenue`.
- `successfulPayments` = số **payment sale** độc lập có settlement hợp lệ trong P, không phải `COUNT(*)` của mọi attempt; **không** gồm refund, đơn 0đ, khoản đối soát hoặc trùng webhook.
- `soldTicketCount` = số vé phát hành thành công trong kỳ settlement thực (gồm đơn 0đ hợp lệ); `issuedShipmentCount` = số phiếu gửi hoàn tất bước bán/ghi nhận nội bộ cùng kỳ (độc lập + kèm vé), theo event settlement được chứng minh; số lượng không bị trừ khi khách hủy về sau. Nếu cần metric số vé còn hiệu lực, thuộc F13.

**Tiền hoàn theo kỳ thanh toán hoàn**, KHÔNG gắn ngược về kỳ bán. Do đó `netRevenue`, `netTicketRevenue`, `netShipmentRevenue` một kỳ có thể âm. Trường hợp refund không xác định được dịch vụ, Phase 00 PHẢI xác lập chính sách phân bổ dựa chứng cứ; **không âm thầm gán vào vé**, không làm bảng cơ cấu sai bằng cách giấu refund. Nếu thật sự chưa thể phân bổ một event, công bố giới hạn/dừng money breakdown theo gate thay vì tạo số giả.

### Các ví dụ chặn bug

| Kịch bản | Tiền ghi nhận / số lượng |
|---|---|
| Vé 250.000, promo 50.000, thanh toán 200.000 | gross vé +200.000, không −50.000 thêm lần nữa |
| Vé 200.000 + gửi hàng kèm 100.000, 1 payment 300.000 | gross vé +200.000, hàng kèm +100.000, tổng +300.000 (KHÔNG +600.000) |
| Vé 200.000 thu ngày 15/10, refund 180.000 ngày 16/10 | ngày 15/10 +200.000; ngày 16/10 −180.000; không ghi lại kỳ 15/10 |
| Hoàn 180.000, giữ phí hủy 20.000 | net lâu dài 20.000; KHÔNG cộng riêng 20.000 |
| Pending 23:58 15/10, SePay transactionDate 00:03 16/10 | doanh thu 16/10, không theo ngày tạo pending |
| Một payment 3 webhook replay | 1 settlement, 1 lần đếm |
| `CAN_DOI_SOAT` hoặc paid-late sau khi order hết hạn | không ghi như sale settlement hợp lệ |
| Đơn giảm 100% thành 0đ, nội bộ đánh `DA_THANH_TOAN` | 0 doanh thu, 0 successfulPayments, số lượng phát hành tăng nếu source đáng tin |
| Tenant A 200.000; tenant B 900.000 | A chỉ thấy của A; B chỉ thấy của B |

## 4. 6 KPI chính thức

| STT | Nhãn UI | Field | Ý nghĩa |
|---|---|---|---|
| 1 | **Doanh thu ròng** | `netRevenue` | Tổng tiền thu hợp lệ trừ hoàn thành công trong kỳ (có thể âm) |
| 2 | **Doanh thu vé xe** | `netTicketRevenue` | Tiền vé sau discount và hoàn vé |
| 3 | **Doanh thu gửi hàng** | `netShipmentRevenue` | Tiền gửi độc lập + kèm vé sau hoàn |
| 4 | **Tiền đã hoàn** | `refundAmount` | Giá trị hoàn thành công (số không âm) |
| 5 | **Thanh toán thành công** | `successfulPayments` | Số payment bán dịch vụ được quyết toán hợp lệ (không đếm refund) |
| 6 | **Vé đã bán / Vận đơn** | `soldTicketCount` / `issuedShipmentCount` | Hai số lượng cùng một KPI card; là số phát hành trong kỳ, không phải tồn hiện tại |

**Bất biến:** (2) + (3) = (1); (tiền thu trước hoàn) − (4) = (1); cơ cấu 3 dòng sum bằng (1); tổng các buckets của báo cáo thời gian khớp KPI toàn kỳ. Trên giao diện ghi tooltip "theo giao dịch đã ghi nhận", không gọi là "lợi nhuận" hay "tiền mặt hiện có".

## 5. Một biểu đồ & hai bảng

- **Một biểu đồ:** line/bar theo kỳ `netRevenue` (âm vẫn hiển thị được), nhóm theo ngày/tháng/quý. Tooltip và nhãn format VND; một nguồn dữ liệu chung với bảng theo thời gian.
- **Bảng 1 — Cơ cấu doanh thu dịch vụ:** 3 dòng "Vé xe", "Gửi hàng độc lập", "Gửi hàng kèm vé"; mỗi dòng có **đã thu trước hoàn / đã hoàn / doanh thu ròng**, và có tổng cộng. Hai dòng gửi cộng bằng KPI gửi hàng; 3 dòng ròng cộng bằng netRevenue.
- **Bảng 2 — Báo cáo theo thời gian:** cột Kỳ, Vé (ròng), Gửi hàng (ròng), Thu trước hoàn, Đã hoàn, Doanh thu ròng, Thanh toán thành công. Dùng chính `series` server; không tạo một API gần trùng cho chart/table.
- Bộ lọc kỳ: `fromDate`, `toDate`, `groupBy=day|month|quarter`; khoảng ngày tùy chọn. Theo yêu cầu cập nhật ngày 23/10/2026, mặc định tháng hiện tại (từ đầu tháng đến hôm nay theo múi giờ Việt Nam), nhóm theo ngày; xóa lọc trở về tháng hiện tại. Ngày/tháng/quý là cách **gom bucket**, phạm vi lọc được chọn riêng để tránh hiểu sai.
- CSV: nút placeholder + toast chính xác **“Tính năng xuất báo cáo đang được triển khai”**, không download/endpoint/thông báo xuất thành công.

## 6. Tính thời gian, nguồn sự thật (baseline từ `origin/develop`)

**Baseline GitHub tại 2026-10-22**: `bc863de26fe9787f91e2078475f97c16d2f6423f`, chỉ làm tham chiếu. Phase 00 kiểm tra SHA fresh trước coding. Relevant source paths:

- `prisma/schema.prisma`: `DonGiaoDich.nhaXeId/tongTien`, `ThanhToan.soTien/phuongThuc/loaiGiaoDich/thoiGian/trangThai/veId`, `PhieuDatVe.soTienGiamKhuyenMai`, `Ve.giaThucTe`, `PhieuGuiHang.tongPhi`; `SuDungKhuyenMai` tồn tại. **Chưa có** trường timestamp completion riêng trên `ThanhToan`.
- `apps/api/src/payments/payment-attempt.ts`: `ThanhToan.thoiGian` ghi lúc tạo pending → **không** phải lúc thành công.
- `apps/api/src/payments/payments.service.ts`: SePay đọc và xác minh `transactionDate`, settlement chung booking/shipment, xử lý attempts/reconciliation `CAN_DOI_SOAT`; API hiện trả `paidAt` từ `payment.updatedAt` (mutable) → không an toàn làm nguồn báo cáo.
- `apps/api/src/payments/payment-settlement.service.ts` + `payment-order-lock.ts`: lock transaction dùng chung, PHẢI reuse; không xây writer thứ hai hoặc sửa lock boundary tùy tiện.
- `apps/api/src/tickets/tickets.service.ts`: hủy vé sinh `ThanhToan` `loaiGiaoDich='HOAN_TIEN'`, trạng thái `DANG_XU_LY`; `apps/api/src/payments/refund-processor.service.ts`: nếu `REFUND_PROVIDER_URL` cấu hình và provider trả `SUCCEEDED` thì status → `THANH_CONG`. Khi provider chưa cấu hình, pending không được coi hoàn thành.
- `apps/api/src/bookings/bookings.service.ts`: `totalOrderAmount = finalTicketTotal + shippingFee`; khuyến mãi chỉ trừ tiền vé; giá vé `giaThucTe` phân discount; đơn 0đ tự hoàn tất nội bộ mà **không có payment attempt**.
- `apps/api/src/shipments/shipments.service.ts` + shipment persistence: shipping-only có payment SePay thực, gửi kèm vé dùng cùng order/settlement.
- `apps/api/src/auth/permissions/permission-catalog.ts`: catalog tenant/platform; `apps/admin/src/features/admin-auth/services/admin-access.ts`: `ADMIN_OPERATION_SECTIONS` + `AdminPermission` + route checks; `apps/admin/src/features/super-admin-layout/components/super-admin-layout.tsx`: menu đã thêm booking, promotion, shipment, chat; **không thấy `revenue:read` hiện tại**.

### Điều kiện kỹ thuật bắt buộc cho event time

1. `completedAt` (tên minh họa, không mặc định chắc chắn phải migrate) là timestamp bất biến của **sự kiện tài chính thành công**, kể cả refund. Với SePay ưu tiên thời điểm ngân hàng `transactionDate` đã xác thực; các kênh khác dùng thời điểm xác nhận thực tế do server/nguồn tin cậy; refund theo lúc provider xác nhận `SUCCEEDED` (hoặc timestamp của provider có chứng cứ). **Không** dùng `updatedAt`, thời điểm pending, ngày tạo order, ngày chạy xe.
2. `completedAt` phải được ghi **một lần trong chính transaction/update chuyển trạng thái thành công**, không bị webhook replay/metadata update đổi; audit khả năng `THANH_CONG` nhưng order đã hủy trước đó (paid late) và duplicate sale trước khi tính. **Payment `THANH_CONG` đơn thuần không luôn đồng nghĩa với sale hợp lệ.**
3. Không chỉ `where DonGiaoDich.trangThai = DA_THANH_TOAN` ở thời điểm truy vấn vì đơn đã thanh toán rồi mới hủy vẫn phải giữ doanh thu lịch sử, trừ đúng khi refund thành công. Nếu chưa thể xác định **đã từng settlement hợp lệ** từ history thì Phase 00 nên bổ sung dấu vết tối thiểu/bất biến tại settlement boundary (hoặc chặn phase). Không tự add ledger/report aggregate table nếu chưa cần.
4. Với data demo **chỉ** hai DB F12, cho phép reseed/reset thay vì backfill giả thời điểm completion trên dữ liệu cũ; migration must protect other DBs.
5. Chuẩn `Asia/Ho_Chi_Minh`, date inclusive; query timestamp qua khoảng nửa mở `[00:00 fromDate, 00:00 ngày sau toDate)` local. Group calendar local trước khi gán label day/month/quarter; không tự group UTC rồi đổi nhãn.

## 7. API read contract (đề xuất; audit naming trước khi triển khai)

`GET /api/v1/revenue-reports?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&groupBy=day|month|quarter`

Một response `data`/`meta`, field `camelCase`, tiền là integer VND nếu an toàn; dùng Decimal tính trước khi serialize:

```json
{
  "data": {
    "currency": "VND",
    "totals": {
      "grossReceipts": 300000,
      "refundAmount": 80000,
      "netRevenue": 220000,
      "netTicketRevenue": 120000,
      "netShipmentRevenue": 100000,
      "successfulPayments": 1,
      "soldTicketCount": 1,
      "issuedShipmentCount": 1
    },
    "serviceBreakdown": [
      {"kind":"ticket", "label":"Vé xe", "grossReceipts":200000, "refundAmount":80000, "netRevenue":120000},
      {"kind":"standaloneShipment", "label":"Gửi hàng độc lập", "grossReceipts":0, "refundAmount":0, "netRevenue":0},
      {"kind":"accompaniedShipment", "label":"Gửi hàng kèm vé", "grossReceipts":100000, "refundAmount":0, "netRevenue":100000}
    ],
    "series": [
      {"period":"2026-10-16", "grossReceipts":300000, "netTicketRevenue":120000, "netShipmentRevenue":100000, "refundAmount":80000, "netRevenue":220000, "successfulPayments":1}
    ]
  },
  "meta": {"fromDate":"2026-10-16", "toDate":"2026-10-16", "groupBy":"day", "timezone":"Asia/Ho_Chi_Minh"}
}
```

*Ví dụ contract nói về shape, không phải dữ liệu production.* Mọi tổng bằng tổng `series` tương ứng; `serviceBreakdown` hợp với 3 nhóm. Dữ liệu không có → số tiền/count bằng 0, series thống nhất rỗng hoặc buckets zero. `period` day `YYYY-MM-DD`, month `YYYY-MM`, quarter `YYYY-Qn`. Có thể bổ sung `soldTicketCount`/`issuedShipmentCount` trong `series` nếu cần đối soát KPI, nhưng phải xuất từ cùng dữ liệu, không đếm kép.

**Trường hợp hợp lệ:** from/to đúng ISO date, from≤to, groupBy enum hợp lệ; invalid → 400. Giới hạn khoảng ngày hợp lý theo quy chuẩn dự án để tránh truy vấn quá nặng; không chặn một khoảng ngắn tùy ý. API không nhận tenant ID từ client. Không thêm POST/export/API report platform. Nếu framework hiện có auto envelope, không double-wrap `data`.

## 8. Authorization / RBAC

- `AuthPrincipal.nhaXeId` lấy từ backend-authenticated principal; không nhận `nhaXeId`, `busCompanyId` tự truyền. Mọi truy vấn có tenant filter từ `DonGiaoDich.nhaXeId` trước aggregation, kể cả refund/counters; Super Admin platform và customer bị 403, thiếu auth 401, filter sai 400.
- Thêm `revenue:read` **scope `tenant`** trong permission catalog, default chỉ `NHA_XE_ADMIN`, nhân viên được cấp khi có effective tenant permission. Reuse `@RequirePermissions`, `AuthorizationGuard`, `assertPrincipalScope` / `requireTenantPrincipal` theo convention mới và migration/seed permission/tenant override. Cấm client-side filtering để bảo mật.
- Route Admin phải dùng `ADMIN_OPERATION_SECTIONS`, `AdminPermission` union, `getRequiredAdminPermissions` và sidebar `OPERATION_NAVIGATION_DETAILS` theo phiên bản hiện hành; direct route bị chặn; không đụng cấu trúc quyền `chat:read`/`chat:manage` từ PR #37.

## 9. Test policy — gọn nhưng không hời hợt

- **CHỈ tạo/chạy TARGETED UNIT TESTS** cho phần backend mà chủ dự án khó kiểm chứng bằng mắt trên UI: thuật toán phân loại + tiền refund, precision Decimal, timezone, dedup settlement, isolation tenant, RBAC guards/resolver, filter DTO. Unit test có negative/boundary cases và mock repository tại **query boundary**; không đơn giản mock chính phương thức cần test rồi assert mock.
- KHÔNG thêm/chạy **integration tests, E2E, HTTP/DB integration test, browser automation, UI/component tests**. Không cần đạt coverage tùy tiện; không chạy full-suite để tiết kiệm thời gian. Agent vẫn làm static review (tenant predicates, JOIN multiplicity, SQL injection/DTO), typecheck/lint/build mục tiêu, `git diff --check`.
- Agent **không kết luận bảo mật end-to-end đã được chứng minh** chỉ bằng unit tests. Viết **manual UI/API checklist** cho người dùng, ghi rõ `NOT VERIFIED BY AGENT` các ca chưa được thử thực tế. UI có thể test thủ công: login/permissions, KPI, filter, layout, link, toast, lỗi mạng, độ nhất quán chart/tables.

## 10. Cấu hình và quy trình triển khai

- **Không tạo worktree**; người dùng làm trên **repo gốc** nhưng agent tạo/checkout **branch feature riêng từ `origin/develop`** sau khi kiểm tra working tree sạch, không code trực tiếp trên develop, không stash/reset/delete thay đổi người dùng.
- MySQL shared `127.0.0.1:3306`; phpMyAdmin `8091`; API `4019`; Web `3017`; Admin `3018`; DB `vexgo_feature12` và shadow `vexgo_feature12_shadow`. Không đổi/reset DB của dự án khác, dù toàn bộ là demo. Chi tiết `SETUP_REPO.md`.
- Tài liệu `docs/features/tenant-revenue-reporting/` ở trên cùng branch feature. Không tự push, PR, merge; commit local tiếng Việt theo Conventional Commits, **1 dòng trống giữa header và bullet body, 0 dòng trống giữa các bullets**.
- Dùng Context7 MCP khi truy cứu API lib. Công việc UI dùng skill `ui-ux-pro-max`, đọc `apps/admin/DESIGN.md` và các component shared trước khi tạo mới.
- Mỗi phase chỉ đọc `MASTER_SPEC.md` + `handoff/PROGRESS.md` + last completed handoff + **spec phase hiện tại**. Khi compact/new session làm tương tự; không đọc toàn bộ 4 phase đồng thời.

## 11. Phase map và gate

| Phase | Phạm vi | Gate |
|---|---|---|
| **00** | Audit source tiền/success/refund/snapshot/zero/late, migration nhỏ nếu cần, unit test logic thời gian/sale eligibility | Nguồn dữ liệu/semantics đã chứng minh, các dữ liệu lệch được xử lý hoặc BLOCKED |
| **01** | API GET, authorization/tenant, metrics, breakdown, series và unit tests logic/permission | Công thức, scope, response, tests hoàn tất |
| **02** | Admin dashboard 6 KPI + 1 chart + 2 tables + date filters + CSV placeholder | UI bám API thật, static/typecheck/build; manual UI checklist |
| **03** | Regression review, targeted unit/typecheck/lint/build, chốt handoffs & test thủ công gửi user | Report trung thực READY FOR USER SMOKE / BLOCKED, không nói đã test UI |

Không triển khai F13, không xuất file, không tạo integration/E2E tests, không lập hệ thống kế toán.
