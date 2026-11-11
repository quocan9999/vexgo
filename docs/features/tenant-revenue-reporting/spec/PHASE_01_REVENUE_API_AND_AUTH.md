# PHASE 01 — API Báo cáo doanh thu & RBAC tenant

**Điều kiện đầu vào:** Phase 00 DONE, đọc `MASTER_SPEC.md`, `handoff/PROGRESS.md`, `handoff/PHASE_00_HANDOFF.md` và **chỉ file phase này**. Nếu Phase 00 BLOCKED không chạy tiếp.

## Mục tiêu

Một endpoint GET tenant-scoped dữ liệu từ database thật, tính **6 KPI**, `serviceBreakdown[3]`, `series[]` cho 1 chart + 1 bảng thời gian. Không thêm export endpoint hoặc dashboard vận hành F13. Tạo permission `revenue:read` đúng cơ chế hiện hành.

## Bảo mật và quyền

1. `@RequirePermissions('revenue:read')` hoặc pattern guard/decorator tương đương theo codebase, **đồng thời** enforce role/scope tenant; `NHA_XE_ADMIN` mặc định, nhân viên chỉ khi effective tenant permission, không default permission cho tất cả nhân viên; `SUPER_ADMIN` platform không được tùy ý truy cập tenant.
2. ID nhà xe CHỈ từ `AuthPrincipal.nhaXeId` đã xác thực; không nhận `nhaXeId/busCompanyId` trong query/header/body; filter này bắt buộc áp dụng tới sale events, refund events, quantities **trước** group/sum. Không fetch all tenants rồi lọc frontend.
3. Cập nhật `apps/api/src/auth/permissions/permission-catalog.ts`; các role defaults, Prisma permission seed/rollout/migration hoặc cách sync đang hiện hành, tenant overrides tại `TenantRolePermissionsService` và resolver. Giữ `chat:read/chat:manage`, `booking:read`, `promotion:*`, `shipment:*` không regression.
4. Missing principal → 401; authenticated platform/customer/missing right/missing tenant → 403; params sai → 400; không leak ID/total của tenant khác. Chấp nhận test guard/service bằng unit (không HTTP integration).

## API contract

Gợi ý `GET /api/v1/revenue-reports?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&groupBy=day|month|quarter`. Trước khi tạo mới, audit xem có endpoint tương đương không và theo convention response interceptor hiện tại; **không double-wrap** JSON.

Đầu ra: `data.currency='VND'`, `data.totals` với:

- `grossReceipts`, `refundAmount`, `netRevenue`, `netTicketRevenue`, `netShipmentRevenue`, `successfulPayments`, `soldTicketCount`, `issuedShipmentCount`.
- `data.serviceBreakdown`: **3 dòng bắt buộc** `ticket` / `standaloneShipment` / `accompaniedShipment`, mỗi dòng `grossReceipts`, `refundAmount`, `netRevenue`. Có thể gửi `label` tiếng Việt, nhưng key/kind ổn định trong TypeScript.
- `data.series`: kỳ (`period`), `grossReceipts`, `refundAmount`, `netTicketRevenue`, `netShipmentRevenue`, `netRevenue`, `successfulPayments`; counts phát hành có thể bổ sung trong series để đảm bảo invariant. `meta`: fromDate/toDate/groupBy/timezone.
- 6 KPI render từ totals; chart và bảng thời gian phải dùng **cùng series**; bảng cơ cấu dùng breakdown cùng nguồn thu/refund.

**Validation:** ngày ISO hợp lệ (không cho 2026-02-30), `fromDate<=toDate`, `groupBy` thuộc day/month/quarter; timezone `Asia/Ho_Chi_Minh`; truy vấn khoảng nửa mở từ 00:00 fromDate tới 00:00 của ngày sau toDate (local). Default tháng hiện tại + nhóm ngày. Nhãn kỳ: day `YYYY-MM-DD`, month `YYYY-MM`, quarter `YYYY-Qn`. Query rỗng thì các tiền/count bằng 0, breakdown vẫn đủ 3 dòng.

## Thuật toán yêu cầu

- Dùng **canonical sale settlement events** Phase 00, chặn paid-late/reconciliation; refund riêng theo success event, không dùng current order status duy nhất. `ThanhToan.thoiGian` pending không phải success; `updatedAt` không đáng tin làm ngày tài chính.
- Split bởi dữ liệu ghi thực `Ve.giaThucTe`, `PhieuGuiHang.tongPhi`, quan hệ `DonGiaoDich`/`PhieuDatVe`; promo đã giảm thì **không trừ lần hai**. Định danh kèm vé bởi **same order có `PhieuDatVe` và `PhieuGuiHang`**, không dựa mô tả text.
- Không JOIN vé×shipment×payments rồi `SUM` khiến nhân bản; dùng query độc lập/group theo order hoặc đọc chi tiết một lần, phân bổ Decimal, ghi invariant báo lỗi nếu mismatch. Không tự thêm daily aggregate table/cron/cache.
- Refund thành công `THANH_CONG` phải phân đúng `ticket`/shipment category; kỳ chỉ có refund được phép `netRevenue<0`.
- Đơn 0đ không có payment: lượng vé/vận đơn có thể được đếm theo settled event, không coi là payment thành công; không giả record 0đ.
- `successfulPayments` phải là số **real sale payments** hợp lệ duy nhất trong kỳ, không phải số order đã tạo, không cộng refund hoặc attempts.
- Nên ưu tiên các type/repository/API utilities sẵn có; không tạo một `PaymentsService` thứ hai. Không triển khai DTO toàn dashboard ngoài phạm vi report.

## Acceptance criteria

- [ ] API GET duy nhất (hoặc existing endpoint tương đương), trả đúng money, count, breakdown, series, meta từ DB runtime; mọi query tenant scoped.
- [ ] Permission trong catalog và nguồn quyền DB seed/rollout đúng; API ngăn platform/anonymous/customer/non-granted employee.
- [ ] `netTicketRevenue + netShipmentRevenue == netRevenue`, `grossReceipts - refundAmount == netRevenue`; breakdown 3 dòng và sum series khớp totals.
- [ ] Mixed/coupon, refund ngày sau, late payment, duplicate attempts, zero-value settled, month/quarter boundary đúng.
- [ ] Unit tests thực sự fail cho các bug nhắm tới; typecheck/lint/build nếu code chạm, `git diff --check`, self-review, Conventional Commit tiếng Việt, handoff và PROGRESS.
- [ ] **KHÔNG viết/chạy HTTP/integration/E2E/database integration test**; không được ghi phần chưa thử là PASS.

## Unit test cases (mock I/O, kiểm tra business logic thật)

| ID | Test case | Bug cần bắt |
|---|---|---|
| P01-U01 | Anonymous, customer, Super Admin, tenant employee chưa quyền, tenant admin | 401/403 trong guard logic, không bypass quyền |
| P01-U02 | Fake `nhaXeId` query và principal tenant A | Không thể đổi tenant; chỉ query scope A |
| P01-U03 | Tenant A có 200k, B có 900k, refunds xen kẽ | Totals A không chứa tiền B kể cả refund |
| P01-U04 | Vé-only, shipment-only, combined + promo | Phân bổ và sum invariant đúng, không join multiplication |
| P01-U05 | 1 successful + 2 failed/pending + `CAN_DOI_SOAT` | Sale count=1, khoản đối soát excluded |
| P01-U06 | Paid-late after cancellation vs paid-then-canceled-later | Late excluded; sale history vẫn giữ |
| P01-U07 | Refund pending/success vào kỳ sau, partial refund | Net âm đúng ở kỳ refund; không trừ pending |
| P01-U08 | `23:59+07` tới `00:00+07`, tháng/năm/quý | Group bucketing/calendar chính xác |
| P01-U09 | `2026-02-30`, from>to, invalid groupBy, tenant query | DTO reject/bảo vệ nguồn query |
| P01-U10 | Không có events, toàn bộ order 0đ | Số tiền=0; counts theo semantics đã xác nhận |
| P01-U11 | Đơn giảm phí lẻ và refund split | Không mất/nhân 1 VND vì float |
| P01-U12 | `serviceBreakdown` 3 rows, grouped `series` | Invariant tổng tiền, số liệu âm không clamp |

**Test discipline:** test production calculation function/authorization logic, mock Prisma **tại ranh giới dữ liệu** và assert query tenant predicate, không mock `RevenueReportsService.getReport` rồi kiểm tra stub đó trả gì. Ghi minh bạch unit test không bảo đảm câu SQL chạy thật đúng trên MySQL; người dùng sẽ test UI và có thể tra DB thủ công.

## Out of scope

Xuất CSV/PDF/Excel thật, platform-wide report, tuyến/chuyến/ghế, chi phí/lợi nhuận, kế toán, provider refund implementation, thêm auth mechanism, full-suite/integration/E2E.
